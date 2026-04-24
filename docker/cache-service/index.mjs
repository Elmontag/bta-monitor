import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';

const CACHE_DIR = process.env.CACHE_DIR ?? '/data/cache';
const DONATIONS_DIR = process.env.DONATIONS_DIR ?? path.join(path.dirname(CACHE_DIR), 'donations');
const SYNC_INTERVAL = parseInt(process.env.CACHE_SYNC_INTERVAL ?? '60', 10) * 60_000;
const AW_BASE = process.env.AW_API_BASE ?? 'https://www.abgeordnetenwatch.de/api/v2';
const DAWUM_FULL = process.env.DAWUM_FULL_URL ?? 'https://api.dawum.de/';
const DAWUM_NEWEST = process.env.DAWUM_NEWEST_URL ?? 'https://api.dawum.de/newest_surveys.json';

const aw = axios.create({ baseURL: AW_BASE, timeout: 20_000 });

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeJsonFile(file, payload) {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, JSON.stringify(payload), 'utf8');
}

async function writeCache(name, data) {
  const file = path.join(CACHE_DIR, `${name}.json`);
  await writeJsonFile(file, { lastUpdated: new Date().toISOString(), data });
  console.log(`[cache] written ${file}`);
}

async function writeDonationYear(year, entries) {
  const file = path.join(DONATIONS_DIR, `${year}.json`);
  await writeJsonFile(file, {
    year,
    count: entries.length,
    lastUpdated: new Date().toISOString().slice(0, 10),
    donations: entries,
  });
  console.log(`[cache] written ${file}`);
}

async function get(pathname, params = {}) {
  const res = await aw.get(pathname, { params });
  return res.data;
}

async function getAll(pathname, params = {}, pageSize = 100) {
  const items = [];
  let rangeStart = 0;
  let total = Infinity;

  while (items.length < total) {
    const res = await get(pathname, {
      ...params,
      range_start: rangeStart,
      range_end: rangeStart + pageSize,
    });
    const chunk = res.data ?? [];
    total = res.meta?.result?.total ?? chunk.length;
    items.push(...chunk);
    if (chunk.length === 0 || chunk.length < pageSize) break;
    rangeStart += chunk.length;
  }

  return items;
}

function stableSyntheticId(input) {
  let hash = 0;
  for (const ch of String(input ?? '')) {
    hash = ((hash * 31) + ch.charCodeAt(0)) | 0;
  }
  return Math.abs(hash) + 1_000_000_000;
}

function clean(text) {
  return String(text ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\u00ad/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanMultiline(text) {
  return String(text ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\u00ad/g, '')
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function parseAmount(text) {
  const match = String(text ?? '').match(/([\d.]+(?:,\d+)?)\s*Euro/i);
  if (!match) return 0;
  return Math.round(Number(match[1].replace(/\./g, '').replace(',', '.')) || 0);
}

function parseDonationDate(text) {
  const match = String(text ?? '').match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!match) return { date: '', year: 0 };
  return { date: `${match[3]}-${match[2]}-${match[1]}`, year: Number(match[3]) };
}

function normalizeParty(party) {
  const raw = clean(party);
  const upper = raw.toUpperCase();
  if (upper.includes('BÜNDNIS 90') || upper.includes('GRÜNE')) return 'Grüne';
  if (upper.includes('FREIE WÄHLER')) return 'Freie Wähler';
  if (upper.includes('DIE LINKE') || upper === 'LINKE') return 'Linke';
  if (upper.includes('CDU')) return 'CDU';
  if (upper.includes('CSU')) return 'CSU';
  if (upper.includes('SPD')) return 'SPD';
  if (upper.includes('FDP')) return 'FDP';
  if (upper.includes('AFD')) return 'AfD';
  if (upper.includes('BSW')) return 'BSW';
  if (upper.includes('SSW')) return 'SSW';
  if (upper.includes('PIRATEN')) return 'Piraten';
  return raw;
}

function categorize(raw) {
  const upper = String(raw ?? '').toUpperCase();
  if (['GMBH', 'AKTIENGESELLSCHAFT', ' AG ', ' AG,', 'OHG', ' KG ', ' KG,', 'HOLDING', 'BETEILIGUNG', 'KLINIK SE', 'IMPORT AG'].some((part) => upper.includes(part))) {
    return 'Unternehmen';
  }
  if (['E.V.', 'VERBAND', 'GEWERKSCHAFT', 'ELEKTROINDUSTRIE', 'VBM', 'GESAMTMETALL', 'KULTURMINISTERIET', 'SYDSLESVIGUDVALGET'].some((part) => upper.includes(part))) {
    return 'Verband';
  }
  if (upper.includes('STIFTUNG')) return 'Stiftung';
  return 'Privatperson';
}

function stripFlatAddress(text) {
  let value = text;
  if (value.includes(';')) value = value.split(';')[0].trim();
  value = value.replace(/\s+\d{4,5}[\s,]+\S.*$/u, '').trim();
  value = value.replace(/\s+[\wäöüÄÖÜß-]+(?:straße|strasse|weg|allee|platz|ring|gasse|damm|gade|chaussée|chaussee|promenade|ufer|markt)\b.*$/iu, '').trim();
  value = value.replace(/\s+[\wäöüÄÖÜß-]+str\..*$/iu, '').trim();
  value = value.replace(/\s+c\/o\s+.*$/iu, '').trim();
  value = value.replace(/\s+\d+(?:\s*[a-zA-Z]|[a-zA-Z/-]*)?\s*$/u, '').trim();
  return value;
}

function cleanDonor(raw) {
  let value = String(raw ?? '').trim();
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  if (lines.length > 1) {
    const nameLines = [];
    for (const line of lines) {
      if (/^\d{4,5}\s+\S/u.test(line)) break;
      if (/(?:straße|strasse|weg|gasse|allee|platz|ring|damm|gade|chaussée|chaussee|promenade|ufer|road|avenue|boulevard)\b|str\.(?=\s|$|\d)/iu.test(line)) break;
      if (/\s\d+(?:\s*[a-zA-Z]|[a-zA-Z/-]+)?\s*$/u.test(line) && nameLines.length > 0) break;
      if (/^c\/o\s+/iu.test(line)) break;
      nameLines.push(line);
    }
    value = nameLines.length > 0 ? nameLines.join(' ') : stripFlatAddress(lines[0]);
  } else {
    value = stripFlatAddress(value);
  }

  if (value.includes(';')) value = value.split(';')[0].trim();
  if (value.length > 90) value = value.slice(0, 90).trim();
  return value.length >= 3 ? value : (lines[0] ?? String(raw ?? '').slice(0, 60)).trim();
}

async function scrapeDonationPage(pageYear) {
  const url = `https://www.bundestag.de/parlament/praesidium/parteienfinanzierung/fundstellen50000/${pageYear}`;
  const response = await axios.get(url, { timeout: 30_000, headers: { 'User-Agent': 'Mozilla/5.0' }, responseType: 'text' });
  const html = typeof response.data === 'string' ? response.data : String(response.data);
  const $ = cheerio.load(html);
  const rows = $('table tr').toArray().slice(1);
  const out = [];

  for (const row of rows) {
    const cells = $(row).find('td,th').toArray();
    if (cells.length < 4) continue;

    const texts = cells.map((cell) => clean($(cell).text()));
    if (!texts.some((text) => /\d{2}\.\d{2}\.\d{4}/.test(text))) continue;

    const donorHtml = $(cells[2]).html() ?? '';
    const donorRaw = cleanMultiline(
      donorHtml
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(?:p|div|li)>/gi, '\n')
        .replace(/<[^>]+>/g, ''),
    );
    const { date, year } = parseDonationDate(texts[3] ?? '');

    out.push({
      page_year: pageYear,
      date,
      year: year > 0 ? year : pageYear,
      party: normalizeParty(texts[0]),
      amount: parseAmount(texts[1]),
      donor: cleanDonor(donorRaw),
      category: categorize(donorRaw),
    });
  }

  return out;
}

async function syncParliaments() {
  const res = await get('/parliaments');
  await writeCache('parliaments', res.data);
  return res.data;
}

async function syncPeriods(parliament) {
  const res = await get('/parliament-periods', {
    parliament: parliament.id,
    type: 'legislature',
    range_end: 50,
    sort_by: 'start_date_period',
    sort_direction: 'desc',
  });
  await writeCache(`periods-${parliament.id}`, res.data);
  return res.data;
}

async function syncPolls(period) {
  const polls = await getAll('/polls', {
    field_legislature: period.id,
    sort_by: 'field_poll_date',
    sort_direction: 'desc',
  });
  await writeCache(`polls-${period.id}`, { polls, total: polls.length });
}

async function syncFractions(period) {
  const res = await get('/fractions', { legislature: period.id, range_end: 100 });
  await writeCache(`fractions-${period.id}`, res.data);
}

async function syncMandates(period) {
  const mandates = await getAll('/candidacies-mandates', {
    parliament_period: period.id,
    type: 'mandate',
  });
  await writeCache(`mandates-${period.id}`, { mandates, total: mandates.length });
}

async function fetchBundestagCabinetMembers() {
  const html = (await axios.get('https://www.bundesregierung.de/breg-de/bundesregierung/bundeskabinett', {
    timeout: 30_000,
    responseType: 'text',
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })).data;

  const $ = cheerio.load(html);
  const members = [];

  for (const card of $('div.bpa-teaser-cabinet').toArray()) {
    const name = clean($(card).find('h3 .bpa-teaser-title-text-inner').first().text());
    if (!name) continue;

    const role = clean(
      $(card)
        .parent()
        .find('ul.bpa-teaser-cabinet-list a')
        .toArray()
        .map((el) => clean($(el).text()))
        .find((text) => text && text !== 'Lebenslauf') ?? '',
    );
    if (!role) continue;

    let politician = null;
    try {
      const result = await get('/politicians', { 'label[cn]': name, range_end: 5 });
      politician = (result.data ?? []).find((entry) => clean(entry.label) === name) ?? null;
    } catch {
      politician = null;
    }

    members.push({
      politician: politician ?? { id: stableSyntheticId(name), label: name },
      mandate: null,
      role,
    });
  }

  return members;
}

async function syncGovernment(period) {
  // Government members are only supported for the Bundestag, sourced from
  // bundesregierung.de. AW's `occupation` field is too unreliable for Landtage
  // (mixes past cabinets, noisy data), so we skip them entirely.
  if (period.end_date_period && period.end_date_period < new Date().toISOString().slice(0, 10)) {
    await writeCache(`government-${period.id}`, []);
    return;
  }

  if (period.parliament?.label !== 'Bundestag') {
    await writeCache(`government-${period.id}`, []);
    return;
  }

  const members = await fetchBundestagCabinetMembers().catch(() => []);
  await writeCache(
    `government-${period.id}`,
    members.sort((a, b) => a.politician.label.localeCompare(b.politician.label, 'de')),
  );
}

async function syncDawum() {
  const [full, newest] = await Promise.allSettled([
    axios.get(DAWUM_FULL, { timeout: 30_000 }).then((res) => res.data),
    axios.get(DAWUM_NEWEST, { timeout: 15_000 }).then((res) => res.data),
  ]);

  if (full.status === 'fulfilled') await writeCache('dawum-full', full.value);
  if (newest.status === 'fulfilled') await writeCache('dawum', newest.value);
}

async function syncDonations() {
  const currentYear = new Date().getFullYear();
  const allRaw = [];

  for (let year = currentYear; year >= 2021; year -= 1) {
    const entries = await scrapeDonationPage(year);
    allRaw.push(...entries);
  }

  const grouped = new Map();
  for (const donation of [...allRaw].sort((a, b) => `${b.year}${b.date}`.localeCompare(`${a.year}${a.date}`))) {
    if (!grouped.has(donation.year)) grouped.set(donation.year, []);
    grouped.get(donation.year).push(donation);
  }

  for (const [year, entries] of grouped) {
    const withIds = entries.map((entry, index) => ({
      id: `${year}-${String(index + 1).padStart(3, '0')}`,
      date: entry.date,
      year,
      party: entry.party,
      donor: entry.donor,
      amount: entry.amount,
      category: entry.category,
    }));
    await writeDonationYear(year, withIds);
  }

  const manifest = {
    years: Array.from(grouped.keys()).sort((a, b) => b - a),
    lastUpdated: new Date().toISOString().slice(0, 10),
    totalCount: allRaw.length,
  };
  await writeJsonFile(path.join(DONATIONS_DIR, 'manifest.json'), manifest);
  console.log(`[cache] written ${path.join(DONATIONS_DIR, 'manifest.json')}`);
}

async function sync() {
  const started = Date.now();
  console.log(`[cache] sync started at ${new Date().toISOString()}`);

  try {
    const parliaments = await syncParliaments();

    for (const parliament of parliaments) {
      const periods = await syncPeriods(parliament);
      for (const period of periods) {
        try {
          await syncPolls(period);
          await syncFractions(period);
          await syncMandates(period);
          await syncGovernment(period);
        } catch (error) {
          console.warn(`[cache] sync for period ${period.id} failed:`, error.message);
        }
      }
    }

    await syncDawum();
    await syncDonations();
  } catch (error) {
    console.error('[cache] sync error:', error.message);
  }

  console.log(`[cache] sync done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

await sync();
setInterval(sync, SYNC_INTERVAL);
console.log(`[cache] service running - interval ${SYNC_INTERVAL / 60_000} min`);

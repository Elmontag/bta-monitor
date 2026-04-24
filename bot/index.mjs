/**
 * bta-monitor — BlueSky bot
 *
 * Posts new Bundestag votes, party donations and survey forecast changes to BlueSky.
 *
 * Required environment variables:
 *   BLUESKY_HANDLE        BlueSky handle, e.g. bta-monitor.bsky.social
 *   BLUESKY_APP_PASSWORD  App password generated at bsky.app/settings/app-passwords
 *
 * Optional environment variables (each defaults to 'false'):
 *   BOT_POST_VOTES        Post new Bundestag poll results         (true|false)
 *   BOT_POST_DONATIONS    Post new party donations > 50k €        (true|false)
 *   BOT_POST_SURVEYS      Post notable poll forecast changes       (true|false)
 *   BOT_CHECK_INTERVAL    Check interval in minutes (default: 60)
 *   AW_API_BASE           abgeordnetenwatch base URL
 *   DAWUM_URL             dawum newest-surveys URL
 *   APP_URL               Public URL of bta-monitor app for post links (optional)
 *   STATE_FILE            Path to state JSON file (default: /data/bot-state.json)
 */

import { BskyAgent, RichText } from '@atproto/api';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

// ── Config ────────────────────────────────────────────────────────────────────

const HANDLE        = process.env.BLUESKY_HANDLE;
const APP_PASSWORD  = process.env.BLUESKY_APP_PASSWORD;

if (!HANDLE || !APP_PASSWORD) {
  console.error('[bot] BLUESKY_HANDLE and BLUESKY_APP_PASSWORD are required.');
  process.exit(1);
}

const POST_VOTES     = process.env.BOT_POST_VOTES     === 'true';
const POST_DONATIONS = process.env.BOT_POST_DONATIONS === 'true';
const POST_SURVEYS   = process.env.BOT_POST_SURVEYS   === 'true';
const CHECK_INTERVAL = parseInt(process.env.BOT_CHECK_INTERVAL ?? '60', 10) * 60_000;
const AW_BASE        = process.env.AW_API_BASE ?? 'https://www.abgeordnetenwatch.de/api/v2';
const DAWUM_URL      = process.env.DAWUM_URL ?? 'https://api.dawum.de/newest_surveys.json';
const APP_URL        = (process.env.APP_URL ?? '').replace(/\/$/, '');
const STATE_FILE     = process.env.STATE_FILE ?? '/data/bot-state.json';

const aw = axios.create({ baseURL: AW_BASE, timeout: 15_000 });
const agent = new BskyAgent({ service: 'https://bsky.social' });

// ── State persistence ─────────────────────────────────────────────────────────

async function loadState() {
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { lastPollId: 0, lastDonationId: null, lastSurveyHash: null };
  }
}

async function saveState(state) {
  await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

// ── BlueSky helpers ───────────────────────────────────────────────────────────

async function post(text) {
  const rt = new RichText({ text });
  await rt.detectFacets(agent);
  await agent.post({ text: rt.text, facets: rt.facets });
  console.log(`[bot] posted: ${text.slice(0, 80)}`);
}

// ── Votes ─────────────────────────────────────────────────────────────────────

async function checkVotes(state) {
  // Fetch the latest Bundestag period
  const periodsRes = await aw.get('/parliament-periods', {
    params: { parliament: 5, type: 'legislature', range_end: 1, sort_by: 'start_date_period', sort_direction: 'desc' },
  });
  const period = periodsRes.data?.data?.[0];
  if (!period) return;

  const pollsRes = await aw.get('/polls', {
    params: { field_legislature: period.id, range_start: 0, range_end: 10, sort_by: 'field_poll_date', sort_direction: 'desc' },
  });
  const polls = pollsRes.data?.data ?? [];
  if (polls.length === 0) return;

  const latestId = polls[0].id;
  if (latestId <= state.lastPollId) return; // nothing new

  // Post each new poll (up to 5 to avoid spam)
  const newPolls = polls.filter(p => p.id > state.lastPollId).slice(0, 5);
  for (const poll of newPolls.reverse()) {
    const date = poll.field_poll_date
      ? new Date(poll.field_poll_date).toLocaleDateString('de-DE') : '';
    const accepted = poll.field_accepted ? 'Angenommen' : 'Abgelehnt';
    const link = APP_URL ? `\n${APP_URL}` : '';
    await post(
      `🗳️ Neue Abstimmung im Bundestag\n\n${poll.label}\n\n${date} · ${accepted}${link}`
    );
  }
  state.lastPollId = latestId;
}

// ── Donations ─────────────────────────────────────────────────────────────────

function fmtEur(n) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

async function checkDonations(state) {
  const year = new Date().getFullYear();
  let donations;
  try {
    const res = await axios.get(`${APP_URL}/data/donations/${year}.json`, { timeout: 10_000 });
    donations = res.data?.donations ?? [];
  } catch {
    return; // donations file not accessible
  }

  if (donations.length === 0) return;

  const latestId = donations[0]?.id ?? null;
  if (latestId === state.lastDonationId) return;

  // Find all donations newer than last seen
  const lastIdx = state.lastDonationId
    ? donations.findIndex(d => d.id === state.lastDonationId)
    : donations.length;
  const newDonations = donations.slice(0, lastIdx === -1 ? donations.length : lastIdx).slice(0, 5);

  for (const d of newDonations.reverse()) {
    const donor = d.category === 'Privatperson' ? 'Privatperson' : d.donor;
    await post(
      `💰 Neue Parteispende\n\n${d.party} · ${fmtEur(d.amount)}\nVon: ${donor}\nDatum: ${new Date(d.date).toLocaleDateString('de-DE')}`
    );
  }
  state.lastDonationId = latestId;
}

// ── Survey forecasts ──────────────────────────────────────────────────────────

function buildSurveyHash(surveys) {
  return surveys
    .filter(s => s.Parliament_ID === '0') // Bundestag
    .map(s => `${s.Parliament_ID}:${s.Date}:${Object.entries(s.Results ?? {}).map(([k, v]) => `${k}=${v}`).join(',')}`)
    .join('|');
}

async function checkSurveys(state) {
  const res = await axios.get(DAWUM_URL, { timeout: 15_000 });
  const surveys = Object.values(res.data?.Surveys ?? {});
  if (surveys.length === 0) return;

  const hash = buildSurveyHash(surveys);
  if (hash === state.lastSurveyHash) return;

  // Find the newest Bundestag survey
  const btSurveys = surveys
    .filter(s => s.Parliament_ID === '0')
    .sort((a, b) => b.Date.localeCompare(a.Date));
  const latest = btSurveys[0];
  if (!latest) return;

  const parties = res.data?.Parties ?? {};
  const institute = res.data?.Institutes?.[latest.Institute_ID]?.Name ?? 'Unbekannt';
  const lines = Object.entries(latest.Results ?? {})
    .filter(([, v]) => v >= 3)
    .sort(([, a], [, b]) => b - a)
    .map(([id, v]) => `${parties[id]?.Shortcut ?? id}: ${v}\u202f%`);

  await post(
    `📊 Neue Wahlprognose Bundestag\n\n${new Date(latest.Date).toLocaleDateString('de-DE')} · ${institute}\n\n${lines.join(' · ')}`
  );
  state.lastSurveyHash = hash;
}

// ── Main loop ─────────────────────────────────────────────────────────────────

async function check() {
  console.log(`[bot] check at ${new Date().toISOString()}`);
  const state = await loadState();

  const tasks = [];
  if (POST_VOTES)     tasks.push(() => checkVotes(state));
  if (POST_DONATIONS) tasks.push(() => checkDonations(state));
  if (POST_SURVEYS)   tasks.push(() => checkSurveys(state));

  for (const task of tasks) {
    try { await task(); } catch (err) { console.warn('[bot] task error:', err.message); }
  }

  await saveState(state);
}

// ── Entrypoint ─────────────────────────────────────────────────────────────────

console.log(`[bot] starting — votes=${POST_VOTES} donations=${POST_DONATIONS} surveys=${POST_SURVEYS}`);
await agent.login({ identifier: HANDLE, password: APP_PASSWORD });
console.log(`[bot] logged in as ${HANDLE}`);

await check();
setInterval(check, CHECK_INTERVAL);
console.log(`[bot] interval ${CHECK_INTERVAL / 60_000} min`);

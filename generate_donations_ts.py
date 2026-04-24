"""
Generate per-year donation JSON files from scraped Bundestag data.

Run: python generate_donations_ts.py
Output:
  public/data/donations/YYYY.json  (one per year)
  public/data/donations/manifest.json

NOTE: Output files contain donor names and are gitignored.
      Do NOT commit them. They are served at runtime by the cache-service (Docker)
      or populated locally for development only.
"""
import requests, json, re, os
from bs4 import BeautifulSoup


def clean(text):
    return re.sub(r'\s+', ' ', text.replace('\xa0', ' ').replace('\xad', '')).strip()


def clean_multiline(text):
    """Normalise whitespace per line while preserving the line structure."""
    lines = text.replace('\xa0', ' ').replace('\xad', '').splitlines()
    cleaned = [re.sub(r'[ \t]+', ' ', line).strip() for line in lines]
    return '\n'.join(l for l in cleaned if l)


def parse_amount(s):
    m = re.search(r'([\d.]+(?:,\d+)?)\s*Euro', s)
    if not m:
        return 0
    num = m.group(1).replace('.', '').replace(',', '.')
    try:
        return round(float(num))
    except ValueError:
        return 0


def parse_donation_date(s):
    m = re.search(r'(\d{2})\.(\d{2})\.(\d{4})', s)
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}", int(m.group(3))
    return '', 0


def normalize_party(p):
    p = p.strip()
    u = p.upper()
    if 'GRÜN' in u or u.startswith('BÜNDNIS'):
        return 'Grüne'
    for exact in ('CDU', 'CSU', 'SPD', 'FDP', 'AfD', 'BSW', 'SSW', 'MLPD'):
        if p == exact:
            return exact
    if 'LINKE' in u:
        return 'Linke'
    if 'FREIE WÄHLER' in u:
        return 'Freie Wähler'
    if 'VOLT' in u:
        return 'Volt'
    if 'GERECHTIGKEITSPARTEI' in u or 'TODENHÖFER' in u:
        return 'Todenhöfer'
    if 'PIRATEN' in u:
        return 'Piraten'
    return p


def categorize(raw):
    u = raw.upper()
    if any(x in u for x in ('GMBH', 'AKTIENGESELLSCHAFT', ' AG ', ' AG,', 'OHG',
                             ' KG ', ' KG,', 'HOLDING', 'BETEILIGUNG', 'KLINIK SE',
                             'IMPORT AG')):
        return 'Unternehmen'
    if any(x in u for x in ('E.V.', 'VERBAND', 'GEWERKSCHAFT', 'ELEKTROINDUSTRIE',
                             'VBM', 'GESAMTMETALL', 'KULTURMINISTERIET',
                             'SYDSLESVIGUDVALGET')):
        return 'Verband'
    if 'STIFTUNG' in u:
        return 'Stiftung'
    return 'Privatperson'


def clean_donor(raw):
    s = raw.strip()

    # ── Line-based extraction (preferred when HTML <br> are preserved as \n) ──
    lines = [l for l in s.splitlines() if l.strip()]
    if len(lines) > 1:
        name_lines = []
        for line in lines:
            line = line.strip()
            # Postal code line: "12345 City" or "1234 City" (DE/AT/CH)
            if re.match(r'\d{4,5}\s+\S', line):
                break
            # Street / address suffix (no leading \b — handles "Poststraße" etc.)
            # Avoid generic suffixes: 'berg', 'garten', 'bogen' match common names
            # str. uses lookahead since word-boundary doesn't work after a period
            if re.search(
                r'(?:straße|strasse|weg|gasse|allee|platz|ring|damm|'
                r'gade|chaussée|chaussee|promenade|ufer|road|avenue|boulevard)\b'
                r'|str\.(?=\s|$|\d)',
                line, re.IGNORECASE
            ):
                break
            # Line that ends with a house number (digits, optional letter/hyphen, allows "75 A")
            if re.search(r'\s\d+(?:\s*[a-zA-Z]|[a-zA-Z\-/]+)?\s*$', line) and name_lines:
                break
            # c/o forwarding line
            if re.match(r'c/o\s+', line, re.IGNORECASE):
                break
            name_lines.append(line)
        if name_lines:
            s = ' '.join(name_lines)
        else:
            # Name+address on one line: clean it like a flat string
            s = lines[0]
            s = re.sub(r'\s+\d{4,5}[\s,]+\S.*$', '', s).strip()
            s = re.sub(
                r'\s+[\wäöüÄÖÜß\-]+(?:straße|strasse|weg|allee|platz|ring|gasse|'
                r'damm|gade|chaussée|chaussee|promenade|ufer|markt)\b.*$',
                '', s, flags=re.IGNORECASE).strip()
            s = re.sub(r'\s+[\wäöüÄÖÜß\-]+str\..*$', '', s, flags=re.IGNORECASE).strip()
            s = re.sub(r'\s+c/o\s+.*$', '', s, flags=re.IGNORECASE).strip()
            s = re.sub(r'\s+\d+[a-zA-Z\-/]*\s*$', '', s).strip()
    else:
        # ── Flat-string fallback (separator=' ' or single-line source) ──
        # Split on semicolons
        if ';' in s:
            s = s.split(';')[0].strip()
        # Remove from postal code onwards
        s = re.sub(r'\s+\d{4,5}[\s,]+\S.*$', '', s).strip()
        # Remove street patterns (incl. "Musterstr. 5")
        s = re.sub(
            r'\s+[\wäöüÄÖÜß\-]+(?:straße|strasse|weg|allee|platz|ring|gasse|'
            r'damm|garten|berg|gade|chaussée|chaussee|promenade|bogen|ufer|markt)\b.*$',
            '', s, flags=re.IGNORECASE).strip()
        s = re.sub(r'\s+[\wäöüÄÖÜß\-]+str\..*$', '', s, flags=re.IGNORECASE).strip()
        # Nordic street endings
        s = re.sub(r'\s+[A-ZÄÖÜ][a-zäöü]+(?:gade|vej|alle|gaard)\b.*$', '', s).strip()
        # c/o forwarding
        s = re.sub(r'\s+c/o\s+.*$', '', s, flags=re.IGNORECASE).strip()
        # Trailing standalone house numbers (incl. "75 A" style)
        s = re.sub(r'\s+\d+(?:\s*[a-zA-Z]|[a-zA-Z\-/]*)?\s*$', '', s).strip()

    # Semicolon split (final pass for multiline path too)
    if ';' in s:
        s = s.split(';')[0].strip()

    if len(s) > 90:
        s = s[:90].strip()

    return s if len(s) >= 3 else lines[0][:60].strip() if lines else raw[:60].strip()


def scrape_page(year):
    url = (f"https://www.bundestag.de/parlament/praesidium/"
           f"parteienfinanzierung/fundstellen50000/{year}")
    r = requests.get(url, timeout=30, headers={'User-Agent': 'Mozilla/5.0'})
    # Explicitly decode as UTF-8 so umlauts and special chars survive intact.
    html = r.content.decode('utf-8', errors='replace')
    soup = BeautifulSoup(html, 'html.parser')
    table = soup.find('table')
    if not table:
        return []

    out = []
    for row in table.find_all('tr')[1:]:
        cells = row.find_all(['td', 'th'])
        if len(cells) < 4:
            continue
        # separator=' ' ensures <br> tags produce a space rather than merging adjacent text
        # for most cells; the donor cell uses '\n' to preserve address line structure.
        texts = [clean(c.get_text(separator=' ')) for c in cells]
        # Skip month-header rows (no DD.MM.YYYY date)
        if not any(re.search(r'\d{2}\.\d{2}\.\d{4}', t) for t in texts):
            continue
        donor_raw = clean_multiline(cells[2].get_text(separator='\n'))
        party = normalize_party(texts[0])
        amount = parse_amount(texts[1])
        date, yr = parse_donation_date(texts[3] if len(texts) > 3 else '')

        out.append({
            'page_year': year,
            'date': date,
            'year': year,  # group by page/announcement year (matches Bundestag page org)
            'party': party,
            'amount': amount,
            'donor': clean_donor(donor_raw),
            'donor_raw': donor_raw[:120],
            'category': categorize(donor_raw),
        })
    return out


# ── Scrape ───────────────────────────────────────────────────────────────────
all_raw = []
for yr in [2026, 2025, 2024, 2023, 2022, 2021]:
    entries = scrape_page(yr)
    all_raw.extend(entries)
    by_yr: dict = {}
    for e in entries:
        by_yr[e['year']] = by_yr.get(e['year'], 0) + 1
    print(f"Page {yr}: {len(entries)} rows  |  by donation year: "
          f"{dict(sorted(by_yr.items(), reverse=True))}")

# No dedup — each HTML row is a distinct donation record.
# (The Bundestag sometimes lists genuinely identical-looking entries for
# the same donor on the same day, e.g. multiple SSW monthly payments.)

from collections import Counter
year_counts = Counter(d['year'] for d in all_raw)
print(f"\nTotal (no dedup): {len(all_raw)}")
for yr in sorted(year_counts.keys(), reverse=True):
    print(f"  {yr}: {year_counts[yr]} donations")

# ── Group by year ─────────────────────────────────────────────────────────────
import datetime
today = datetime.date.today().isoformat()

idx_by_year: dict = {}
grouped: dict = {}

for d in sorted(all_raw, key=lambda x: (x['year'], x['date']), reverse=True):
    yr = d['year']
    if yr not in grouped:
        grouped[yr] = []
        idx_by_year[yr] = 0
    idx_by_year[yr] += 1
    entry_id = f"{yr}-{idx_by_year[yr]:03d}"
    grouped[yr].append({
        'id': entry_id,
        'date': d['date'],
        'year': yr,
        'party': d['party'],
        'donor': d['donor'],
        'amount': d['amount'],
        'category': d['category'],
    })

# ── Write per-year JSON files ─────────────────────────────────────────────────
json_dir = os.path.join(os.path.dirname(__file__), 'public', 'data', 'donations')
os.makedirs(json_dir, exist_ok=True)

for yr, entries in sorted(grouped.items(), reverse=True):
    path = os.path.join(json_dir, f"{yr}.json")
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(
            {'year': yr, 'count': len(entries), 'lastUpdated': today,
             'donations': entries},
            f, ensure_ascii=False, indent=2)
    print(f"Written {path}  ({len(entries)} entries)")

manifest = {
    'years': sorted(grouped.keys(), reverse=True),
    'lastUpdated': today,
    'totalCount': len(all_raw),
}
manifest_path = os.path.join(json_dir, 'manifest.json')
with open(manifest_path, 'w', encoding='utf-8') as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)
print(f"Written {manifest_path}  (years: {manifest['years']})")
print(f"\nTotal (no dedup): {len(all_raw)} entries across all years")
print("NOTE: These files are gitignored. Do not commit them.")

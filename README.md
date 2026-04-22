# BTA-Monitor: Parlamentabstimmungsverhalten Visualisierung

Interaktive Website zur grafischen Aufbereitung von Abstimmungsverhalten in EU-Parlament, Bundestag und Landtagen mit detaillierten Analysen, Fraktionsvergleichen und Abweichler-Highlighting.

## Features

✅ **Parlamentauswahl**: EU-Parlament, Bundestag und Landtags-Daten  
✅ **Abstimmungsübersicht**: Filter nach namentlich/nicht namentlich  
✅ **Grafische Ergebnisse**: Pie-Charts und Bar-Charts mit Prozentanteilen  
✅ **Namentliche Abstimmungen**: Tabellarische Auflistung aller Abstimmungen  
✅ **Fraktionsanalyse**: 
  - Geschlossenheit pro Fraktion (Kohäsionsmetriken)
  - Abweichler-Highlighting mit Namen
  - Vergleich der Abstimmungsmuster  
✅ **Responsive Design**: Optimiert für Mobile (< 768px), Tablet (768px-1024px), Desktop (>1024px)  
✅ **Datenquelle**: abgeordnetenwatch-api (CC0 Public Domain)  
✅ **Performance**: Intelligentes Caching mit localStorage, Pagination  

## Installation

```bash
# Repository klonen
git clone https://github.com/Elmontag/bta-monitor.git
cd bta-monitor

# Dependencies installieren
npm install

# Dev-Server starten
npm run dev

# Für Produktion bauen
npm run build
```

## Nutzung

1. **Starteite**: Wähle ein Parlament (Bundestag, EU-Parlament oder Landtag)
2. **Legislaturperiode**: Wähle die gewünschte Legislaturperiode
3. **Abstimmungsliste**: Scrolle durch die Abstimmungen und filtere:
   - Alle Abstimmungen
   - Nur namentliche Abstimmungen
   - Nur nicht-namentliche Abstimmungen
4. **Abstimmungsdetail**: Klick auf eine Abstimmung um zu sehen:
   - Ergebnisgrafiken (Pie + Bar Chart)
   - Namentliche Auflistung aller Abgeordneten mit ihren Votes
   - Fraktionsanalyse mit Abweichler-Highlights
5. **Vergleich**: Markiere bis zu 3 Abstimmungen zum Vergleich von Fraktionsmustern

## Architektur

```
src/
├── api/
│   └── client.ts          # AbgeordnetenwatchAPI Client mit Caching
├── components/
│   ├── ParliamentList.tsx # Parlament- und Periodenwahl
│   ├── VoteList.tsx       # Abstimmungsliste mit Filterung
│   ├── VoteChart.tsx      # Ergebnisgrafiken
│   ├── VoteDetail.tsx     # Namentliche Abstimmungen
│   ├── PartyBreakdown.tsx # Fraktionsanalyse + Abweichler
│   └── ComparisonView.tsx # Vergleichsansicht
├── types/
│   └── api.ts             # TypeScript Typen für abgeordnetenwatch-api
└── App.tsx                # Haupt-App mit State Management
```

## Datenquellen

- **API**: https://www.abgeordnetenwatch.de/api
- **Datenformat**: JSON
- **Lizenz**: CC0 1.0 (Public Domain)
- **Caching**: localStorage (1 Stunde TTL)

## Technologie

- **Frontend**: React 18 + TypeScript
- **Build**: Vite
- **UI**: Tailwind CSS
- **Charts**: Recharts
- **HTTP Client**: Axios
- **Deployment**: GitHub Pages (GitHub Actions)

## Deployment

Das Projekt wird automatisch bei jedem Push zu `main` mit GitHub Actions deployed.

Manuelle Deployment:
```bash
npm run build
# Deploymentfiles sind in ./dist/
```

Die Website ist erreichbar unter:
https://elmontag.github.io/bta-monitor/

## Responsive Breakpoints

- **Mobile** (`<768px`): Kompakte Layouts, gestapelte Cards, angepasste Schriftgrößen
- **Tablet** (`768px - 1024px`): 2-spaltige Layouts, optimierte Padding
- **Desktop** (`>1024px`): 3-spaltige Layouts mit Vollfeature Sidebar

## Performance-Features

- ✅ Intelligentes Caching mit localStorage (1 Stunde Gültigkeit)
- ✅ Paginierung für große Datensätze
- ✅ Batch-Loading für Politikerdaten (max. 20 pro Request)
- ✅ Lazy-Loading von Abstimmungsdetails
- ✅ Optimierte Renders mit React.memo() wo nötig

## Abweichler-Highlighting

Abgeordnete, die gegen die Fraktion abstimmen, werden gekennzeichnet:
- 🔴 **Orange Badge** in der Fraktionsanalyse
- **Tooltips** mit Name und Abstimmungsverhalten
- **Tabellarische Auflistung** in den Abstimmungsdetails

## API-Beispiele

```typescript
// Alle Parlamente abrufen
const parliaments = await api.getParliaments();

// Abstimmungen einer Periode
const { votes, total } = await api.getVotes(parliamentPeriodId);

// Einzelne Abstimmung mit allen Votes
const { results } = await api.getVoteResults(voteId);

// Politikerdaten
const politician = await api.getPolitician(politicianId);
```

## Lizenz

Dieses Projekt steht unter CC0 1.0 Lizenz. Die Daten der abgeordnetenwatch-api sind öffentlich und frei nutzbar.

## Kontakt

Bei Fragen oder Verbesserungsvorschlägen: [GitHub Issues](https://github.com/Elmontag/bta-monitor/issues)

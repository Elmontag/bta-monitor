import { Landmark, Building2 } from 'lucide-react';
import type { Parliament } from '../types/api';

interface LandingPageProps {
  parliaments: Parliament[];
  onSelect: (p: Parliament) => void;
  onSearchOpen: () => void;
  loading: boolean;
  onNavigateLegal: (view: 'impressum' | 'datenschutz') => void;
}

const BUNDESTAG_ID = 5;
const EU_KEYWORDS = ['EU-Parlament', 'Europäisches Parlament', 'Europa'];

function isEU(p: Parliament) {
  return EU_KEYWORDS.some((k) => p.label.includes(k) || (p.label_external_long ?? '').includes(k));
}

function isFederal(p: Parliament) {
  return p.id === BUNDESTAG_ID || isEU(p);
}

export function LandingPage({ parliaments, onSelect, loading, onNavigateLegal }: LandingPageProps) {
  const federal = parliaments
    .filter(isFederal)
    .sort((a) => (a.id === BUNDESTAG_ID ? -1 : 1));
  const states = parliaments
    .filter((p) => !isFederal(p))
    .sort((a, b) => a.label.localeCompare(b.label, 'de'));

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Landmark className="w-10 h-10 text-blue-600" />
          <h1 className="text-4xl font-bold text-slate-900">Parlamentskompass</h1>
        </div>
        <p className="text-lg text-slate-500">
          Analyse parlamentarischer Arbeit in Deutschland und der EU
        </p>
        <p className="text-sm text-slate-400 mt-2">
          Parlament auswählen oder Suche verwenden&nbsp;
          <kbd className="inline text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {federal.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Bundesebene</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {federal.map((p) => (
                  <ParliamentCard key={p.id} parliament={p} onSelect={onSelect} featured />
                ))}
              </div>
            </section>
          )}

          {states.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Landesebene</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {states.map((p) => (
                  <ParliamentCard key={p.id} parliament={p} onSelect={onSelect} featured={false} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <footer className="mt-16 text-center text-xs text-slate-400 space-y-2">
        <p>Daten: abgeordnetenwatch.de (CC0) · Umfragen: dawum.de (ODbL)</p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => onNavigateLegal('impressum')}
            className="hover:text-slate-600 transition-colors underline underline-offset-2"
          >
            Impressum
          </button>
          <span>·</span>
          <button
            onClick={() => onNavigateLegal('datenschutz')}
            className="hover:text-slate-600 transition-colors underline underline-offset-2"
          >
            Datenschutz
          </button>
        </div>
      </footer>
    </div>
  );
}

function ParliamentCard({
  parliament,
  onSelect,
  featured,
}: {
  parliament: Parliament;
  onSelect: (p: Parliament) => void;
  featured: boolean;
}) {
  return (
    <button
      onClick={() => onSelect(parliament)}
      className={`w-full text-left p-5 rounded-xl border transition-all hover:shadow-md ${
        featured
          ? 'bg-slate-800 border-slate-700 hover:bg-slate-700'
          : 'bg-white border-slate-100 shadow-sm hover:border-blue-200'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg flex-shrink-0 ${featured ? 'bg-white/10' : 'bg-blue-50'}`}>
          <Building2 className={`w-5 h-5 ${featured ? 'text-white' : 'text-blue-600'}`} />
        </div>
        <div className="min-w-0">
          <div className={`font-semibold text-sm truncate ${featured ? 'text-white' : 'text-slate-800'}`}>
            {parliament.label_external_long ?? parliament.label}
          </div>
          {parliament.current_project?.label && (
            <div className={`text-xs mt-0.5 truncate ${featured ? 'text-white/60' : 'text-slate-400'}`}>
              {parliament.current_project.label}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

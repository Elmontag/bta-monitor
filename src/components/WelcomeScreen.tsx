interface WelcomeScreenProps {
  hasPeriod: boolean;
}

export function WelcomeScreen({ hasPeriod }: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8 text-center">
      <div className="text-6xl mb-6">📊</div>
      <h2 className="text-2xl font-bold text-slate-700 mb-3">
        Parlamentabstimmungsverhalten
      </h2>
      <p className="text-slate-500 max-w-md leading-relaxed">
        {hasPeriod
          ? 'Wähle links eine Abstimmung aus der Liste, um Ergebnisse, Fraktionsverhalten und Abweichler zu sehen.'
          : 'Wähle links ein Parlament und eine Legislaturperiode, um Abstimmungsdaten zu erkunden.'}
      </p>

      <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-xl">
        {[
          { icon: '🗳️', label: 'Abstimmungsergebnisse', desc: 'Ja/Nein/Enthaltung grafisch' },
          { icon: '🏛️', label: 'Fraktionsverhalten', desc: 'Kohäsion & Abweichler' },
          { icon: '📋', label: 'Alle Stimmen', desc: 'Jedes Mitglied einzeln' },
        ].map((f) => (
          <div key={f.label} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="text-2xl mb-2">{f.icon}</div>
            <div className="text-sm font-semibold text-slate-700">{f.label}</div>
            <div className="text-xs text-slate-500 mt-1">{f.desc}</div>
          </div>
        ))}
      </div>

      <p className="mt-8 text-xs text-slate-400">
        Daten von{' '}
        <a
          href="https://www.abgeordnetenwatch.de"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-slate-600"
        >
          abgeordnetenwatch.de
        </a>{' '}
        · Lizenz CC0 1.0
      </p>
    </div>
  );
}

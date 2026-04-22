import { useState, useEffect } from 'react';
import { Users, Vote, TrendingUp, Banknote, Landmark, ArrowRight, BarChart3 } from 'lucide-react';
import { api, extractLabel } from '../../api/client';
import type { Parliament, ParliamentPeriod, Fraction, CandidacyMandate } from '../../types/api';
import { fractionColors } from '../../utils/voteUtils';

// Derive a solid bar/dot bg class from fractionColors border class
function fractionSolidColor(colors: { border: string }): string {
  return colors.border
    .replace('border-', 'bg-')
    .replace('-300', '-500')
    .replace('-200', '-400');
}

interface OverviewTabProps {
  parliament: Parliament;
  period: ParliamentPeriod;
  onTabChange: (tab: string) => void;
}

interface FractionCount {
  fraction: Fraction;
  count: number;
}

export function OverviewTab({ parliament, period, onTabChange }: OverviewTabProps) {
  const [fractions, setFractions] = useState<Fraction[]>([]);
  const [totalMembers, setTotalMembers] = useState<number | null>(null);
  const [fractionCounts, setFractionCounts] = useState<FractionCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setFractions([]);
    setFractionCounts([]);
    setTotalMembers(null);

    const loadData = async () => {
      const [fractionsData, mandatesData] = await Promise.all([
        api.getFractionsForPeriod(period.id).catch(() => [] as Fraction[]),
        api.getMandatesForPeriod(period.id, 0, 500).catch(() => ({ mandates: [] as CandidacyMandate[], total: 0 })),
      ]);

      setFractions(fractionsData);
      setTotalMembers(mandatesData.total);

      // Count members per fraction from loaded mandates
      const countMap = new Map<number, number>();
      for (const m of mandatesData.mandates) {
        const fm = m.fraction_membership?.[0];
        if (fm) {
          countMap.set(fm.fraction.id, (countMap.get(fm.fraction.id) ?? 0) + 1);
        }
      }

      // Match fractions to counts
      const counted: FractionCount[] = fractionsData
        .map((f) => ({ fraction: f, count: countMap.get(f.id) ?? 0 }))
        .filter((f) => f.count > 0)
        .sort((a, b) => b.count - a.count);

      setFractionCounts(counted);
    };

    loadData().finally(() => setLoading(false));
  }, [period.id]);

  const maxCount = Math.max(...fractionCounts.map((f) => f.count), 1);
  const isBundestag = parliament.id === 5;

  const quickLinks = [
    { tab: 'votes', icon: Vote, label: 'Abstimmungen', desc: 'Namentliche Abstimmungen & Ergebnisse' },
    { tab: 'fractions', icon: Users, label: 'Fraktionen', desc: 'Zusammensetzung & Abstimmungsverhalten' },
    { tab: 'members', icon: Landmark, label: 'Abgeordnete', desc: 'Alle Mitglieder & Profile' },
    { tab: 'polls', icon: TrendingUp, label: 'Umfragen', desc: 'Aktuelle Wahlumfragen (dawum.de)' },
    ...(isBundestag ? [{ tab: 'donations', icon: Banknote, label: 'Spenden', desc: 'Großspenden §25 PartG' }] : []),
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
      {/* Parliament header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {parliament.label_external_long ?? parliament.label}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {period.label}
          {period.start_date_period && (
            <span className="ml-2 text-slate-400">
              · {new Date(period.start_date_period).getFullYear()}
              {period.end_date_period
                ? `–${new Date(period.end_date_period).getFullYear()}`
                : ' – heute'}
            </span>
          )}
        </p>
      </div>

      {/* Composition */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Zusammensetzung</h2>
          {totalMembers !== null && (
            <span className="ml-auto text-xs text-slate-400">{totalMembers} Mandate gesamt</span>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-9 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : fractionCounts.length > 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            {fractionCounts.map(({ fraction, count }) => {
              const name = extractLabel(fraction.label);
              const colors = fractionColors(name);
              const pct = Math.round((count / maxCount) * 100);
              const solidColor = fractionSolidColor(colors);
              return (
                <button
                  key={fraction.id}
                  onClick={() => onTabChange('fractions')}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${solidColor}`} />
                  <span className={`text-sm font-medium w-36 flex-shrink-0 ${colors.text}`}>{name}</span>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${solidColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 w-8 text-right">{count}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : fractions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {fractions.map((f) => {
              const name = extractLabel(f.label);
              const colors = fractionColors(name);
              return (
                <span key={f.id} className={`px-3 py-1 rounded-full text-sm font-medium border ${colors.border} ${colors.bg} ${colors.text}`}>
                  {name}
                </span>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Keine Daten verfügbar.</p>
        )}
      </section>

      {/* Quick links */}
      <section>
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Bereiche</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {quickLinks.map(({ tab, icon: Icon, label, desc }) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all text-left group"
            >
              <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                <Icon className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-slate-800">{label}</div>
                <div className="text-xs text-slate-400 mt-0.5">{desc}</div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors flex-shrink-0" />
            </button>
          ))}
        </div>
      </section>

      <p className="text-xs text-slate-400">
        Daten: abgeordnetenwatch.de (CC0-Lizenz) · Umfragen: dawum.de (ODbL)
      </p>
    </div>
  );
}

import type { ReactNode } from 'react';
import { ChevronLeft, Vote, Users, User, Banknote, ChartBar, LayoutDashboard } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Parliament, ParliamentPeriod } from '../types/api';

export type ParliamentTab = 'overview' | 'votes' | 'fractions' | 'members' | 'donations' | 'polls';

function getTabsForParliament(parliamentId: number): Array<{ id: ParliamentTab; label: string; icon: LucideIcon }> {
  const base: Array<{ id: ParliamentTab; label: string; icon: LucideIcon }> = [
    { id: 'overview', label: 'Übersicht', icon: LayoutDashboard },
    { id: 'votes', label: 'Abstimmungen', icon: Vote },
    { id: 'fractions', label: 'Fraktionen', icon: Users },
    { id: 'members', label: 'Abgeordnete', icon: User },
    { id: 'polls', label: 'Umfragen', icon: ChartBar },
  ];
  if (parliamentId === 5) {
    base.splice(4, 0, { id: 'donations', label: 'Spenden', icon: Banknote });
  }
  return base;
}

interface ParliamentPageProps {
  parliament: Parliament;
  period: ParliamentPeriod;
  periods: ParliamentPeriod[];
  tab: ParliamentTab;
  onHome: () => void;
  onPeriodChange: (p: ParliamentPeriod) => void;
  onTabChange: (t: ParliamentTab) => void;
  children: ReactNode;
}

export function ParliamentPage({
  parliament,
  period,
  periods,
  tab,
  onHome,
  onPeriodChange,
  onTabChange,
  children,
}: ParliamentPageProps) {
  const tabs = getTabsForParliament(parliament.id);

  return (
    <div className="flex flex-1 min-h-0">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-100">
          <button
            onClick={onHome}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-3"
          >
            <ChevronLeft className="w-4 h-4" />
            Zur Übersicht
          </button>
          <h2 className="text-base font-bold text-slate-900 leading-tight">
            {parliament.label_external_long ?? parliament.label}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Legislaturperioden</div>
          {periods.length === 0 ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-8 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {periods.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onPeriodChange(p)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    period.id === p.id
                      ? 'bg-blue-600 text-white font-medium'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Tab bar */}
        <div className="bg-white border-b border-slate-200 px-4 sticky top-0 z-10">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${
                  tab === id
                    ? 'text-blue-600 border-blue-600'
                    : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Vote, Users, User, Banknote, TrendingUp, LayoutDashboard, Menu, X, Heart } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Parliament, ParliamentPeriod } from '../types/api';
import { config } from '../config';

export type ParliamentTab = 'overview' | 'votes' | 'fractions' | 'members' | 'donations' | 'polls';

interface TabDef { id: ParliamentTab; label: string; icon: LucideIcon; periodIndependent?: boolean }

function getTabsForParliament(parliamentId: number): TabDef[] {
  const periodTabs: TabDef[] = [
    { id: 'overview',   label: 'Übersicht',    icon: LayoutDashboard },
    { id: 'votes',      label: 'Abstimmungen', icon: Vote            },
    { id: 'fractions',  label: 'Fraktionen',   icon: Users           },
    { id: 'members',    label: 'Abgeordnete',  icon: User            },
  ];
  const independentTabs: TabDef[] = [];
  if (parliamentId === 5) {
    independentTabs.push({ id: 'donations', label: 'Spenden', icon: Banknote, periodIndependent: true });
  }
  independentTabs.push({ id: 'polls', label: 'Umfragen', icon: TrendingUp, periodIndependent: true });
  return [...periodTabs, ...independentTabs];
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
  period: _period,
  periods: _periods,
  tab,
  onPeriodChange: _onPeriodChange,
  onTabChange,
  children,
}: ParliamentPageProps) {
  const tabs = getTabsForParliament(parliament.id);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* ── Main layout: Sidebar + Content ───────────────────────────── */}
      <div className="flex flex-1 min-h-0 relative">

        {/* Sidebar overlay (mobile) */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Mobile sidebar toggle — now lives beside the breadcrumb row */}
        <button
          className="md:hidden fixed bottom-4 left-4 z-40 p-3 bg-white rounded-full shadow-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label="Menü"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Sidebar */}
        <aside
          className={`
            flex-shrink-0 w-52 bg-white border-r border-slate-200 flex flex-col z-30
            md:relative md:translate-x-0 md:flex
            absolute inset-y-0 left-0 transition-transform duration-200
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
        >
          <nav className="flex-1 p-3">
            {/* Period-relevant tabs */}
            <div className="space-y-0.5">
              {tabs.filter((t) => !t.periodIndependent).map(({ id, label, icon: Icon }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    onClick={() => { onTabChange(id); setSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Separator */}
            <div className="mt-3 mb-2 px-1">
              <div className="border-t border-slate-100" />
              <p className="mt-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2">
                Zeitraumunabhängig
              </p>
            </div>

            {/* Period-independent tabs */}
            <div className="space-y-0.5">
              {tabs.filter((t) => t.periodIndependent).map(({ id, label, icon: Icon }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    onClick={() => { onTabChange(id); setSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                    }`}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-slate-600' : 'text-slate-400'}`} />
                    {label}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Ko-Fi support link at sidebar bottom */}
          <div className="p-3 border-t border-slate-100">
            <a
              href={config.kofiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 hover:border-amber-300 transition-colors"
              title="Projekt unterstützen"
            >
              <Heart className="w-4 h-4 flex-shrink-0 text-amber-500" />
              <span>Projekt unterstützen</span>
            </a>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}

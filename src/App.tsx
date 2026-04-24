import React, { useState, useEffect } from 'react';
import './index.css';
import type { Parliament, ParliamentPeriod, Poll, VoteResult, Fraction } from './types/api';
import { api } from './api/client';
import { setLiveElections } from './data/elections';
import { Navbar } from './components/Navbar';
import { formatPeriodYears } from './utils/periodLabel';
import { LandingPage } from './views/LandingPage';
import { ParliamentPage } from './views/ParliamentPage';
import type { ParliamentTab } from './views/ParliamentPage';
import { VoteListTab } from './views/tabs/VoteListTab';
import { FractionsListTab } from './views/tabs/FractionsListTab';
import { MembersListTab } from './views/tabs/MembersListTab';
import { DonationsTab } from './views/tabs/DonationsTab';
import { PollsTrendTab } from './views/tabs/PollsTrendTab';
import { OverviewTab } from './views/tabs/OverviewTab';
import { VoteDetailView } from './views/VoteDetailView';
import { FractionDetailView } from './views/FractionDetailView';
import { MemberDetailView } from './views/MemberDetailView';
import { SearchOverlay } from './components/SearchOverlay';

type AppView =
  | { page: 'home' }
  | { page: 'parliament'; parliament: Parliament; period: ParliamentPeriod; tab: ParliamentTab }
  | { page: 'vote'; poll: Poll; parliament: Parliament; period: ParliamentPeriod; voteResults?: VoteResult[] }
  | { page: 'fraction'; fractionId: number; fractionName: string; parliament: Parliament; period: ParliamentPeriod; contextVotes?: VoteResult[]; contextPoll?: Poll }
  | { page: 'member'; mandateId: number; mandateName: string; fractionName: string; parliament: Parliament; period: ParliamentPeriod };

const DUMMY_PERIOD: ParliamentPeriod = {
  id: 0, label: '—', start_date_period: '', end_date_period: '',
  type: 'legislature', parliament: { id: 0, label: '—' },
};
const DUMMY_PARLIAMENT: Parliament = { id: 0, label: '—', label_external_long: '—' };

/** Tabs where the selected period actually affects displayed data */
const PERIOD_RELEVANT_TABS: ParliamentTab[] = ['overview', 'votes', 'fractions', 'members'];

export default function App() {
  const [parliaments, setParliaments] = useState<Parliament[]>([]);
  const [loadingParliaments, setLoadingParliaments] = useState(true);
  const [periodsCache, setPeriodsCache] = useState<Record<number, ParliamentPeriod[]>>({});
  const [stack, setStack] = useState<AppView[]>([{ page: 'home' }]);
  const [searchOpen, setSearchOpen] = useState(false);

  const current = stack[stack.length - 1];

  function navigate(view: AppView) {
    setStack((s) => [...s, view]);
  }

  function goBack() {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }

  function goHome() {
    setStack([{ page: 'home' }]);
  }

  useEffect(() => {
    api.getParliaments()
      .then(setParliaments)
      .finally(() => setLoadingParliaments(false));
    // Load live election results from Bundeswahlleiterin cache
    api.getElectionResults().then(setLiveElections).catch(() => {/* use static fallback */});
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  async function getOrLoadPeriods(parliamentId: number): Promise<ParliamentPeriod[]> {
    if (periodsCache[parliamentId]) return periodsCache[parliamentId];
    const data = await api.getParliamentPeriods(parliamentId);
    setPeriodsCache((c) => ({ ...c, [parliamentId]: data }));
    return data;
  }

  async function handleSelectParliament(p: Parliament) {
    const periods = await getOrLoadPeriods(p.id);
    if (periods.length > 0) {
      navigate({ page: 'parliament', parliament: p, period: periods[0], tab: 'overview' });
    }
  }

  function handlePeriodChange(period: ParliamentPeriod) {
    // Update the period on every view in the stack that carries one.
    // This preserves the current tab and page — no jumping to overview.
    setStack((s) => s.map((view) => ('period' in view ? { ...view, period } : view)));
  }

  function handleTabChange(tab: ParliamentTab) {
    setStack((s) => {
      const last = s[s.length - 1];
      if (last.page === 'parliament') {
        return [...s.slice(0, -1), { ...last, tab }];
      }
      // From a detail view: find the parliament view in the stack and pop to it with the new tab
      const parlIdx = s.findIndex((v) => v.page === 'parliament');
      if (parlIdx !== -1) {
        const pv = s[parlIdx] as Extract<AppView, { page: 'parliament' }>;
        const currentPeriod = ('period' in last) ? (last as { period: ParliamentPeriod }).period : pv.period;
        return [...s.slice(0, parlIdx), { ...pv, tab, period: currentPeriod }];
      }
      return s;
    });
  }

  function buildBreadcrumb() {
    if (current.page === 'home') return null;

    type Crumb = { key: string; node: React.ReactNode };
    const crumbs: Crumb[] = [];

    for (let i = 0; i < stack.length; i++) {
      const view = stack[i];
      const isLast = i === stack.length - 1;
      const onClick = isLast ? undefined : () => setStack(stack.slice(0, i + 1));

      const link = (label: string) => onClick
        ? <button onClick={onClick} className="hover:text-slate-700 transition-colors">{label}</button>
        : <span className="text-slate-700 font-medium">{label}</span>;

      if (view.page === 'home') {
        crumbs.push({ key: `home-${i}`, node: link('Start') });
      } else if (view.page === 'parliament') {
        if (crumbs.length === 0) crumbs.push({ key: `parl-${i}`, node: link(view.parliament.label) });
      } else if (view.page === 'vote') {
        if (crumbs.length === 0) crumbs.push({ key: `parl-${i}`, node: <span className="text-slate-500">{view.parliament.label}</span> });
        const title = view.poll.label.length > 45 ? view.poll.label.slice(0, 45) + '…' : view.poll.label;
        crumbs.push({ key: `vote-${i}`, node: link(title) });
      } else if (view.page === 'fraction') {
        if (crumbs.length === 0) crumbs.push({ key: `parl-${i}`, node: <span className="text-slate-500">{view.parliament.label}</span> });
        crumbs.push({ key: `frac-${i}`, node: link(view.fractionName) });
      } else if (view.page === 'member') {
        if (crumbs.length === 0) crumbs.push({ key: `parl-${i}`, node: <span className="text-slate-500">{view.parliament.label}</span> });
        crumbs.push({ key: `mem-${i}`, node: link(view.mandateName) });
      }
    }

    return (
      <nav className="flex items-center gap-1 text-xs text-slate-500">
        {crumbs.map((c, i) => (
          <span key={c.key} className="flex items-center gap-1 flex-shrink-0">
            {i > 0 && <span className="text-slate-300">/</span>}
            {c.node}
          </span>
        ))}
      </nav>
    );
  }

  function buildPeriodSelector() {
    // Period selector is only relevant for certain tabs/views
    const isPeriodRelevant =
      (current.page === 'parliament' && PERIOD_RELEVANT_TABS.includes(current.tab)) ||
      current.page === 'vote' ||
      current.page === 'fraction' ||
      current.page === 'member';

    if (!isPeriodRelevant) return null;
    if (!('parliament' in current)) return null;

    const parliamentId = (current as { parliament: Parliament }).parliament.id;
    const availablePeriods = periodsCache[parliamentId] ?? [];
    if (availablePeriods.length <= 1) return null;

    const currentPeriod = (current as { period: ParliamentPeriod }).period;

    return (
      <div className="flex items-center gap-1">
        {availablePeriods.map((p) => (
          <button
            key={p.id}
            onClick={() => handlePeriodChange(p)}
            className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
              p.id === currentPeriod.id
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {formatPeriodYears(p)}
          </button>
        ))}
      </div>
    );
  }

  function renderView() {
    if (current.page === 'home') {
      return (
        <LandingPage
          parliaments={parliaments}
          onSelect={handleSelectParliament}
          onSearchOpen={() => setSearchOpen(true)}
          loading={loadingParliaments}
        />
      );
    }

    if (current.page === 'parliament') {
      const periods = periodsCache[current.parliament.id] ?? [];
      return (
        <ParliamentPage
          parliament={current.parliament}
          period={current.period}
          periods={periods}
          tab={current.tab}
          onHome={goHome}
          onPeriodChange={handlePeriodChange}
          onTabChange={handleTabChange}
        >
          {current.tab === 'overview' && (
            <OverviewTab
              parliament={current.parliament}
              period={current.period}
              onTabChange={(tab) => handleTabChange(tab as import('./views/ParliamentPage').ParliamentTab)}
            />
          )}
          {current.tab === 'votes' && (
            <VoteListTab
              period={current.period}
              onSelectPoll={(poll) => navigate({
                page: 'vote', poll,
                parliament: current.parliament,
                period: current.period,
              })}
            />
          )}
          {current.tab === 'fractions' && (
            <FractionsListTab
              period={current.period}
              onSelectFraction={(id, name) => navigate({
                page: 'fraction', fractionId: id, fractionName: name,
                parliament: current.parliament,
                period: current.period,
              })}
            />
          )}
          {current.tab === 'members' && (
            <MembersListTab
              period={current.period}
              onSelectMember={(mandateId, name, fractionName) => navigate({
                page: 'member', mandateId, mandateName: name, fractionName,
                parliament: current.parliament,
                period: current.period,
              })}
            />
          )}
          {current.tab === 'donations' && current.parliament.id === 5 && (
            <DonationsTab />
          )}
          {current.tab === 'polls' && (
            <PollsTrendTab parliament={current.parliament} period={current.period} />
          )}
        </ParliamentPage>
      );
    }

    if (current.page === 'vote') {
      const periods = periodsCache[current.parliament.id] ?? [];
      return (
        <ParliamentPage
          parliament={current.parliament}
          period={current.period}
          periods={periods}
          tab="votes"
          onHome={goHome}
          onPeriodChange={handlePeriodChange}
          onTabChange={handleTabChange}
        >
          <VoteDetailView
            poll={current.poll}
            onBack={goBack}
            onSelectFraction={(fractionId, fractionName, votes) => navigate({
              page: 'fraction', fractionId, fractionName,
              parliament: current.parliament,
              period: current.period,
              contextVotes: votes,
              contextPoll: current.poll,
            })}
            onSelectMember={(mandateId, mandateName, fractionName) => navigate({
              page: 'member', mandateId, mandateName, fractionName,
              parliament: current.parliament,
              period: current.period,
            })}
          />
        </ParliamentPage>
      );
    }

    if (current.page === 'fraction') {
      const periods = periodsCache[current.parliament.id] ?? [];
      return (
        <ParliamentPage
          parliament={current.parliament}
          period={current.period}
          periods={periods}
          tab="fractions"
          onHome={goHome}
          onPeriodChange={handlePeriodChange}
          onTabChange={handleTabChange}
        >
          <FractionDetailView
            fractionId={current.fractionId}
            fractionName={current.fractionName}
            period={current.period}
            parliament={current.parliament}
            onBack={goBack}
            onSelectMember={(mandateId, mandateName, fractionName) => navigate({
              page: 'member', mandateId, mandateName, fractionName,
              parliament: current.parliament,
              period: current.period,
            })}
            onSelectPoll={(poll) => navigate({
              page: 'vote', poll,
              parliament: current.parliament,
              period: current.period,
            })}
            contextVotes={current.contextVotes}
            contextPoll={current.contextPoll}
          />
        </ParliamentPage>
      );
    }

    if (current.page === 'member') {
      const periods = periodsCache[current.parliament.id] ?? [];
      return (
        <ParliamentPage
          parliament={current.parliament}
          period={current.period}
          periods={periods}
          tab="members"
          onHome={goHome}
          onPeriodChange={handlePeriodChange}
          onTabChange={handleTabChange}
        >
          <MemberDetailView
            mandateId={current.mandateId}
            mandateName={current.mandateName}
            fractionName={current.fractionName}
            period={current.period}
            parliament={current.parliament}
            onBack={goBack}
            onSelectPoll={(poll) => navigate({
              page: 'vote', poll,
              parliament: current.parliament,
              period: current.period,
            })}
          />
        </ParliamentPage>
      );
    }

    return null;
  }

  async function handleSearchFraction(fraction: Fraction) {
    const periodId = fraction.legislature?.id;
    if (!periodId) return;

    for (const parliament of parliaments) {
      const periods = await getOrLoadPeriods(parliament.id);
      const period = periods.find((entry) => entry.id === periodId);
      if (!period) continue;
      navigate({
        page: 'fraction',
        fractionId: fraction.id,
        fractionName: fraction.label.replace(/\s*\([^)]+\)\s*$/, '').trim(),
        parliament,
        period,
      });
      return;
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar
        onHome={goHome}
        onSearchOpen={() => setSearchOpen(true)}
        breadcrumb={buildBreadcrumb()}
        periodSelector={buildPeriodSelector()}
      />
      {searchOpen && (
        <SearchOverlay
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
          onSelectPoll={(poll) => {
            navigate({ page: 'vote', poll, parliament: DUMMY_PARLIAMENT, period: DUMMY_PERIOD });
          }}
          onSelectMandate={(mandateId, name) => {
            navigate({ page: 'member', mandateId, mandateName: name, fractionName: '', parliament: DUMMY_PARLIAMENT, period: DUMMY_PERIOD });
          }}
          onSelectFraction={handleSearchFraction}
        />
      )}
      <div className="flex-1 flex flex-col">
        {renderView()}
      </div>
    </div>
  );
}

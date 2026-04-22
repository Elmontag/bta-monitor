import { useState, useEffect } from 'react';
import './index.css';
import type { Parliament, ParliamentPeriod, Poll, VoteResult } from './types/api';
import { api } from './api/client';
import { Navbar } from './components/Navbar';
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
    if (current.page === 'parliament') {
      setStack((s) => [
        ...s.slice(0, -1),
        { ...current, period, tab: 'overview' },
      ]);
    }
  }

  function handleTabChange(tab: ParliamentTab) {
    if (current.page === 'parliament') {
      setStack((s) => [
        ...s.slice(0, -1),
        { ...current, tab },
      ]);
    }
  }

  function buildBreadcrumb() {
    if (current.page === 'home') return null;

    const crumbs: { label: string; onClick?: () => void }[] = [];

    for (let i = 0; i < stack.length; i++) {
      const view = stack[i];
      const isLast = i === stack.length - 1;
      const targetIdx = i;
      const onClick = isLast ? undefined : () => setStack(stack.slice(0, targetIdx + 1));

      if (view.page === 'home') {
        crumbs.push({ label: 'Start', onClick });
      } else if (view.page === 'parliament') {
        if (crumbs.length === 0) crumbs.push({ label: view.parliament.label, onClick });
        crumbs.push({ label: view.period.label, onClick });
      } else if (view.page === 'vote') {
        if (crumbs.length === 0) {
          crumbs.push({ label: view.parliament.label });
          crumbs.push({ label: view.period.label });
        }
        const title = view.poll.label.length > 40 ? view.poll.label.slice(0, 40) + '...' : view.poll.label;
        crumbs.push({ label: title, onClick });
      } else if (view.page === 'fraction') {
        if (crumbs.length === 0) {
          crumbs.push({ label: view.parliament.label });
          crumbs.push({ label: view.period.label });
        }
        crumbs.push({ label: view.fractionName, onClick });
      } else if (view.page === 'member') {
        if (crumbs.length === 0) {
          crumbs.push({ label: view.parliament.label });
          crumbs.push({ label: view.period.label });
        }
        crumbs.push({ label: view.mandateName, onClick });
      }
    }

    return (
      <nav className="flex items-center gap-1 text-xs text-slate-500 overflow-x-auto">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1 flex-shrink-0">
            {i > 0 && <span className="text-slate-300">/</span>}
            {c.onClick ? (
              <button onClick={c.onClick} className="hover:text-slate-700 transition-colors">{c.label}</button>
            ) : (
              <span className="text-slate-700 font-medium">{c.label}</span>
            )}
          </span>
        ))}
      </nav>
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
      return (
        <div className="flex-1 overflow-y-auto">
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
        </div>
      );
    }

    if (current.page === 'fraction') {
      return (
        <div className="flex-1 overflow-y-auto">
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
        </div>
      );
    }

    if (current.page === 'member') {
      return (
        <div className="flex-1 overflow-y-auto">
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
        </div>
      );
    }

    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar
        onHome={goHome}
        onSearchOpen={() => setSearchOpen(true)}
        breadcrumb={buildBreadcrumb()}
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
        />
      )}
      <div className="flex-1 flex flex-col">
        {renderView()}
      </div>
    </div>
  );
}


import { useState, useEffect } from 'react';
import './index.css';
import type { Parliament, ParliamentPeriod, Poll, VoteResult } from './types/api';
import { api } from './api/client';
import { Navbar } from './components/Navbar';
import { ParliamentView } from './views/ParliamentView';
import { VoteDetailView } from './views/VoteDetailView';
import { FractionDetailView } from './views/FractionDetailView';
import { MemberDetailView } from './views/MemberDetailView';

type AppView =
  | { page: 'home' }
  | { page: 'parliament'; parliament: Parliament; period: ParliamentPeriod }
  | { page: 'vote'; poll: Poll; parliament: Parliament; period: ParliamentPeriod; voteResults?: VoteResult[] }
  | { page: 'fraction'; fractionId: number; fractionName: string; parliament: Parliament; period: ParliamentPeriod; contextVotes?: VoteResult[]; contextPoll?: Poll }
  | { page: 'member'; mandateId: number; mandateName: string; fractionName: string; parliament: Parliament; period: ParliamentPeriod };

export default function App() {
  const [parliaments, setParliaments] = useState<Parliament[]>([]);
  const [periods, setPeriods] = useState<ParliamentPeriod[]>([]);
  const [selectedParliament, setSelectedParliament] = useState<Parliament | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<ParliamentPeriod | null>(null);
  const [loadingNav, setLoadingNav] = useState(true);

  const [stack, setStack] = useState<AppView[]>([{ page: 'home' }]);
  const current = stack[stack.length - 1];

  function navigate(view: AppView) {
    setStack((s) => [...s, view]);
  }

  function goBack() {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }

  // Load parliaments on mount
  useEffect(() => {
    api.getParliaments()
      .then((data) => {
        setParliaments(data);
        const bundestag = data.find((p) => p.id === 5) ?? data[0];
        if (bundestag) setSelectedParliament(bundestag);
      })
      .finally(() => setLoadingNav(false));
  }, []);

  // Load periods when parliament changes
  useEffect(() => {
    if (!selectedParliament) return;
    api.getParliamentPeriods(selectedParliament.id).then((data) => {
      setPeriods(data);
      if (data.length > 0) {
        const first = data[0];
        setSelectedPeriod(first);
        setStack([{ page: 'parliament', parliament: selectedParliament, period: first }]);
      }
    });
  }, [selectedParliament?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleParliamentChange(p: Parliament) {
    setSelectedParliament(p);
    setPeriods([]);
    setSelectedPeriod(null);
  }

  function handlePeriodChange(p: ParliamentPeriod) {
    setSelectedPeriod(p);
    if (selectedParliament) {
      setStack([{ page: 'parliament', parliament: selectedParliament, period: p }]);
    }
  }

  // Build breadcrumb
  function buildBreadcrumb() {
    if (stack.length <= 1 && current.page === 'home') return null;

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
        const title = view.poll.label.length > 40 ? view.poll.label.slice(0, 40) + '…' : view.poll.label;
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
    if (current.page === 'home' || !selectedParliament || !selectedPeriod) {
      return (
        <div className="flex items-center justify-center h-full min-h-[60vh] text-slate-400 text-sm">
          {loadingNav ? 'Lade Parlamente…' : 'Bitte wähle ein Parlament und eine Legislaturperiode.'}
        </div>
      );
    }

    if (current.page === 'parliament') {
      return (
        <ParliamentView
          parliament={current.parliament}
          period={current.period}
          onSelectPoll={(poll) => navigate({
            page: 'vote',
            poll,
            parliament: current.parliament,
            period: current.period,
          })}
        />
      );
    }

    if (current.page === 'vote') {
      return (
        <VoteDetailView
          poll={current.poll}
          onBack={goBack}
          onSelectFraction={(fractionId, fractionName, votes) => navigate({
            page: 'fraction',
            fractionId,
            fractionName,
            parliament: current.parliament,
            period: current.period,
            contextVotes: votes,
            contextPoll: current.poll,
          })}
          onSelectMember={(mandateId, mandateName, fractionName) => navigate({
            page: 'member',
            mandateId,
            mandateName,
            fractionName,
            parliament: current.parliament,
            period: current.period,
          })}
        />
      );
    }

    if (current.page === 'fraction') {
      return (
        <FractionDetailView
          fractionId={current.fractionId}
          fractionName={current.fractionName}
          period={current.period}
          parliament={current.parliament}
          onBack={goBack}
          onSelectMember={(mandateId, mandateName, fractionName) => navigate({
            page: 'member',
            mandateId,
            mandateName,
            fractionName,
            parliament: current.parliament,
            period: current.period,
          })}
          onSelectPoll={(poll) => navigate({
            page: 'vote',
            poll,
            parliament: current.parliament,
            period: current.period,
          })}
          contextVotes={current.contextVotes}
          contextPoll={current.contextPoll}
        />
      );
    }

    if (current.page === 'member') {
      return (
        <MemberDetailView
          mandateId={current.mandateId}
          mandateName={current.mandateName}
          fractionName={current.fractionName}
          period={current.period}
          parliament={current.parliament}
          onBack={goBack}
          onSelectPoll={(poll) => navigate({
            page: 'vote',
            poll,
            parliament: current.parliament,
            period: current.period,
          })}
        />
      );
    }

    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        parliaments={parliaments}
        periods={periods}
        selectedParliament={selectedParliament}
        selectedPeriod={selectedPeriod}
        loading={loadingNav}
        onParliamentChange={handleParliamentChange}
        onPeriodChange={handlePeriodChange}
        breadcrumb={buildBreadcrumb()}
      />
      <main>
        {renderView()}
      </main>
    </div>
  );
}


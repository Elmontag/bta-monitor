import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { api, extractLabel } from '../api/client';
import type { Poll, CandidacyMandate, Fraction } from '../types/api';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPoll: (poll: Poll) => void;
  onSelectMandate: (mandateId: number, name: string) => void;
  onSelectFraction: (fraction: Fraction) => void;
}

export function SearchOverlay({ isOpen, onClose, onSelectPoll, onSelectMandate, onSelectFraction }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [polls, setPolls] = useState<Poll[]>([]);
  const [mandates, setMandates] = useState<CandidacyMandate[]>([]);
  const [fractions, setFractions] = useState<Fraction[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setPolls([]);
      setMandates([]);
      setFractions([]);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim() || query.length < 2) {
      setPolls([]);
      setMandates([]);
      setFractions([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const [pollResults, mandateResults, fractionResults] = await Promise.all([
          api.searchPolls(query, 8),
          api.searchMandates(query, 10),
          api.searchFractions(query, 8),
        ]);
        setPolls(pollResults);
        setMandates(mandateResults);
        setFractions(fractionResults);
      } catch {
        // ignore search errors
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  if (!isOpen) return null;

  const hasResults = polls.length > 0 || mandates.length > 0 || fractions.length > 0;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 flex items-start justify-center pt-20 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Abstimmungen, Abgeordnete, Fraktionen suchen..."
            className="flex-1 text-base outline-none text-slate-800 placeholder:text-slate-400"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          )}
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {(hasResults || (query.length >= 2 && !loading)) && (
          <div className="max-h-96 overflow-y-auto py-2">
            {polls.length > 0 && (
              <div>
                <div className="px-4 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Abstimmungen</div>
                {polls.map((poll) => (
                  <button
                    key={poll.id}
                    onClick={() => { onSelectPoll(poll); onClose(); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors"
                  >
                    <div className="text-sm font-medium text-slate-800 line-clamp-1">{poll.label}</div>
                    {poll.field_poll_date && (
                      <div className="text-xs text-slate-400 mt-0.5">
                        {new Date(poll.field_poll_date).toLocaleDateString('de-DE')}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {mandates.length > 0 && (
              <div>
                <div className="px-4 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Abgeordnete</div>
                {mandates.map((m) => {
                  const name = extractLabel(m.label);
                  const periodLabel = m.parliament_period?.label ?? '';
                  return (
                    <button
                      key={m.id}
                      onClick={() => { onSelectMandate(m.id, name); onClose(); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors"
                    >
                      <div className="text-sm font-medium text-slate-800">{name}</div>
                      {periodLabel && (
                        <div className="text-xs text-slate-400 mt-0.5">{periodLabel}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {fractions.length > 0 && (
              <div>
                <div className="px-4 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Fraktionen</div>
                {fractions.map((fraction) => {
                  const name = extractLabel(fraction.label);
                  const periodLabel = fraction.legislature?.label ?? '';
                  return (
                    <button
                      key={fraction.id}
                      onClick={() => { onSelectFraction(fraction); onClose(); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors"
                    >
                      <div className="text-sm font-medium text-slate-800">{name}</div>
                      {periodLabel && (
                        <div className="text-xs text-slate-400 mt-0.5">{periodLabel}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {!hasResults && query.length >= 2 && !loading && (
              <div className="px-4 py-6 text-center text-sm text-slate-400">Keine Ergebnisse gefunden.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

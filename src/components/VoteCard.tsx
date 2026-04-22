import { CircleCheck, CircleX } from 'lucide-react';
import type { Poll } from '../types/api';

interface VoteCardProps {
  poll: Poll;
  onClick: () => void;
}

export function VoteCard({ poll, onClick }: VoteCardProps) {
  const topics = poll.field_topics?.slice(0, 3) ?? [];

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-4 group"
    >
      {/* Top row */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${
          poll.field_accepted
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-red-100 text-red-700'
        }`}>
          {poll.field_accepted
            ? <><CircleCheck className="w-3 h-3" /> Angenommen</>
            : <><CircleX className="w-3 h-3" /> Abgelehnt</>
          }
        </span>
        {poll.field_poll_date && (
          <span className="text-xs text-slate-400 flex-shrink-0">
            {new Date(poll.field_poll_date).toLocaleDateString('de-DE', {
              day: '2-digit', month: '2-digit', year: 'numeric',
            })}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2 group-hover:text-blue-700 transition-colors mb-2">
        {poll.label}
      </h3>

      {/* Topic chips */}
      {topics.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {topics.map((t) => (
            <span key={t.id} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-xs rounded-full">
              {t.label}
            </span>
          ))}
          {(poll.field_topics?.length ?? 0) > 3 && (
            <span className="px-2 py-0.5 bg-slate-50 text-slate-400 text-xs rounded-full">
              +{(poll.field_topics?.length ?? 0) - 3}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

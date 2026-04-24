import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import impressumMd from '../legal/impressum.md?raw';
import datenschutzMd from '../legal/datenschutz.md?raw';

type LegalView = 'impressum' | 'datenschutz';

interface LegalPageProps {
  view: LegalView;
  onBack: () => void;
}

const CONTENT: Record<LegalView, string> = {
  impressum: impressumMd,
  datenschutz: datenschutzMd,
};

export function LegalPage({ view, onBack }: LegalPageProps) {
  const content = CONTENT[view];

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <button
        onClick={onBack}
        className="mb-6 text-sm text-blue-600 hover:text-blue-800 transition-colors"
      >
        ← Zurück
      </button>

      <article className="prose prose-slate max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkBreaks]}
          components={{
            h1: ({ children }) => (
              <h1 className="text-2xl font-bold text-slate-900 mb-6 pb-3 border-b border-slate-200">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-lg font-semibold text-slate-800 mt-8 mb-3">{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-base font-semibold text-slate-700 mt-5 mb-2">{children}</h3>
            ),
            p: ({ children }) => (
              <p className="text-sm text-slate-600 leading-relaxed mb-3">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="list-disc list-inside space-y-1 mb-3 text-sm text-slate-600">{children}</ul>
            ),
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {children}
              </a>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-slate-800">{children}</strong>
            ),
            hr: () => <hr className="my-6 border-slate-200" />,
          }}
        >
          {content}
        </ReactMarkdown>
      </article>
    </div>
  );
}

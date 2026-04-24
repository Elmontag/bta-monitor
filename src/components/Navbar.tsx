import { Landmark, Search } from 'lucide-react';

interface NavbarProps {
  onHome: () => void;
  onSearchOpen: () => void;
  breadcrumb?: React.ReactNode;
  periodSelector?: React.ReactNode;
  onNavigateLegal?: (view: 'impressum' | 'datenschutz') => void;
}

export function Navbar({ onHome, onSearchOpen, breadcrumb, periodSelector, onNavigateLegal }: NavbarProps) {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
      <div className="h-14 flex items-center justify-between px-4">
        <button
          onClick={onHome}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <Landmark className="w-5 h-5 text-blue-600" />
          <span className="font-bold text-slate-800 text-sm">Parlamentskompass</span>
        </button>

        <div className="flex items-center gap-1">
          {onNavigateLegal && (
            <>
              <button
                onClick={() => onNavigateLegal('impressum')}
                className="px-2 py-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                Impressum
              </button>
              <button
                onClick={() => onNavigateLegal('datenschutz')}
                className="px-2 py-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                Datenschutz
              </button>
            </>
          )}
          <button
            onClick={onSearchOpen}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Suche öffnen"
          >
            <Search className="w-5 h-5" />
          </button>
        </div>
      </div>

      {(breadcrumb || periodSelector) && (
        <div className="flex items-center justify-between gap-3 px-4 border-t border-slate-100 min-h-[2rem] py-1">
          {breadcrumb && (
            <div className="flex items-center gap-1 text-xs text-slate-500 overflow-x-auto min-w-0 flex-1">
              {breadcrumb}
            </div>
          )}
          {periodSelector && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {periodSelector}
            </div>
          )}
        </div>
      )}
    </header>
  );
}

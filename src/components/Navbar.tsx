import { Landmark, Search } from 'lucide-react';

interface NavbarProps {
  onHome: () => void;
  onSearchOpen: () => void;
  breadcrumb?: React.ReactNode;
}

export function Navbar({ onHome, onSearchOpen, breadcrumb }: NavbarProps) {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
      <div className="h-14 flex items-center justify-between px-4 max-w-7xl mx-auto">
        <button
          onClick={onHome}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <Landmark className="w-5 h-5 text-blue-600" />
          <span className="font-bold text-slate-800 text-sm">Parlamentskompass</span>
        </button>

        <button
          onClick={onSearchOpen}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600"
          aria-label="Suche öffnen"
        >
          <Search className="w-5 h-5" />
        </button>
      </div>

      {breadcrumb && (
        <div className="h-8 flex items-center px-4 max-w-7xl mx-auto border-t border-slate-100">
          {breadcrumb}
        </div>
      )}
    </header>
  );
}

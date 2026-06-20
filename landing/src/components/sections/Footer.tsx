import { Logo } from '@/components/Logo';
import { NAV_LINKS } from '@/lib/site';

export function Footer() {
  return (
    <footer className="border-t border-border-gray bg-off-white px-6 py-14 md:px-10">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <a href="#top" className="flex items-center gap-2.5 text-forest">
            <Logo size={28} />
            <span className="text-lg font-bold tracking-tight">Lumen</span>
          </a>
          <p className="mt-4 text-sm leading-relaxed text-mid-gray">
            A self-hosted research library with AI reading assistance, a built-in
            PDF reader, citation maps, and semantic discovery.
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-12 gap-y-3">
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-sm font-medium text-mid-gray transition-colors hover:text-forest"
            >
              {l.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="mx-auto mt-10 flex max-w-[1180px] flex-col gap-2 border-t border-border-gray pt-6 text-xs text-cool-gray md:flex-row md:items-center md:justify-between">
        <p>© {new Date().getFullYear()} Lumen. Self-hosted research, done right.</p>
        <p>Built for researchers who read a lot.</p>
      </div>
    </footer>
  );
}

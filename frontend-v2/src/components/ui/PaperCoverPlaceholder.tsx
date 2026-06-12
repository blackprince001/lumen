import type { ThemeName } from '@/lib/paper-themes';

/** Themed stand-in for a paper cover (loading, missing file, render failure). */
export function PaperCoverPlaceholder({ theme }: { theme: ThemeName }) {
  return (
    <div
      aria-hidden="true"
      className="flex size-full flex-col gap-1 rounded-[inherit] border p-1.5"
      style={{
        backgroundColor: `var(--theme-${theme}-bg)`,
        borderColor: `var(--theme-${theme}-border)`,
      }}
    >
      <div
        className="h-1.5 w-3/4 rounded-full"
        style={{ backgroundColor: `var(--theme-${theme}-action)` }}
      />
      <div
        className="h-1 w-full rounded-full"
        style={{ backgroundColor: `var(--theme-${theme}-accent)` }}
      />
      <div
        className="h-1 w-5/6 rounded-full"
        style={{ backgroundColor: `var(--theme-${theme}-accent)` }}
      />
    </div>
  );
}

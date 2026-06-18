import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  DocumentText,
  Book1,
  Chart,
  MenuBoard,
  Edit,
  Note1,
  Global,
  User,
  ExportSquare,
} from "iconsax-reactjs";
import {
  referencesApi,
  type ReferenceManifestEntry,
} from "@/lib/api/references";
import { cn } from "@/lib/utils";
import { useReferenceManifest } from "./ReferenceManifestProvider";

interface ReferenceChipProps {
  kind: string;
  id: string;
  label: string;
}

type IconCmp = typeof DocumentText;

const KIND_ICONS: Record<string, IconCmp> = {
  paper: DocumentText,
  citation: Book1,
  figure: Chart,
  section: MenuBoard,
  annotation: Edit,
  note: Note1,
  external: Global,
  author: User,
};

const KIND_LABELS: Record<string, string> = {
  paper: "Paper",
  citation: "Citation",
  figure: "Figure",
  section: "Section",
  annotation: "Annotation",
  note: "Note",
  external: "External",
  author: "Author",
};

const KIND_ICON_TINT: Record<string, string> = {
  paper: "text-sky-600",
  citation: "text-amber-600",
  figure: "text-emerald-600",
  section: "text-violet-600",
  annotation: "text-rose-600",
  note: "text-orange-600",
  external: "text-cyan-600",
  author: "text-indigo-600",
};

const CARD_WIDTH = 288; // 18rem
const VIEWPORT_MARGIN = 8;

interface CardPos {
  top: number;
  left: number;
  width: number;
  placement: "top" | "bottom";
}

function paperIdFromTarget(target: string | null): number | null {
  const m = target?.match(/\/papers\/(\d+)/);
  return m ? Number(m[1]) : null;
}

function useEntry(
  kind: string,
  id: string,
): ReferenceManifestEntry | null | "loading" {
  const context = useReferenceManifest();
  const fromContext = context?.getEntry(kind, id);

  const { data: fetched } = useQuery({
    queryKey: ["ref-resolve", kind, id],
    queryFn: async () => {
      const res = await referencesApi.resolveBatch([{ kind, id }]);
      return res.entries[0] ?? null;
    },
    enabled: !fromContext && !context?.has(kind, id),
    staleTime: 300_000,
  });

  if (fromContext) return fromContext;
  if (fetched === undefined) return "loading";
  return fetched ?? null;
}

export function ReferenceChip({ kind, id, label }: ReferenceChipProps) {
  const entry = useEntry(kind, id);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<CardPos | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const Icon = KIND_ICONS[kind] ?? DocumentText;
  const tint = KIND_ICON_TINT[kind] ?? "text-(--muted-foreground)";
  const kindLabel = KIND_LABELS[kind] ?? kind;

  const resolved = entry !== "loading" && entry !== null ? entry : null;

  const isPlaceholder = !label || label === `${kind}/${id}`;
  const text =
    (!isPlaceholder && label) || resolved?.label || `${kindLabel} ${id}`;
  const target = resolved?.target ?? null;

  const figurePaperId = kind === "figure" ? paperIdFromTarget(target) : null;
  const { data: figureThumb } = useQuery({
    queryKey: ["figure-thumb", figurePaperId, id],
    queryFn: () => referencesApi.figureThumbnail(figurePaperId!, Number(id)),
    enabled:
      open && kind === "figure" && !!figurePaperId && !resolved?.thumbnail_url,
    staleTime: 600_000,
  });
  const thumbnailUrl =
    resolved?.thumbnail_url ?? figureThumb?.thumbnail_url ?? null;

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(CARD_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
    let left = r.left + r.width / 2 - width / 2;
    left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(left, window.innerWidth - width - VIEWPORT_MARGIN),
    );
    // Prefer above the chip; flip below when there isn't room.
    const estimatedHeight = 200;
    const placement: "top" | "bottom" =
      r.top > estimatedHeight + VIEWPORT_MARGIN ? "top" : "bottom";
    const top =
      placement === "top"
        ? r.top - VIEWPORT_MARGIN
        : r.bottom + VIEWPORT_MARGIN;
    setPos({ top, left, width, placement });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePosition]);

  const baseChip =
    "inline-flex items-baseline gap-1 align-baseline border-b border-dotted border-(--border) " +
    "text-(--foreground) transition-colors";

  // Unresolved → quiet, non-interactive (no broken link for a hallucinated id).
  if (entry === null) {
    return (
      <span
        className={cn(baseChip, "opacity-60 cursor-default")}
        title="Reference unavailable"
      >
        <Icon
          size={11}
          className={cn("translate-y-[1px] opacity-50", tint)}
          variant="Bold"
        />
        <span>{text}</span>
      </span>
    );
  }

  const openNow = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const closeSoon = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  const handleNavigate = () => {
    if (!target) return;
    if (/^https?:\/\//.test(target))
      window.open(target, "_blank", "noopener,noreferrer");
    else navigate(target);
  };

  const card =
    open && resolved && pos
      ? createPortal(
          <div
            role="tooltip"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 70,
              transform:
                pos.placement === "top" ? "translateY(-100%)" : undefined,
            }}
            className="bg-(--popover) border border-(--border) rounded-card shadow-elevated"
            onMouseEnter={openNow}
            onMouseLeave={closeSoon}
          >
            <div className="p-3">
              {thumbnailUrl && (
                <img
                  src={thumbnailUrl}
                  alt=""
                  className="w-full h-28 object-contain rounded mb-2 bg-(--muted)"
                />
              )}
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={12} className={tint} variant="Bold" />
                <span className="text-[0.625rem] text-(--muted-foreground) uppercase tracking-wider">
                  {kindLabel}
                </span>
              </div>
              <div className="text-code font-semibold leading-snug mb-0.5">
                {resolved.title}
              </div>
              {resolved.subtitle && (
                <div className="text-caption text-(--muted-foreground) mb-1">
                  {resolved.subtitle}
                </div>
              )}
              {resolved.snippet && (
                <div className="text-caption text-(--muted-foreground) leading-relaxed line-clamp-4">
                  {resolved.snippet}
                </div>
              )}
              {target && (
                <button
                  type="button"
                  onClick={handleNavigate}
                  className="mt-2 inline-flex items-center gap-1 text-caption text-(--sky-blue) hover:opacity-80 transition-opacity"
                >
                  {resolved.internal ? "Open" : "View source"}
                  <ExportSquare size={11} />
                </button>
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onMouseEnter={openNow}
        onMouseLeave={closeSoon}
        onFocus={openNow}
        onBlur={closeSoon}
        onClick={target ? handleNavigate : undefined}
        className={cn(
          baseChip,
          "hover:border-(--foreground)/40",
          target ? "cursor-pointer" : "cursor-default",
        )}
        title={resolved?.title || text}
      >
        <Icon
          size={11}
          className={cn("translate-y-[1px]", tint)}
          variant="Bold"
        />
        <span>{text}</span>
      </button>
      {card}
    </>
  );
}

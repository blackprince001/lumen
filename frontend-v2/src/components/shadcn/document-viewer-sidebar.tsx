"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

const INLINE_THUMBNAIL_SIDEBAR_MIN_WIDTH = 768

export function useElementWidth<TElement extends HTMLElement>() {
  const ref = React.useRef<TElement | null>(null)
  const [width, setWidth] = React.useState(0)

  React.useLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    const updateWidth = () => {
      const nextWidth = element.getBoundingClientRect().width

      // Keep the last real measurement while the element is hidden or
      // detached (keep-alive preview pools, display:none ancestors): a
      // zero-width pass would re-lay-out the viewer for nothing, clearing
      // its rendered canvases, and force a blank-then-repaint flash when
      // the element comes back at its old size.
      if (nextWidth === 0) return
      setWidth(nextWidth)
    }

    updateWidth()

    const observer = new ResizeObserver(updateWidth)
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return [ref, width] as const
}

export function useInlineThumbnailSidebar(width: number) {
  return width >= INLINE_THUMBNAIL_SIDEBAR_MIN_WIDTH
}

export function DocumentViewerThumbnailSidebar({
  children,
  className,
  inline,
  open,
  outlinePanel,
}: {
  children: React.ReactNode
  className?: string
  inline: boolean
  open: boolean
  // PAPERS-FORK: optional outline/TOC panel toggled inside the sidebar.
  outlinePanel?: React.ReactNode
}) {
  const [transitionsReady, setTransitionsReady] = React.useState(false)
  const shouldAnimateSidebar = transitionsReady && open
  const [sidebarView, setSidebarView] = React.useState<"thumbnails" | "outline">("thumbnails")

  React.useEffect(() => {
    let secondFrameId = 0
    const firstFrameId = window.requestAnimationFrame(() => {
      secondFrameId = window.requestAnimationFrame(() => {
        setTransitionsReady(true)
      })
    })

    return () => {
      window.cancelAnimationFrame(firstFrameId)
      window.cancelAnimationFrame(secondFrameId)
    }
  }, [])

  return (
    <aside
      data-document-thumbnail-sidebar=""
      data-sidebar-mode={inline ? "inline" : "overlay"}
      data-sidebar-open={open ? "true" : "false"}
      className={cn(
        "absolute inset-y-0 left-0 z-30 w-40 shrink-0 overflow-hidden border-r bg-sidebar shadow-lg",
        shouldAnimateSidebar
          ? "transition-[translate,margin-left,border-color] duration-200 ease-out"
          : "transition-none",
        inline && "relative z-auto translate-x-0 shadow-none",
        open
          ? "ml-0 translate-x-0"
          : inline
            ? "pointer-events-auto -ml-40 border-r-0"
            : "pointer-events-none -translate-x-full border-r-0",
        className
      )}
    >
      {/* PAPERS-FORK: view toggle header when outlinePanel is provided */}
      {outlinePanel && (
        <div className="flex border-b border-sidebar-border">
          <button
            type="button"
            onClick={() => setSidebarView("thumbnails")}
            className={cn(
              "flex-1 px-2 py-1.5 text-micro font-medium transition-colors",
              sidebarView === "thumbnails"
                ? "bg-sidebar-accent text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
            )}
          >
            Pages
          </button>
          <button
            type="button"
            onClick={() => setSidebarView("outline")}
            className={cn(
              "flex-1 px-2 py-1.5 text-micro font-medium transition-colors",
              sidebarView === "outline"
                ? "bg-sidebar-accent text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
            )}
          >
            Outline
          </button>
        </div>
      )}
      {sidebarView === "thumbnails" ? children : outlinePanel}
    </aside>
  )
}

export function DocumentViewerSidebarSkeleton({ inline }: { inline: boolean }) {
  if (!inline) return null

  return (
    <div className="w-40 shrink-0 border-r bg-sidebar p-4">
      <div className="mx-auto h-28 w-20 overflow-hidden rounded-md bg-background shadow-xs">
        <div className="h-full animate-pulse bg-muted" />
      </div>
      <div className="mx-auto mt-3 h-3 w-10 rounded-full bg-muted" />
    </div>
  )
}

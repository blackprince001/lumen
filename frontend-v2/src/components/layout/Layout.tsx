import { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import ChatPanel from './ChatPanel';
import { TabBar } from './TabBar';

const SIDEBAR_MIN = 52;
const SIDEBAR_SNAP_CLOSE = 140;  // below this → snap to collapsed icon-only mode
const SIDEBAR_DEFAULT = 260;
const SIDEBAR_MAX = 360;

const CHAT_MIN = 52;          // collapsed sliver width
const CHAT_SNAP_CLOSE = 120;  // below this → snap closed
const CHAT_DEFAULT = 360;
const CHAT_MAX = 680;

function ResizeDivider({ onDrag }: { onDrag: (dx: number) => void }) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    lastX.current = e.clientX;
    e.preventDefault();
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      onDrag(e.clientX - lastX.current);
      lastX.current = e.clientX;
    };
    const onMouseUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onDrag]);

  return (
    <div
      onMouseDown={onMouseDown}
      className="hidden md:flex w-1 shrink-0 cursor-col-resize group relative z-10 items-center justify-center py-4"
    >
      <div className="absolute inset-y-0 -left-2 -right-2" />
      <div className="h-full w-px rounded-full bg-transparent transition-colors duration-150" />
      <div className="absolute top-1/2 -translate-y-1/2 flex flex-col gap-[0.25rem] opacity-0 group-hover:opacity-100 transition-opacity">
        {[0,1,2].map(i => (
          <div key={i} className="w-1 h-1 rounded-full bg-[var(--mid-gray)] opacity-80" />
        ))}
      </div>
    </div>
  );
}

export default function Layout() {
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [chatWidth, setChatWidth] = useState(CHAT_MAX);
  const [chatPanelOpen, setChatPanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isPaperDetailPage = /^\/papers\/\d+/.test(location.pathname);

  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);
  
  // Always open ChatPanel at max width when entering or switching paper details
  useEffect(() => {
    if (isPaperDetailPage) {
      setChatPanelOpen(true);
      setChatWidth(CHAT_MAX);
      setActiveTab('details'); // Reset tab to details on new paper entry
    }
  }, [isPaperDetailPage, location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const onSidebarDrag = useCallback((dx: number) => {
    setSidebarWidth((w) => {
      const next = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, w + dx));
      if (next <= SIDEBAR_SNAP_CLOSE) {
        setTimeout(() => setSidebarWidth(SIDEBAR_MIN), 0);
        return SIDEBAR_MIN;
      }
      return next;
    });
  }, []);

  // Chat drag: snap closed when dragged narrow enough
  const onChatDrag = useCallback((dx: number) => {
    setChatWidth((prev) => {
      const next = Math.max(CHAT_MIN, Math.min(CHAT_MAX, prev - dx));
      if (next <= CHAT_SNAP_CLOSE) {
        // Defer the close so we don't setState during render
        setTimeout(() => setChatPanelOpen(false), 0);
        return CHAT_DEFAULT; // reset for next open
      }
      return next;
    });
  }, []);

  const sidebarCollapsed = sidebarWidth <= SIDEBAR_MIN + 20;

  return (
    <div
      className="w-full h-dvh flex overflow-hidden bg-[var(--background)] p-1 gap-[var(--panel-gap)]"
      style={{ backgroundImage: 'linear-gradient(180deg, rgba(60,145,230,0.05) 0%, transparent 26%)' }}
    >
      {/* === Desktop Sidebar — left column === */}
      <div
        className="hidden md:flex shrink-0 min-h-0"
        style={{ width: sidebarWidth }}
      >
        <Sidebar
          isOpen={!sidebarCollapsed}
          onToggle={() =>
            setSidebarWidth(() => (sidebarCollapsed ? SIDEBAR_DEFAULT : SIDEBAR_MIN))
          }
        />
      </div>

      {/* Sidebar resize divider */}
      <ResizeDivider onDrag={onSidebarDrag} />

      {/* === Mobile Sidebar Overlay (scrim) === */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-[60] bg-[rgba(0,0,0,0.4)] md:hidden animate-fade-in"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* === Mobile Sidebar Drawer === */}
      <div
        className={`fixed inset-y-0 left-0 z-[70] w-[15rem] p-1 transform transition-transform duration-300 ease-out md:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar isOpen={true} onToggle={() => setMobileMenuOpen(false)} />
      </div>

      {/* === Center: Navbar + Page === */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden rounded-[var(--panel-radius)] border border-[var(--panel-border)] bg-[var(--panel-surface)] shadow-[var(--shadow-panel)] backdrop-blur-sm">
        <Navbar
          onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
          showChatToggle={isPaperDetailPage && !chatPanelOpen}
          onChatToggle={() => {
            setChatPanelOpen(true);
            setChatWidth(CHAT_DEFAULT);
          }}
        />
        {isPaperDetailPage && <TabBar />}
        <main className={`flex-1 w-full bg-[var(--panel-surface)] ${isPaperDetailPage ? 'overflow-hidden' : 'overflow-auto'}`}>
          <Outlet context={{ 
            chatPanelOpen, 
            setChatPanelOpen,
            activeTab,
            setActiveTab 
          }} />
        </main>
      </div>

      {/* === Chat Panel — right column, only on paper detail === */}
      {isPaperDetailPage && chatPanelOpen && (
        <>
          {/* Chat resize divider */}
          <ResizeDivider onDrag={onChatDrag} />
          <div
            className="shrink-0 hidden md:flex min-h-0"
            style={{ width: chatWidth }}
          >
            <ChatPanel
              isOpen={chatPanelOpen}
              onToggle={() => {
                setChatPanelOpen(false);
                setChatWidth(CHAT_DEFAULT);
              }}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />
          </div>
        </>
      )}
    </div>
  );
}

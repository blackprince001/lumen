import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DocumentText as FileText, CloseCircle as X } from 'iconsax-reactjs';
import { useTabs, type Tab } from '@/contexts/TabContext';
import { cn } from '@/lib/utils';

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, removeTab } = useTabs();
  const navigate = useNavigate();
  const location = useLocation();
  const pendingRemovalRef = useRef<{ tabId: string; wasActive: boolean } | null>(null);

  const handleTabClick = (tab: Tab) => {
    setActiveTab(tab.id);
    navigate(tab.url);
  };

  const handleClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    const wasActive = activeTabId === tabId;
    pendingRemovalRef.current = { tabId, wasActive };
    removeTab(tabId);
    if (wasActive && tabs.length === 1) navigate('/');
  };

  useEffect(() => {
    const pending = pendingRemovalRef.current;
    if (!pending) return;

    const { tabId, wasActive } = pending;
    const stillExists = tabs.some((t) => t.id === tabId);

    if (!stillExists && wasActive && tabs.length > 0) {
      const activeTab = tabs.find((t) => t.id === activeTabId);
      if (activeTab && location.pathname !== activeTab.url) {
        navigate(activeTab.url);
      } else if (!activeTab) {
        const last = tabs[tabs.length - 1];
        if (last) { setActiveTab(last.id); navigate(last.url); }
      }
    } else if (!stillExists && wasActive && tabs.length === 0) {
      if (location.pathname.startsWith('/papers/')) navigate('/');
    }

    pendingRemovalRef.current = null;
  }, [tabs, activeTabId, navigate, setActiveTab, location.pathname]);

  if (tabs.length === 0) return null;

  return (
    <div className="relative bg-[var(--white)] overflow-x-auto border-b border-[var(--border)]">
      <div className="flex items-end gap-0.5 min-h-[2.25rem] bg-[var(--white)]">
        {tabs.map((tab) => {
          const isActive = activeTabId === tab.id;
          return (
            <div
              key={tab.id}
              onClick={() => handleTabClick(tab)}
              className={cn(
                'relative flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg border-x border-t',
                'cursor-pointer transition-colors min-w-0 max-w-[12.5rem] shrink-0',
                isActive
                  ? 'bg-[var(--background)] border-[var(--border)] text-[var(--foreground)] z-10'
                  : 'bg-[var(--white)] border-transparent text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]',
              )}
            >
              <FileText size={12} className="shrink-0 opacity-60" />
              <span className="truncate flex-1 text-caption font-medium">{tab.title}</span>
              <button
                onClick={(e) => handleClose(e, tab.id)}
                aria-label="Close tab"
                className="p-0.5 hover:bg-[var(--border)] rounded shrink-0"
              >
                <X size={11} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { GroupChatPanel } from './GroupChatPanel';

interface GroupChatSidebarProps {
  groupId: number;
  groupName: string;
  onClose: () => void;
}

export function GroupChatSidebar({ groupId, groupName, onClose }: GroupChatSidebarProps) {
  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full md:w-[37.5rem] lg:w-[43.75rem] p-1">
      <div className="h-full rounded-[var(--panel-radius)] border border-[var(--panel-border)] bg-[var(--panel-surface)] shadow-[var(--shadow-panel)] backdrop-blur-sm overflow-hidden">
        <GroupChatPanel groupId={groupId} groupName={groupName} onClose={onClose} />
      </div>
    </div>
  );
}

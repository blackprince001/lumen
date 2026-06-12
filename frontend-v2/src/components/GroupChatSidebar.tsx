import { GroupChatPanel } from './GroupChatPanel';

interface GroupChatSidebarProps {
  groupId: number;
  groupName: string;
  onClose: () => void;
}

export function GroupChatSidebar({ groupId, groupName, onClose }: GroupChatSidebarProps) {
  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full md:w-150 lg:w-175 p-1">
      <div className="h-full rounded-(--panel-radius) border border-(--panel-border) bg-(--panel-surface) shadow-(--shadow-panel) backdrop-blur-sm overflow-hidden">
        <GroupChatPanel groupId={groupId} groupName={groupName} onClose={onClose} />
      </div>
    </div>
  );
}

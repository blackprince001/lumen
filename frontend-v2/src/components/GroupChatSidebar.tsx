import { GroupChatPanel } from './GroupChatPanel';

interface GroupChatSidebarProps {
  groupId: number;
  groupName: string;
  onClose: () => void;
}

export function GroupChatSidebar({ groupId, groupName, onClose }: GroupChatSidebarProps) {
  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full md:w-[37.5rem] lg:w-[43.75rem] bg-[var(--white)] border-l border-[var(--border)] shadow-lg flex flex-col">
      <GroupChatPanel groupId={groupId} groupName={groupName} onClose={onClose} />
    </div>
  );
}

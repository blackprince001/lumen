import { GroupChatPanel } from './GroupChatPanel';

interface GroupChatSidebarProps {
  groupId?: number;
  paperIds?: number[];
  groupName?: string;
  onClose: () => void;
}

/**
 * GroupChatSidebar is a wrapper around GroupChatPanel that provides
 * the slide-in sidebar layout styling. Mirrors the ChatSidebar pattern.
 */
export function GroupChatSidebar({ groupId, paperIds, groupName, onClose }: GroupChatSidebarProps) {
  return (
    <div
      className="fixed inset-y-0 right-0 z-50 w-full md:w-[600px] lg:w-[700px] max-w-full bg-white border-l border-gray-200 shadow-lg flex flex-col"
    >
      <GroupChatPanel
        groupId={groupId}
        paperIds={paperIds}
        groupName={groupName}
        onClose={onClose}
      />
    </div>
  );
}

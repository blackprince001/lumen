import { useChatController } from '@/hooks/use-chat-controller';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SessionPills } from '@/components/chat/SessionPills';
import { ChatMessageList } from '@/components/chat/ChatMessageList';
import { ChatComposer } from '@/components/chat/ChatComposer';

interface ChatTabProps {
  paperId: number;
}

export function ChatTab({ paperId }: ChatTabProps) {
  const controller = useChatController(paperId);

  if (controller.isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Skeleton className="w-12 h-12 rounded-full" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full relative">
        <SessionPills controller={controller} />
        <ChatMessageList controller={controller} />
        <ChatComposer controller={controller} />
      </div>
      <ConfirmDialog {...controller.confirmDialogProps} />
    </>
  );
}

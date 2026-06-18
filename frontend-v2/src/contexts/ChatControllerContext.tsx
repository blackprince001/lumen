import { createContext, useContext, type ReactNode } from "react";
import {
  useChatController,
  type ChatController,
} from "@/hooks/use-chat-controller";

const ChatControllerContext = createContext<ChatController | null>(null);

export function ChatControllerProvider({
  paperId,
  children,
}: {
  paperId: number;
  children: ReactNode;
}) {
  const controller = useChatController(paperId);
  return (
    <ChatControllerContext.Provider value={controller}>
      {children}
    </ChatControllerContext.Provider>
  );
}

export function useSharedChatController(): ChatController {
  const ctx = useContext(ChatControllerContext);
  if (!ctx) {
    throw new Error(
      "useSharedChatController must be used within a ChatControllerProvider",
    );
  }
  return ctx;
}

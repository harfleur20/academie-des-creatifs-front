import { getAccessToken } from "./authSession";
import { apiRequest, getApiBaseUrl } from "./apiClient";

export type MessageUser = {
  id: number;
  full_name: string;
  role: string;
  avatar_url: string | null;
  avatar_initials: string;
};

export type MessageItem = {
  id: number;
  thread_id: number;
  sender_user_id: number | null;
  sender_type: "user" | "system";
  sender_name: string;
  sender_role: string | null;
  sender_avatar_url: string | null;
  sender_avatar_initials: string | null;
  body: string;
  created_at: string;
};

export type MessageThread = {
  id: number;
  subject: string;
  thread_type: "direct" | "support" | "system";
  participants: MessageUser[];
  last_message: MessageItem | null;
  unread_count: number;
  last_message_at: string | null;
  updated_at: string;
};

export type MessageThreadDetail = MessageThread & {
  messages: MessageItem[];
};

export type MessagingSocketEvent =
  | { type: "messages.summary"; unread_count: number }
  | { type: "messages.thread_created"; thread_id: number }
  | { type: "messages.message_created"; thread_id: number; message: MessageItem };

export async function fetchMessageRecipients(): Promise<MessageUser[]> {
  return apiRequest<MessageUser[]>("/messages/recipients");
}

export async function fetchMessagingSummary(): Promise<{ unread_count: number }> {
  return apiRequest<{ unread_count: number }>("/messages/summary");
}

export async function fetchMessageThreads(): Promise<MessageThread[]> {
  return apiRequest<MessageThread[]>("/messages/threads");
}

export async function fetchMessageThread(threadId: number): Promise<MessageThreadDetail> {
  return apiRequest<MessageThreadDetail>(`/messages/threads/${threadId}`);
}

export async function createMessageThread(payload: {
  participant_ids: number[];
  subject: string;
  body: string;
}): Promise<MessageThreadDetail> {
  return apiRequest<MessageThreadDetail>("/messages/threads", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function sendMessage(threadId: number, body: string): Promise<MessageItem> {
  return apiRequest<MessageItem>(`/messages/threads/${threadId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export async function markMessageThreadRead(threadId: number): Promise<void> {
  await apiRequest<void>(`/messages/threads/${threadId}/read`, { method: "PATCH" });
}

export function createMessagingSocket(): WebSocket {
  const base = getApiBaseUrl().replace(/^http/, "ws");
  const token = getAccessToken();
  const url = new URL(`${base}/messages/ws`);
  if (token) {
    url.searchParams.set("token", token);
  }
  return new WebSocket(url);
}

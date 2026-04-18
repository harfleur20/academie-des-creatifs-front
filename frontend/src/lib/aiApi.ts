import { apiRequest } from "./apiClient";

export type AiChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AiChatRequest = {
  message: string;
  formation_title: string;
  module_title?: string;
  lesson_title?: string;
  history: AiChatMessage[];
};

export type AiChatResponse = {
  reply: string;
};

export async function sendAiChatMessage(
  payload: AiChatRequest,
): Promise<AiChatResponse> {
  return apiRequest<AiChatResponse>("/ai/chat", {
    method: "POST",
    body: JSON.stringify(payload),
    timeoutMs: 30000,
  });
}

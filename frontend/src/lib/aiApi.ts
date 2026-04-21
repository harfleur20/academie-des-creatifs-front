import { apiRequest } from "./apiClient";

export type AiChatMessage = {
  role: "user" | "assistant";
  content: string;
  actions?: AiChatAction[];
};

export type AiChatAction = {
  id: string;
  label: string;
  href: string;
  style?: "primary" | "secondary";
};

export type AiChatRequest = {
  message: string;
  formation_title: string;
  module_title?: string;
  lesson_title?: string;
  enrollment_id?: number;
  assistant_mode?:
    | "student_learning"
    | "ecommerce_support"
    | "teacher_assistant"
    | "admin_assistant";
  history: AiChatMessage[];
};

export type AiChatResponse = {
  reply: string;
  actions?: AiChatAction[];
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

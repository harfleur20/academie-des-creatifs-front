import { apiRequest } from "./apiClient";

export type DiagnosticData = {
  first_name: string;
  last_name: string;
  domain: string;
  self_rating: number;
  level: string;
  nationality: string;
  city: string;
  training_type: string;
  whatsapp: string;
  expectations: string;
};

export type SuggestionResponse = {
  suggestions: string[];
  whatsapp_message: string;
};

export function getSuggestions(data: DiagnosticData): Promise<SuggestionResponse> {
  return apiRequest<SuggestionResponse>("/diagnostic/suggest", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

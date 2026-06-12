import { api } from './client';

export interface UserAiSettings {
  id: string;
  provider: string | null;
  api_key: string | null;
  base_url: string | null;
  model: string | null;
  embedding_model: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserAiSettingsUpdate {
  provider?: string | null;
  api_key?: string | null;
  base_url?: string | null;
  model?: string | null;
  embedding_model?: string | null;
}

export interface ProviderInfo {
  type: string;
  display_name: string;
  supports_grounding: boolean;
}

export const userAiSettingsApi = {
  get: () => api.get<UserAiSettings>('/user/ai-settings'),

  upsert: (data: UserAiSettingsUpdate) =>
    api.put<UserAiSettings>('/user/ai-settings', data),

  patch: (data: UserAiSettingsUpdate) =>
    api.patch<UserAiSettings>('/user/ai-settings', data),

  delete: () => api.delete<void>('/user/ai-settings'),

  listProviders: () => api.get<ProviderInfo[]>('/ai/providers'),
};

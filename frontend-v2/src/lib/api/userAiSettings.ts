import { api } from './client';

export interface UserAiSettings {
  id: string;
  provider: string | null;
  api_key: string | null;
  base_url: string | null;
  model: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserAiSettingsUpdate {
  provider?: string | null;
  api_key?: string | null;
  base_url?: string | null;
  model?: string | null;
}

export interface ProviderInfo {
  type: string;
  display_name: string;
  supports_grounding: boolean;
}

export interface ModelInfo {
  provider: string;
  model: string;
  name: string;
  context_length: number;
  source: 'api' | 'self-hosted';
}

export interface ProviderTestRequest {
  provider: string;
  api_key?: string;
  base_url?: string | null;
  model?: string;
}

export interface ProviderTestResponse {
  success: boolean;
  message: string;
}

export const userAiSettingsApi = {
  get: () => api.get<UserAiSettings>('/user/ai-settings'),

  upsert: (data: UserAiSettingsUpdate) =>
    api.put<UserAiSettings>('/user/ai-settings', data),

  patch: (data: UserAiSettingsUpdate) =>
    api.patch<UserAiSettings>('/user/ai-settings', data),

  delete: () => api.delete<void>('/user/ai-settings'),

  listProviders: () => api.get<ProviderInfo[]>('/ai/providers'),

  listModels: () => api.get<ModelInfo[]>('/ai/models'),

  testConnection: (data: ProviderTestRequest) =>
    api.post<ProviderTestResponse>('/ai/providers/test', data),
};

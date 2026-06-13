import { api } from './client';

export interface UserAiProvider {
  id: number;
  user_id: number;
  label: string;
  provider: string;
  has_api_key: boolean;
  base_url: string | null;
  model: string;
  embedding_model: string;
  embedding_dimension: number;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserAiProviderCreate {
  label?: string;
  provider?: string;
  api_key?: string;
  base_url?: string | null;
  model?: string;
  embedding_model?: string;
  embedding_dimension?: number;
  is_default?: boolean;
}

export interface UserAiProviderUpdate {
  label?: string;
  provider?: string;
  api_key?: string;
  base_url?: string | null;
  model?: string;
  embedding_model?: string;
  embedding_dimension?: number;
  is_default?: boolean;
  is_active?: boolean;
}

export const userAiProvidersApi = {
  list: () => api.get<UserAiProvider[]>('/user/ai-providers'),

  create: (data: UserAiProviderCreate) =>
    api.post<UserAiProvider>('/user/ai-providers', data),

  update: (id: number, data: UserAiProviderUpdate) =>
    api.patch<UserAiProvider>(`/user/ai-providers/${id}`, data),

  setDefault: (id: number) =>
    api.put<UserAiProvider>(`/user/ai-providers/${id}/default`, {}),

  delete: (id: number) => api.delete<void>(`/user/ai-providers/${id}`),
};

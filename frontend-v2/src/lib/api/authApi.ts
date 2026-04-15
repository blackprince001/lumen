import { api, fetchApi } from './client';

export interface User {
  id: number;
  email: string;
  display_name: string;
  avatar_url: string | null;
  organization: string | null;
  department: string | null;
  research_field: string | null;
  role: 'user' | 'admin';
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface RefreshResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface ProfileUpdate {
  display_name?: string;
  organization?: string;
  department?: string;
  research_field?: string;
  bio?: string;
}

export const authApi = {
  googleLogin: (idToken: string) =>
    api.post<TokenResponse>('/auth/google', { id_token: idToken }),

  adminLogin: (username: string, password: string) =>
    api.post<TokenResponse>('/auth/admin/login', { username, password }),

  refresh: () =>
    fetchApi<RefreshResponse>('/auth/refresh', { method: 'POST', credentials: 'include' }),

  logout: () =>
    fetchApi<void>('/auth/logout', { method: 'POST', credentials: 'include' }),

  getMe: () => api.get<User>('/auth/me'),

  updateProfile: (data: ProfileUpdate) => api.patch<User>('/auth/me', data),
};

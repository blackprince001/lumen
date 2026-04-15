import { api } from './client';
import type { User } from './authApi';

export interface UserAnalytics extends User {
  is_active: boolean;
  login_count: number;
  last_login_at: string | null;
  papers_uploaded: number;
  annotations_count: number;
  total_reading_minutes: number;
}

export interface AdminUserUpdate {
  is_active?: boolean;
  role?: 'user' | 'admin';
}

export interface UsersListParams {
  page?: number;
  page_size?: number;
  search?: string;
  role?: string;
  is_active?: boolean;
}

export const usersApi = {
  list: (params?: UsersListParams) =>
    api.get<UserAnalytics[]>('/users', { params: params as Record<string, string | number | boolean | undefined> }),

  get: (id: number) => api.get<UserAnalytics>(`/users/${id}`),

  update: (id: number, data: AdminUserUpdate) => api.patch<User>(`/users/${id}`, data),

  delete: (id: number) => api.delete<{ detail: string }>(`/users/${id}`),
};

import { api } from './client';
import { papersApi } from './papers';
import type { Paper } from './papers';

export type { Paper } from './papers';

export interface Group {
  id: number;
  name: string;
  user_id?: number | null;
  parent_id?: number | null;
  description?: string;
  created_at: string;
  updated_at: string;
  papers?: Paper[];
  children?: Group[];
  paper_count?: number;
}

export interface GroupCreate {
  name: string;
  parent_id?: number | null;
  description?: string;
}

export interface GroupUpdate {
  name?: string;
  parent_id?: number | null;
  description?: string;
}

export const groupsApi = {
  list: (): Promise<Group[]> =>
    api.get<Group[]>('/groups'),

  get: (id: number): Promise<Group> =>
    api.get<Group>(`/groups/${id}`),

  create: (group: GroupCreate): Promise<Group> =>
    api.post<Group>('/groups', group),

  update: (id: number, updates: GroupUpdate): Promise<Group> =>
    api.patch<Group>(`/groups/${id}`, updates),

  delete: async (id: number): Promise<void> => {
    await api.delete(`/groups/${id}`);
  },

  updatePaperGroups: (paperId: number, groupIds: number[]): Promise<void> =>
    papersApi.update(paperId, { group_ids: groupIds }).then(() => undefined),
};

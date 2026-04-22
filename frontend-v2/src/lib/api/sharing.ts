import { api } from './client';

export type SharePermission = 'viewer' | 'editor';

export interface ShareRecipient {
  user_id: number;
  email: string;
  display_name: string;
  permission: SharePermission;
  shared_by_id: number | null;
  created_at: string;
}

export interface ShareListResponse {
  shares: ShareRecipient[];
  missing_emails: string[];
  skipped_emails: string[];
}

export const paperSharingApi = {
  share: (paperId: number, emails: string[], permission: SharePermission = 'viewer'): Promise<ShareListResponse> =>
    api.post(`/papers/${paperId}/share`, { emails, permission }),

  list: (paperId: number): Promise<ShareListResponse> =>
    api.get(`/papers/${paperId}/shares`),

  update: (paperId: number, userId: number, permission: SharePermission): Promise<ShareRecipient> =>
    api.patch(`/papers/${paperId}/share/${userId}`, { permission }),

  revoke: async (paperId: number, userId: number): Promise<void> => {
    await api.delete(`/papers/${paperId}/share/${userId}`);
  },

  leave: async (paperId: number): Promise<void> => {
    await api.delete(`/papers/${paperId}/share/me`);
  },
};

export const groupSharingApi = {
  share: (groupId: number, emails: string[], permission: SharePermission = 'viewer'): Promise<ShareListResponse> =>
    api.post(`/groups/${groupId}/share`, { emails, permission }),

  list: (groupId: number): Promise<ShareListResponse> =>
    api.get(`/groups/${groupId}/shares`),

  update: (groupId: number, userId: number, permission: SharePermission): Promise<ShareRecipient> =>
    api.patch(`/groups/${groupId}/share/${userId}`, { permission }),

  revoke: async (groupId: number, userId: number): Promise<void> => {
    await api.delete(`/groups/${groupId}/share/${userId}`);
  },

  leave: async (groupId: number): Promise<void> => {
    await api.delete(`/groups/${groupId}/share/me`);
  },
};

import type { Paper } from '@/lib/api/papers';

export const isOwner = (paper: Paper) => paper.my_permission === 'owner';
export const canEdit = (paper: Paper) => paper.my_permission === 'owner' || paper.my_permission === 'editor';
export const canAnnotate = canEdit;
export const isViewer = (paper: Paper) => paper.my_permission === 'viewer';

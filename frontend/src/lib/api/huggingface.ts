/**
 * HuggingFace Daily Papers API Client
 */

import { api } from './client';

export interface HFAuthor {
  name: string;
  hidden: boolean;
}

export interface HFSubmittedBy {
  fullname: string;
  user: string;
  avatarUrl?: string;
}

export interface HFOrganization {
  name: string;
  fullname: string;
  avatar?: string;
}

export interface HFPaperCore {
  id: string;
  title: string;
  authors: HFAuthor[];
  summary?: string;
  ai_summary?: string;
  ai_keywords: string[];
  upvotes: number;
  publishedAt?: string;
  discussionId?: string;
  projectPage?: string;
  githubRepo?: string;
  githubStars?: number;
}

export interface HFPaperItem {
  paper: HFPaperCore;
  title: string;
  summary?: string;
  thumbnail?: string;
  numComments: number;
  publishedAt?: string;
  submittedBy?: HFSubmittedBy;
  organization?: HFOrganization;
  isAuthorParticipating: boolean;
  paperUrl?: string;
}

export interface HFDailyPapersResponse {
  date: string;
  papers: HFPaperItem[];
  total_count: number;
}

export const huggingfaceApi = {
  /**
   * Fetch daily papers from HuggingFace
   * @param date - Optional date in YYYY-MM-DD format. Defaults to today.
   */
  fetchDailyPapers: async (date?: string): Promise<HFDailyPapersResponse> => {
    const params = date ? { date } : {};
    return api.get<HFDailyPapersResponse>('/huggingface/daily-papers', { params });
  },
};

import client from './client';
import {
  Feedback,
  FeedbackListItem,
  FeedbackCreatePayload,
  FeedbackLimits,
  Tag,
  TagShort,
  TagGrouped,
  TagCreatePayload,
  TagUpdatePayload,
  PaginatedResponse,
} from '../types';

export const feedbackApi = {
  list: async (params?: {
    recipient?: string;
    author?: string;
    task?: string;
    sentiment?: string;
    ordering?: string;
    page?: number;
  }): Promise<PaginatedResponse<FeedbackListItem>> => {
    const { data } = await client.get<PaginatedResponse<FeedbackListItem>>('/api/feedback/', { params });
    return data;
  },

  retrieve: async (id: string): Promise<Feedback> => {
    const { data } = await client.get<Feedback>(`/api/feedback/${id}/`);
    return data;
  },

  create: async (payload: FeedbackCreatePayload): Promise<Feedback> => {
    const { data } = await client.post<Feedback>('/api/feedback/', payload);
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await client.delete(`/api/feedback/${id}/`);
  },

  my: async (params?: { page?: number }): Promise<PaginatedResponse<FeedbackListItem>> => {
    const { data } = await client.get<PaginatedResponse<FeedbackListItem>>('/api/feedback/my/', { params });
    return data;
  },

  received: async (params?: { page?: number }): Promise<PaginatedResponse<FeedbackListItem>> => {
    const { data } = await client.get<PaginatedResponse<FeedbackListItem>>('/api/feedback/received/', { params });
    return data;
  },

  limits: async (): Promise<FeedbackLimits> => {
    const { data } = await client.get<FeedbackLimits>('/api/feedback/limits/');
    return data;
  },

  check: async (payload: { recipient_id: string; task_id: string }): Promise<{ can_give: boolean }> => {
    const { data } = await client.post<{ can_give: boolean }>('/api/feedback/check/', payload);
    return data;
  },
};

export const tagsApi = {
  list: async (params?: { sentiment?: string; is_active?: boolean }): Promise<Tag[]> => {
    const { data } = await client.get('/api/tags/', { params });
    return Array.isArray(data) ? data : data.results ?? [];
  },

  grouped: async (): Promise<TagGrouped> => {
    const { data } = await client.get<TagGrouped>('/api/tags/grouped/');
    return data;
  },

  active: async (): Promise<TagShort[]> => {
    const { data } = await client.get('/api/tags/active/');
    return Array.isArray(data) ? data : data.results ?? [];
  },

  retrieve: async (id: string): Promise<Tag> => {
    const { data } = await client.get<Tag>(`/api/tags/${id}/`);
    return data;
  },

  create: async (payload: TagCreatePayload): Promise<Tag> => {
    const { data } = await client.post<Tag>('/api/tags/', payload);
    return data;
  },

  update: async (id: string, payload: TagUpdatePayload): Promise<Tag> => {
    const { data } = await client.patch<Tag>(`/api/tags/${id}/`, payload);
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await client.delete(`/api/tags/${id}/`);
  },
};
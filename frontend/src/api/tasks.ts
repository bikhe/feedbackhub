import client from './client';
import { Task, TaskListItem, TaskSelect, TaskCreatePayload, TaskUpdatePayload, PaginatedResponse } from '../types';

export const tasksApi = {
  list: async (params?: {
    status?: string;
    priority?: string;
    search?: string;
    ordering?: string;
    page?: number;
  }): Promise<PaginatedResponse<TaskListItem>> => {
    const { data } = await client.get<PaginatedResponse<TaskListItem>>('/api/tasks/', { params });
    return data;
  },

  retrieve: async (id: string): Promise<Task> => {
    const { data } = await client.get<Task>(`/api/tasks/${id}/`);
    return data;
  },

  create: async (payload: TaskCreatePayload): Promise<Task> => {
    const { data } = await client.post<Task>('/api/tasks/', payload);
    return data;
  },

  update: async (id: string, payload: TaskUpdatePayload): Promise<Task> => {
    const { data } = await client.patch<Task>(`/api/tasks/${id}/`, payload);
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await client.delete(`/api/tasks/${id}/`);
  },

  // ИСПРАВЛЕНИЕ: обработка и массива, и пагинации
  active: async (): Promise<TaskSelect[]> => {
    const { data } = await client.get('/api/tasks/active/');
    return Array.isArray(data) ? data : (data.results || []);
  },

  // ИСПРАВЛЕНИЕ: обработка и массива, и пагинации
  forFeedback: async (recipientId: string): Promise<TaskSelect[]> => {
    const { data } = await client.get('/api/tasks/for-feedback/', {
      params: { recipient_id: recipientId },
    });
    return Array.isArray(data) ? data : (data.results || []);
  },
};
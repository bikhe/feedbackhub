import client from './client';
import { User, UserShort, UserCreatePayload, UserUpdatePayload, PaginatedResponse } from '../types';

export const usersApi = {
  list: async (params?: {
    role?: string;
    is_active?: boolean;
    department?: string;
    search?: string;
    ordering?: string;
    page?: number;
  }): Promise<PaginatedResponse<UserShort>> => {
    const { data } = await client.get<PaginatedResponse<UserShort>>('/api/users/', { params });
    return data;
  },

  retrieve: async (id: string): Promise<User> => {
    const { data } = await client.get<User>(`/api/users/${id}/`);
    return data;
  },

  create: async (payload: UserCreatePayload): Promise<User> => {
    const { data } = await client.post<User>('/api/users/', payload);
    return data;
  },

  update: async (id: string, payload: UserUpdatePayload): Promise<User> => {
    const { data } = await client.patch<User>(`/api/users/${id}/`, payload);
    return data;
  },

  deactivate: async (id: string): Promise<void> => {
    await client.delete(`/api/users/${id}/`);
  },

  // ИСПРАВЛЕНИЕ: обработка и массива, и пагинации
  colleagues: async (): Promise<UserShort[]> => {
    const { data } = await client.get('/api/users/colleagues/');
    return Array.isArray(data) ? data : (data.results || []);
  },

  // ИСПРАВЛЕНИЕ: обработка и массива, и пагинации
  employees: async (): Promise<UserShort[]> => {
    const { data } = await client.get('/api/users/employees/');
    return Array.isArray(data) ? data : (data.results || []);
  },
};
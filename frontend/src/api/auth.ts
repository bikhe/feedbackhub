import client from './client';
import { LoginPayload, LoginResponse, User, UserUpdatePayload } from '../types';

export const authApi = {
  login: async (payload: LoginPayload): Promise<LoginResponse> => {
    const { data } = await client.post<LoginResponse>('/api/auth/login/', payload);
    return data;
  },

  logout: async (): Promise<void> => {
    await client.post('/api/auth/logout/');
  },

  me: async (): Promise<User> => {
    const { data } = await client.get<User>('/api/auth/me/');
    return data;
  },

  updateMe: async (payload: UserUpdatePayload): Promise<User> => {
    const { data } = await client.patch<User>('/api/auth/me/', payload);
    return data;
  },

  changePassword: async (payload: { old_password: string; new_password: string }): Promise<void> => {
    await client.post('/api/auth/change-password/', payload);
  },
};
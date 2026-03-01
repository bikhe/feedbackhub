import client from './client';
import {
  AnalyticsSummary,
  UserAnalytics,
  LeaderboardEntry,
  TagAnalytics,
  TrendPoint,
} from '../types';

// ── Адаптеры ──────────────────────────────────────────────────────────────────

const adaptSummary = (data: any): AnalyticsSummary => ({
  total_feedback: data.totals?.feedbacks ?? 0,
  positive_feedback: data.sentiment?.positive ?? 0,
  negative_feedback: data.sentiment?.negative ?? 0,
  positive_rate: data.sentiment?.ratio ?? 0,
  active_users: data.activity?.active_authors_week ?? 0,
  total_users: data.totals?.users ?? 0,
  total_tasks: data.totals?.tasks ?? 0,
  active_tasks: data.totals?.active_tasks ?? 0,
  avg_feedback_per_user: 0,
  period: { start: '', end: '' },
});

const adaptLeaderboard = (data: any): LeaderboardEntry[] => {
  const list = Array.isArray(data) ? data : data.leaderboard ?? [];
  return list.map((item: any) => ({
    rank: item.position ?? 0,
    user: item.user,
    score: item.metrics?.received_positive ?? 0,
    positive_received: item.metrics?.received_positive ?? 0,
    negative_received: item.metrics?.received_negative ?? 0,
    total_received: item.metrics?.received_total ?? 0,
    positive_rate: Math.max(0, item.metrics?.sentiment_score ?? 0),
  }));
};

const adaptByUser = (data: any): UserAnalytics[] => {
  const list = Array.isArray(data) ? data : data.users ?? [];
  return list.map((item: any) => ({
    user: item.user,
    given: item.given?.total ?? 0,
    received: item.received?.total ?? 0,
    positive_received: item.received?.positive ?? 0,
    negative_received: item.received?.negative ?? 0,
    positive_rate: Math.max(0, item.received?.sentiment_score ?? 0),
    tags: item.top_tags?.map((t: any) => t.tag ?? t) ?? [],
  }));
};

const adaptTrends = (data: any): TrendPoint[] => {
  const list = Array.isArray(data) ? data : data.trends ?? [];
  return list.map((item: any) => ({
    date: item.period ?? item.date ?? '',
    total: item.total ?? 0,
    positive: item.positive ?? 0,
    negative: item.negative ?? 0,
  }));
};

const adaptTags = (data: any): TagAnalytics[] => {
  const list = Array.isArray(data) ? data : data.tags ?? [];
  const total = list.reduce((sum: number, t: any) => sum + (t.period_usage ?? t.total_usage ?? 0), 0);
  return list.map((item: any) => ({
    tag: {
      id: item.id,
      name: item.name,
      slug: item.slug ?? '',
      sentiment: item.sentiment ?? 'positive',
      icon: item.icon ?? '🏷️',
      color: item.color ?? '#1890ff',
    },
    count: item.period_usage ?? item.total_usage ?? 0,
    percentage: total > 0
      ? Math.round(((item.period_usage ?? item.total_usage ?? 0) / total) * 1000) / 10
      : 0,
  }));
};

const periodToDays = (period?: string): number => {
  const mapping: Record<string, number> = { week: 7, month: 30, quarter: 90, year: 365, all: 3650 };
  return period ? mapping[period] ?? 30 : 30;
};

// ── API ───────────────────────────────────────────────────────────────────────

export const analyticsApi = {
  summary: async (params?: { period?: string; date_from?: string; date_to?: string }): Promise<AnalyticsSummary> => {
    const { data } = await client.get('/api/analytics/summary/', {
      params: { period: periodToDays(params?.period), date_from: params?.date_from, date_to: params?.date_to },
    });
    return adaptSummary(data);
  },

  byUser: async (params?: { period?: string; date_from?: string; date_to?: string; user_id?: string }): Promise<UserAnalytics[]> => {
    const { data } = await client.get('/api/analytics/by-user/', {
      params: { period: periodToDays(params?.period), date_from: params?.date_from, date_to: params?.date_to, user_id: params?.user_id },
    });
    return adaptByUser(data);
  },

  leaderboard: async (params?: { period?: string; limit?: number; date_from?: string; date_to?: string }): Promise<LeaderboardEntry[]> => {
    const { data } = await client.get('/api/analytics/leaderboard/', {
      params: { period: periodToDays(params?.period), limit: params?.limit, date_from: params?.date_from, date_to: params?.date_to },
    });
    return adaptLeaderboard(data);
  },

  trends: async (params?: { period?: string; date_from?: string; date_to?: string; group_by?: 'day' | 'week' | 'month' }): Promise<TrendPoint[]> => {
    const { data } = await client.get('/api/analytics/trends/', {
      params: { period: periodToDays(params?.period), date_from: params?.date_from, date_to: params?.date_to, group_by: params?.group_by },
    });
    return adaptTrends(data);
  },

  tags: async (params?: { period?: string; sentiment?: string }): Promise<TagAnalytics[]> => {
    const { data } = await client.get('/api/analytics/tags/', {
      params: { period: periodToDays(params?.period), sentiment: params?.sentiment },
    });
    return adaptTags(data);
  },

  export: async (params?: { period?: string; date_from?: string; date_to?: string; format?: 'xlsx' | 'csv'; type?: 'feedbacks' | 'users' | 'summary' | 'full' }): Promise<Blob> => {
    const { data } = await client.get('/api/analytics/export/', {
      params: { type: params?.type ?? 'full', period: periodToDays(params?.period) },
      responseType: 'blob',
    });
    return data;
  },
};

export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
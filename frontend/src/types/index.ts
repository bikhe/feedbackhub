export type UserRole = 'employee' | 'manager' | 'admin';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  patronymic: string;
  full_name: string;
  short_name: string;
  initials: string;
  role: UserRole;
  position: string;
  department: string;
  avatar_color: string;
  is_active: boolean;
  is_manager: boolean;
  is_admin: boolean;
  date_joined: string;
  last_login: string | null;
}

export interface UserShort {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  short_name: string;
  initials: string;
  role: UserRole;
  position: string;
  department: string;
  avatar_color: string;
}

export interface UserCreatePayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  patronymic?: string;
  role: UserRole;
  position?: string;
  department?: string;
  avatar_color?: string;
}

export interface UserUpdatePayload {
  first_name?: string;
  last_name?: string;
  patronymic?: string;
  role?: UserRole;
  position?: string;
  department?: string;
  avatar_color?: string;
  is_active?: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export type TaskStatus = 'active' | 'completed' | 'archived' | 'on_hold';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface TaskSelect {
  id: string;
  title: string;
  code: string;
  status: TaskStatus;
  label: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  code: string;
  status: TaskStatus;
  priority: TaskPriority;
  created_by: UserShort;
  assignees: UserShort[];
  feedback_count: number;
  is_overdue: boolean;
  is_active: boolean;
  deadline: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface TaskListItem {
  id: string;
  title: string;
  code: string;
  status: TaskStatus;
  priority: TaskPriority;
  created_by: UserShort;
  assignee_count: number;
  feedback_count: number;
  is_overdue: boolean;
  deadline: string | null;
  created_at: string;
}

export interface TaskCreatePayload {
  title: string;
  description?: string;
  code?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_ids?: string[];
  deadline?: string | null;
}

export interface TaskUpdatePayload {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_ids?: string[];
  deadline?: string | null;
}

export type TagSentiment = 'positive' | 'negative';

export interface Tag {
  id: string;
  name: string;
  slug: string;
  sentiment: TagSentiment;
  icon: string;
  description: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  feedback_count: number;
  created_at: string;
  updated_at: string;
}

export interface TagShort {
  id: string;
  name: string;
  slug: string;
  sentiment: TagSentiment;
  icon: string;
  color: string;
}

export interface TagGrouped {
  positive: TagShort[];
  negative: TagShort[];
}

export interface TagCreatePayload {
  name: string;
  sentiment: TagSentiment;
  icon?: string;
  description?: string;
  color?: string;
  sort_order?: number;
  is_active?: boolean;
}

export interface TagUpdatePayload extends Partial<TagCreatePayload> {}

export interface Feedback {
  id: string;
  author: UserShort | null;
  recipient: UserShort;
  task: TaskSelect;
  tags: TagShort[];
  tag_names: string[];
  sentiment: TagSentiment | null;
  is_positive: boolean;
  is_negative: boolean;
  comment: string;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
}

export interface FeedbackListItem {
  id: string;
  author: UserShort | { id: null; full_name: string; short_name: string; initials: string; avatar_color: string };
  recipient: UserShort;
  task: TaskSelect;
  tags: TagShort[];
  sentiment: TagSentiment | null;
  comment: string;
  is_anonymous: boolean;
  created_at: string;
}

export interface FeedbackCreatePayload {
  recipient_id: string;
  task_id: string;
  tag_ids: string[];
  comment: string;
  is_anonymous?: boolean;
}

export interface FeedbackLimits {
  today: { used: number; limit: number; remaining: number };
  week: { used: number; limit: number; remaining: number };
  by_colleague: Record<string, number>;
  max_per_colleague: number;
}

export interface AnalyticsSummary {
  total_feedback: number;
  positive_feedback: number;
  negative_feedback: number;
  positive_rate: number;
  active_users: number;
  total_users: number;
  total_tasks: number;
  active_tasks: number;
  avg_feedback_per_user: number;
  period: { start: string; end: string };
}

export interface UserAnalytics {
  user: UserShort;
  given: number;
  received: number;
  positive_received: number;
  negative_received: number;
  positive_rate: number;
  tags: TagShort[];
}

export interface LeaderboardEntry {
  rank: number;
  user: UserShort;
  score: number;
  positive_received: number;
  negative_received: number;
  total_received: number;
  positive_rate: number;
}

export interface TagAnalytics {
  tag: TagShort;
  count: number;
  percentage: number;
}

export interface TrendPoint {
  date: string;
  total: number;
  positive: number;
  negative: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiError {
  detail?: string;
  [key: string]: unknown;
}
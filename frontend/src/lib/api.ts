import { getAccessToken, getRefreshToken } from "./auth";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type ApiOptions = {
  method?: HttpMethod;
  data?: unknown;
  signal?: AbortSignal;
};

export type AuthTokens = {
  access: string;
  refresh: string;
  username?: string;
  email?: string;
};

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type DSAProblem = {
  id: number;
  title: string;
  platform: "LEETCODE" | "GFG" | "CUSTOM";
  link: string;
  difficulty: number;
  tags: string[];
  statement: string;
  solution_notes: string;
  workspace_notes: string;
  approaches_json: Array<{ id?: number | string; title?: string; notes?: string }>;
  bucket_labels: string[];
  is_important: boolean;
  is_done: boolean;
  attempts_count: number;
  created_at: string;
  updated_at: string;
};

export type DSAAttempt = {
  id: number;
  problem: number;
  status: "UNSOLVED" | "PARTIAL" | "SOLVED";
  time_taken_minutes: number;
  mistakes: string;
  notes: string;
  created_at: string;
};

export type DesignTopic = {
  id: number;
  title: string;
  category: "HLD" | "LLD" | "DB" | "CACHE" | "QUEUE" | "SCALING" | "CONSISTENCY";
  tags: string[];
  notes_markdown: string;
  tradeoffs: string;
  references_json: Array<string | { label?: string; url?: string }>;
  bucket_labels: string[];
  is_important: boolean;
  is_done: boolean;
  canvas_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type StudySession = {
  id: number;
  date: string;
  duration_minutes: number;
  focus_area: "DSA" | "DESIGN" | "MIXED";
  notes: string;
  created_at: string;
};

export type ReviewItem = {
  id: number;
  item_type: "DSA_PROBLEM" | "DESIGN_TOPIC";
  ref_id: number;
  next_review_at: string;
  interval_days: number;
};

export type AnalyticsSummary = {
  attempts_solved_count: number;
  attempts_total_count: number;
  avg_time_by_difficulty: Record<string, number>;
  top_tags_by_attempts: Array<{ tag: string; count: number }>;
  design_topics_by_category: Array<{ category: string; count: number }>;
  recent_activity: Array<{
    type: string;
    title: string;
    detail: string;
    occurred_at: string;
  }>;
};

const apiFetch = async <T>(path: string, options: ApiOptions = {}): Promise<T> => {
  const { method = "GET", data, signal } = options;
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  const text = await response.text();
  if (!text) {
    return null as T;
  }
  return JSON.parse(text) as T;
};

const buildQuery = (params: Record<string, string | number | undefined>) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
};

export const listDsaProblems = (params: {
  search?: string;
  platform?: string;
  difficulty_min?: number;
  difficulty_max?: number;
  tags?: string;
} = {}) =>
  apiFetch<Paginated<DSAProblem>>(`/api/dsa/problems/${buildQuery(params)}`);

export const getDsaProblem = (id: number) => apiFetch<DSAProblem>(`/api/dsa/problems/${id}/`);

export const createDsaProblem = (data: Partial<DSAProblem>) =>
  apiFetch<DSAProblem>("/api/dsa/problems/", { method: "POST", data });

export const updateDsaProblem = (id: number, data: Partial<DSAProblem>) =>
  apiFetch<DSAProblem>(`/api/dsa/problems/${id}/`, { method: "PATCH", data });

export const deleteDsaProblem = (id: number) =>
  apiFetch<void>(`/api/dsa/problems/${id}/`, { method: "DELETE" });

export const listProblemAttempts = (problemId: number) =>
  apiFetch<DSAAttempt[]>(`/api/dsa/problems/${problemId}/attempts/`);

export const createProblemAttempt = (problemId: number, data: Partial<DSAAttempt>) =>
  apiFetch<DSAAttempt>(`/api/dsa/problems/${problemId}/attempts/`, { method: "POST", data });

export const listDesignTopics = (params: {
  search?: string;
  category?: string;
  tags?: string;
} = {}) =>
  apiFetch<Paginated<DesignTopic>>(`/api/design/topics/${buildQuery(params)}`);

export const getDesignTopic = (id: number) => apiFetch<DesignTopic>(`/api/design/topics/${id}/`);

export const createDesignTopic = (data: Partial<DesignTopic>) =>
  apiFetch<DesignTopic>("/api/design/topics/", { method: "POST", data });

export const updateDesignTopic = (id: number, data: Partial<DesignTopic>) =>
  apiFetch<DesignTopic>(`/api/design/topics/${id}/`, { method: "PATCH", data });

export const deleteDesignTopic = (id: number) =>
  apiFetch<void>(`/api/design/topics/${id}/`, { method: "DELETE" });

export const listStudySessions = () =>
  apiFetch<Paginated<StudySession>>("/api/study/sessions/");

export const createStudySession = (data: Partial<StudySession>) =>
  apiFetch<StudySession>("/api/study/sessions/", { method: "POST", data });

export const getDueReviews = (days = 0) =>
  apiFetch<ReviewItem[]>(`/api/reviews/due${buildQuery({ days })}`);

export const getAnalyticsSummary = (days = 30) =>
  apiFetch<AnalyticsSummary>(`/api/analytics/summary${buildQuery({ days })}`);

export const createReviewItem = (data: Partial<ReviewItem>) =>
  apiFetch<ReviewItem>("/api/reviews/", { method: "POST", data });

export const registerUser = (data: { username: string; password: string; email?: string }) =>
  apiFetch<{ id: number; username: string; email: string }>("/api/auth/register", {
    method: "POST",
    data,
  });

export const loginUser = (data: { username: string; password: string }) =>
  apiFetch<AuthTokens>("/api/auth/token", {
    method: "POST",
    data,
  });

export const refreshToken = (refresh?: string) =>
  apiFetch<AuthTokens>("/api/auth/token/refresh", {
    method: "POST",
    data: { refresh: refresh ?? getRefreshToken() },
  });

export const logoutUser = (refresh?: string) =>
  apiFetch<{ detail: string }>("/api/auth/logout", {
    method: "POST",
    data: { refresh: refresh ?? getRefreshToken() },
  });

export const loginWithGoogle = (credential: string) =>
  apiFetch<AuthTokens>("/api/auth/google", {
    method: "POST",
    data: { credential },
  });

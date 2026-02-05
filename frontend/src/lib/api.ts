import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  isTokenExpired,
  setAuthTokens,
} from "./auth";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type ApiOptions = {
  method?: HttpMethod;
  data?: unknown;
  signal?: AbortSignal;
};

type RefreshPayload = {
  access: string;
  refresh?: string;
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

export type OwnerSummary = {
  id: number;
  name: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  last_active_at?: string | null;
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
  approaches_json: Array<{ id?: number | string; title?: string; notes?: string }>;
  bucket_labels: string[];
  is_global: boolean;
  global_key: string | null;
  is_important: boolean;
  is_done: boolean;
  attempts_count: number;
  created_at: string;
  updated_at: string;
  owner?: OwnerSummary;
  is_owner?: boolean;
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
  is_global: boolean;
  global_key: string | null;
  is_important: boolean;
  is_done: boolean;
  canvas_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  owner?: OwnerSummary;
  is_owner?: boolean;
};

export type StudySession = {
  id: number;
  date: string;
  start_time?: string | null;
  duration_minutes: number;
  focus_area: "DSA" | "DESIGN" | "MIXED";
  notes: string;
  calendar_event_id: string;
  calendar_event_link: string;
  calendar_error: string;
  calendar_synced_at: string | null;
  created_at: string;
};

export type StudySessionInput = Partial<StudySession> & {
  sync_to_calendar?: boolean;
  start_time?: string;
  time_zone?: string;
};

export type ReviewItem = {
  id: number;
  item_type: "DSA_PROBLEM" | "DESIGN_TOPIC";
  ref_id: number;
  next_review_at: string;
  interval_days: number;
  calendar_event_id?: string;
  calendar_event_link?: string;
  calendar_error?: string;
  calendar_synced_at?: string | null;
};

export type ReviewItemInput = Partial<ReviewItem> & {
  sync_to_calendar?: boolean;
  time_zone?: string;
};

export type CustomSection = {
  id: number;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
};

export type CustomSubsection = {
  id: number;
  section: number;
  title: string;
  created_at: string;
  updated_at: string;
};

export type CustomQuestion = {
  id: number;
  subsection: number;
  title: string;
  solution_json: unknown;
  references_json?: Array<string | { label?: string; url?: string }>;
  is_done?: boolean;
  created_at: string;
  updated_at: string;
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

export type CalendarStatus = {
  connected: boolean;
  email?: string;
  calendar_id?: string;
};

export type BuddyRelationship = {
  id: number;
  status: "PENDING" | "ACCEPTED" | "BLOCKED";
  direction: "outgoing" | "incoming" | "accepted";
  created_at: string;
  updated_at: string;
  buddy: OwnerSummary;
};

export type MergedEntry = {
  id: string;
  type: string;
  content: unknown;
  language: string | null;
  createdAt: string;
  owner: OwnerSummary;
};

export type MergedProblemDetail = {
  problem: DSAProblem;
  entries: MergedEntry[];
  current_user_id: number;
};

export type MergedTopicDetail = {
  topic: DesignTopic;
  entries: MergedEntry[];
  current_user_id: number;
};

export type MergedCustomQuestionDetail = {
  question: CustomQuestion;
  entries: MergedEntry[];
  current_user_id: number;
};

const requestRefreshToken = async (refreshToken: string): Promise<RefreshPayload | null> => {
  if (isTokenExpired(refreshToken, 0)) return null;
  const response = await fetch(`${API_BASE_URL}/api/auth/token/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: refreshToken }),
  });
  if (!response.ok) return null;
  return (await response.json()) as RefreshPayload;
};

export const refreshAuthTokens = async () => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  const payload = await requestRefreshToken(refreshToken);
  if (!payload?.access) return null;
  setAuthTokens(payload.access, payload.refresh ?? refreshToken);
  return payload;
};

const apiFetch = async <T>(
  path: string,
  options: ApiOptions = {},
  allowRetry = true
): Promise<T> => {
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

  if (response.status === 401 && allowRetry) {
    const refreshed = await refreshAuthTokens();
    if (refreshed?.access) {
      return apiFetch<T>(path, options, false);
    }
    clearAuthTokens();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Session expired.");
  }

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
  apiFetch<Paginated<DSAProblem>>(
    `/api/dsa/problems/${buildQuery({ page_size: 1000, ...params })}`
  );

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
  apiFetch<Paginated<DesignTopic>>(
    `/api/design/topics/${buildQuery({ page_size: 1000, ...params })}`
  );

export const getDesignTopic = (id: number) => apiFetch<DesignTopic>(`/api/design/topics/${id}/`);

export const createDesignTopic = (data: Partial<DesignTopic>) =>
  apiFetch<DesignTopic>("/api/design/topics/", { method: "POST", data });

export const updateDesignTopic = (id: number, data: Partial<DesignTopic>) =>
  apiFetch<DesignTopic>(`/api/design/topics/${id}/`, { method: "PATCH", data });

export const deleteDesignTopic = (id: number) =>
  apiFetch<void>(`/api/design/topics/${id}/`, { method: "DELETE" });

export const listStudySessions = () =>
  apiFetch<Paginated<StudySession>>("/api/study/sessions/");

export const createStudySession = (data: StudySessionInput) =>
  apiFetch<StudySession>("/api/study/sessions/", { method: "POST", data });

export const getDueReviews = (days = 0) =>
  apiFetch<ReviewItem[]>(`/api/reviews/due${buildQuery({ days })}`);

export const getAnalyticsSummary = (days = 30) =>
  apiFetch<AnalyticsSummary>(`/api/analytics/summary${buildQuery({ days })}`);

export const createReviewItem = (data: ReviewItemInput) =>
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

export const refreshToken = async (refresh?: string) => {
  const token = refresh ?? getRefreshToken();
  if (!token) throw new Error("Refresh token missing.");
  const payload = await requestRefreshToken(token);
  if (!payload?.access) {
    throw new Error("Session expired.");
  }
  setAuthTokens(payload.access, payload.refresh ?? token);
  return { access: payload.access, refresh: payload.refresh ?? token };
};

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

export const getCalendarStatus = () =>
  apiFetch<CalendarStatus>("/api/calendar/status");

export const getCalendarConnectUrl = () =>
  apiFetch<{ auth_url: string }>("/api/calendar/connect");

export const disconnectCalendar = () =>
  apiFetch<{ detail: string }>("/api/calendar/disconnect", { method: "POST" });

export const listBuddies = () =>
  apiFetch<{ relationships: BuddyRelationship[] }>("/api/buddies");

export const searchBuddies = (query: string) =>
  apiFetch<{ results: OwnerSummary[] }>(`/api/buddies/search${buildQuery({ query })}`);

export const requestBuddy = (identifier: string) =>
  apiFetch<BuddyRelationship>("/api/buddies/request", {
    method: "POST",
    data: { identifier },
  });

export const acceptBuddy = (relationshipId: number) =>
  apiFetch<BuddyRelationship>("/api/buddies/accept", {
    method: "POST",
    data: { relationship_id: relationshipId },
  });

export const removeBuddy = (relationshipId: number) =>
  apiFetch<{ detail: string }>("/api/buddies/remove", {
    method: "POST",
    data: { relationship_id: relationshipId },
  });

export const listCustomSections = () =>
  apiFetch<CustomSection[]>("/api/custom/sections/");

export const createCustomSection = (data: Partial<CustomSection>) =>
  apiFetch<CustomSection>("/api/custom/sections/", { method: "POST", data });

export const updateCustomSection = (id: number, data: Partial<CustomSection>) =>
  apiFetch<CustomSection>(`/api/custom/sections/${id}/`, { method: "PATCH", data });

export const deleteCustomSection = (id: number) =>
  apiFetch<void>(`/api/custom/sections/${id}/`, { method: "DELETE" });

export const listCustomSubsections = (sectionId: number) =>
  apiFetch<CustomSubsection[]>(`/api/custom/subsections${buildQuery({ section: sectionId })}`);

export const createCustomSubsection = (data: Partial<CustomSubsection>) =>
  apiFetch<CustomSubsection>("/api/custom/subsections/", { method: "POST", data });

export const updateCustomSubsection = (id: number, data: Partial<CustomSubsection>) =>
  apiFetch<CustomSubsection>(`/api/custom/subsections/${id}/`, { method: "PATCH", data });

export const deleteCustomSubsection = (id: number) =>
  apiFetch<void>(`/api/custom/subsections/${id}/`, { method: "DELETE" });

export const listCustomQuestions = (sectionId: number) =>
  apiFetch<CustomQuestion[]>(`/api/custom/questions${buildQuery({ section: sectionId })}`);

export const createCustomQuestion = (data: Partial<CustomQuestion>) =>
  apiFetch<CustomQuestion>("/api/custom/questions/", { method: "POST", data });

export const updateCustomQuestion = (id: number, data: Partial<CustomQuestion>) =>
  apiFetch<CustomQuestion>(`/api/custom/questions/${id}/`, { method: "PATCH", data });

export const deleteCustomQuestion = (id: number) =>
  apiFetch<void>(`/api/custom/questions/${id}/`, { method: "DELETE" });

export const listMergedDsaProblems = (params: {
  search?: string;
  difficulty_min?: number;
  difficulty_max?: number;
  tags?: string;
} = {}) =>
  apiFetch<Paginated<DSAProblem>>(
    `/api/merged/dsa/problems${buildQuery({ page_size: 1000, ...params })}`
  );

export const listMergedDesignTopics = (params: {
  search?: string;
  category?: string;
  tags?: string;
} = {}) =>
  apiFetch<Paginated<DesignTopic>>(
    `/api/merged/design/topics${buildQuery({ page_size: 1000, ...params })}`
  );

export const getMergedProblemDetail = (id: number) =>
  apiFetch<MergedProblemDetail>(`/api/merged/problems/${id}`);

export const getMergedTopicDetail = (id: number) =>
  apiFetch<MergedTopicDetail>(`/api/merged/topics/${id}`);

export const getMergedCustomQuestionDetail = (id: number) =>
  apiFetch<MergedCustomQuestionDetail>(`/api/merged/custom/questions/${id}`);

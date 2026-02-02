export type DsaProblem = {
  id: number;
  title: string;
  platform: "LeetCode" | "GFG" | "Custom";
  difficulty: number;
  tags: string[];
  status: "Solved" | "Partial" | "Unsolved";
  attempts: number;
  lastAttempt: string;
};

export type DsaAttempt = {
  id: number;
  status: "Solved" | "Partial" | "Unsolved";
  timeMinutes: number;
  notes: string;
  createdAt: string;
};

export type DesignTopic = {
  id: number;
  title: string;
  category: "HLD" | "LLD" | "DB" | "Cache" | "Queue" | "Scaling" | "Consistency";
  tags: string[];
  updatedAt: string;
  notes: string;
};

export type ReviewItem = {
  id: number;
  type: "DSA" | "Design";
  title: string;
  dueInDays: number;
  lastReviewed: string;
};

export type StudySession = {
  id: number;
  date: string;
  duration: number;
  focus: "DSA" | "Design" | "Mixed";
  notes: string;
};

export type ActivityItem = {
  id: number;
  type: "Attempt" | "Design" | "Session";
  title: string;
  detail: string;
  time: string;
};

export const dsaProblems: DsaProblem[] = [
  {
    id: 1,
    title: "Two Sum",
    platform: "LeetCode",
    difficulty: 2,
    tags: ["arrays", "hashmap"],
    status: "Solved",
    attempts: 2,
    lastAttempt: "2026-01-30",
  },
  {
    id: 2,
    title: "Median of Two Sorted Arrays",
    platform: "LeetCode",
    difficulty: 5,
    tags: ["binary-search"],
    status: "Partial",
    attempts: 3,
    lastAttempt: "2026-01-29",
  },
  {
    id: 3,
    title: "LRU Cache",
    platform: "Custom",
    difficulty: 4,
    tags: ["design", "hashmap"],
    status: "Solved",
    attempts: 1,
    lastAttempt: "2026-01-28",
  },
  {
    id: 4,
    title: "Rotate Matrix",
    platform: "GFG",
    difficulty: 3,
    tags: ["matrix"],
    status: "Unsolved",
    attempts: 2,
    lastAttempt: "2026-01-27",
  },
  {
    id: 5,
    title: "Detect Cycle in Directed Graph",
    platform: "GFG",
    difficulty: 4,
    tags: ["graphs", "dfs"],
    status: "Partial",
    attempts: 2,
    lastAttempt: "2026-01-26",
  },
  {
    id: 6,
    title: "Trapping Rain Water",
    platform: "LeetCode",
    difficulty: 3,
    tags: ["two-pointers"],
    status: "Solved",
    attempts: 1,
    lastAttempt: "2026-01-24",
  },
];

export const dsaAttemptsByProblem: Record<number, DsaAttempt[]> = {
  1: [
    {
      id: 11,
      status: "Partial",
      timeMinutes: 28,
      notes: "Forgot to handle duplicates initially.",
      createdAt: "2026-01-28",
    },
    {
      id: 12,
      status: "Solved",
      timeMinutes: 18,
      notes: "Used hashmap for O(n).",
      createdAt: "2026-01-30",
    },
  ],
  2: [
    {
      id: 21,
      status: "Partial",
      timeMinutes: 52,
      notes: "Binary search partition still shaky.",
      createdAt: "2026-01-29",
    },
  ],
  3: [
    {
      id: 31,
      status: "Solved",
      timeMinutes: 40,
      notes: "List + map with eviction.",
      createdAt: "2026-01-28",
    },
  ],
  4: [
    {
      id: 41,
      status: "Unsolved",
      timeMinutes: 35,
      notes: "Rotation indexing confusion.",
      createdAt: "2026-01-27",
    },
  ],
  5: [
    {
      id: 51,
      status: "Partial",
      timeMinutes: 44,
      notes: "Need to revisit recursion stack logic.",
      createdAt: "2026-01-26",
    },
  ],
  6: [
    {
      id: 61,
      status: "Solved",
      timeMinutes: 27,
      notes: "Two pointers with max-left/right.",
      createdAt: "2026-01-24",
    },
  ],
};

export const designTopics: DesignTopic[] = [
  {
    id: 101,
    title: "Realtime analytics pipeline",
    category: "HLD",
    tags: ["streaming", "kafka"],
    updatedAt: "2026-01-30",
    notes:
      "Lambda architecture with Kafka + Flink. Notes on SLA, backpressure, and storage tiering.",
  },
  {
    id: 102,
    title: "Rate limiter",
    category: "LLD",
    tags: ["tokens", "redis"],
    updatedAt: "2026-01-28",
    notes: "Token bucket with Redis Lua for atomicity. Discussed leaky bucket tradeoffs.",
  },
  {
    id: 103,
    title: "Caching hierarchy",
    category: "Cache",
    tags: ["ttl", "invalidation"],
    updatedAt: "2026-01-27",
    notes: "Client cache + edge cache with stale-while-revalidate strategy.",
  },
  {
    id: 104,
    title: "Multi-tenant schema strategy",
    category: "DB",
    tags: ["sharding", "migrations"],
    updatedAt: "2026-01-25",
    notes: "Hybrid: shared schema for small tenants, isolated DB for large.",
  },
  {
    id: 105,
    title: "Queue-based fanout",
    category: "Queue",
    tags: ["sqs", "fanout"],
    updatedAt: "2026-01-23",
    notes: "Fanout via SNS -> SQS for downstream isolation.",
  },
  {
    id: 106,
    title: "Consistency models",
    category: "Consistency",
    tags: ["quorum", "latency"],
    updatedAt: "2026-01-21",
    notes: "Quorum reads/writes and read repair notes.",
  },
];

export const reviewItems: ReviewItem[] = [
  {
    id: 1,
    type: "DSA",
    title: "Median of Two Sorted Arrays",
    dueInDays: 0,
    lastReviewed: "2026-01-29",
  },
  {
    id: 2,
    type: "Design",
    title: "Rate limiter",
    dueInDays: 1,
    lastReviewed: "2026-01-28",
  },
  {
    id: 3,
    type: "DSA",
    title: "Rotate Matrix",
    dueInDays: 2,
    lastReviewed: "2026-01-27",
  },
];

export const studySessions: StudySession[] = [
  {
    id: 1,
    date: "2026-01-31",
    duration: 90,
    focus: "Mixed",
    notes: "DSA warm-up + design notes cleanup.",
  },
  {
    id: 2,
    date: "2026-01-29",
    duration: 75,
    focus: "DSA",
    notes: "Binary search patterns.",
  },
  {
    id: 3,
    date: "2026-01-27",
    duration: 60,
    focus: "Design",
    notes: "Caching strategies review.",
  },
];

export const dashboardSummary = {
  attemptsSolved: 18,
  attemptsTotal: 26,
  avgTimeByDifficulty: [
    { difficulty: 1, minutes: 18 },
    { difficulty: 2, minutes: 24 },
    { difficulty: 3, minutes: 33 },
    { difficulty: 4, minutes: 41 },
    { difficulty: 5, minutes: 58 },
  ],
  topTags: [
    { tag: "hashmap", count: 7 },
    { tag: "graphs", count: 5 },
    { tag: "binary-search", count: 4 },
  ],
  designByCategory: [
    { category: "HLD", count: 4 },
    { category: "LLD", count: 3 },
    { category: "Cache", count: 2 },
    { category: "DB", count: 2 },
  ],
};

export const recentActivity: ActivityItem[] = [
  {
    id: 1,
    type: "Attempt",
    title: "Two Sum",
    detail: "Solved in 18m",
    time: "2h ago",
  },
  {
    id: 2,
    type: "Design",
    title: "Rate limiter",
    detail: "Updated tradeoffs",
    time: "Yesterday",
  },
  {
    id: 3,
    type: "Session",
    title: "Mixed session",
    detail: "90m total",
    time: "Jan 31",
  },
  {
    id: 4,
    type: "Attempt",
    title: "Median of Two Sorted Arrays",
    detail: "Partial attempt",
    time: "Jan 29",
  },
];

import { Plus, Star } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/Dialog";
import { Input, Textarea } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { createDsaProblem, listDsaProblems, listProblemAttempts, updateDsaProblem } from "../lib/api";
import type { DSAProblem, DSAAttempt } from "../lib/api";
import { cn } from "../lib/cn";
import { formatDate } from "../lib/format";
import { CodeSnippetsPanel, hasSnippetPayload } from "../components/dsa/CodeSnippetsPanel";

type Approach = {
  id: number;
  title: string;
  notes: string;
};

type DifficultyLevel = "Easy" | "Medium" | "Hard";

type BucketMap = Record<number, string[]>;

type ImportantMap = Record<number, boolean>;

type DoneMap = Record<number, boolean>;

const normalizeLabel = (value: string) => value.trim().toLowerCase();

const normalizeLabels = (labels: string[]) => {
  const seen = new Set<string>();
  const next: string[] = [];
  labels.forEach((label) => {
    const normalized = normalizeLabel(label);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    next.push(normalized);
  });
  return next;
};

const filterBucketTags = (tags: string[], buckets: string[]) => {
  const bucketSet = new Set(buckets.map(normalizeLabel));
  return tags.filter((tag) => !bucketSet.has(normalizeLabel(tag)));
};

const statusLabel = (status?: DSAAttempt["status"]) => {
  if (status === "SOLVED") return "Solved";
  if (status === "PARTIAL") return "Partial";
  if (status === "UNSOLVED") return "Unsolved";
  return "Unsolved";
};

const platformLabel = (platform: DSAProblem["platform"]) => {
  if (platform === "LEETCODE") return "LeetCode";
  if (platform === "GFG") return "GFG";
  return "Custom";
};

const difficultyLabel = (difficulty: number): DifficultyLevel => {
  if (difficulty <= 2) return "Easy";
  if (difficulty === 3) return "Medium";
  return "Hard";
};

const badgeBase =
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium";

const statusStyles: Record<string, string> = {
  Solved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Partial: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Unsolved: "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

const difficultyStyles: Record<DifficultyLevel, string> = {
  Easy: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Medium: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Hard: "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

const StatusBadge = ({ status }: { status: string }) => {
  const classes = statusStyles[status] ?? "border-border text-muted-foreground";
  return <span className={cn(badgeBase, classes)}>{status}</span>;
};

const DifficultyBadge = ({ level }: { level: DifficultyLevel }) => {
  return <span className={cn(badgeBase, difficultyStyles[level])}>{level}</span>;
};

const BucketBadge = ({ label }: { label: string }) => {
  return (
    <span className={cn(badgeBase, "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400")}>
      {label}
    </span>
  );
};

const TagBadge = ({ label }: { label: string }) => {
  return (
    <span className={cn(badgeBase, "border-border bg-surface text-muted-foreground")}>
      {label}
    </span>
  );
};

const emptyForm = {
  title: "",
  platform: "LEETCODE",
  link: "",
  difficulty: 3,
  tags: "",
  statement: "",
  solution_notes: "",
};

export const DsaList = () => {
  const [problems, setProblems] = useState<DSAProblem[]>([]);
  const [statusMap, setStatusMap] = useState<Record<number, string>>({});
  const [lastAttemptMap, setLastAttemptMap] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [difficultyFilter, setDifficultyFilter] = useState("All");
  const [importantFilter, setImportantFilter] = useState("All");
  const [bucketFilter, setBucketFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedProblemId, setSelectedProblemId] = useState<number | null>(null);
  const [approachMap, setApproachMap] = useState<Record<number, Approach[]>>({});
  const [problemNotes, setProblemNotes] = useState<Record<number, string>>({});
  const [importantMap, setImportantMap] = useState<ImportantMap>({});
  const [doneMap, setDoneMap] = useState<DoneMap>({});
  const [bucketMap, setBucketMap] = useState<BucketMap>({});
  const [bucketInput, setBucketInput] = useState("");
  const [leftWidth, setLeftWidth] = useState(320);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params: {
          search?: string;
          difficulty_min?: number;
          difficulty_max?: number;
        } = {};
        if (search) {
          params.search = search;
        }
        if (difficultyFilter === "Easy") {
          params.difficulty_min = 1;
          params.difficulty_max = 2;
        }
        if (difficultyFilter === "Medium") {
          params.difficulty_min = 3;
          params.difficulty_max = 3;
        }
        if (difficultyFilter === "Hard") {
          params.difficulty_min = 4;
          params.difficulty_max = 5;
        }

        const data = await listDsaProblems(params);
        if (!active) return;
        setProblems(data.results);

        const metaResults = await Promise.all(
          data.results.map(async (problem) => {
            try {
              const attempts = await listProblemAttempts(problem.id);
              const latest = attempts[0];
              return {
                id: problem.id,
                status: statusLabel(latest?.status),
                lastAttempt: latest?.created_at ? formatDate(latest.created_at) : "—",
              };
            } catch {
              return { id: problem.id, status: "Unsolved", lastAttempt: "—" };
            }
          })
        );

        if (!active) return;
        const statusLookup: Record<number, string> = {};
        const lastAttemptLookup: Record<number, string> = {};
        metaResults.forEach((item) => {
          statusLookup[item.id] = item.status;
          lastAttemptLookup[item.id] = item.lastAttempt;
        });
        setStatusMap(statusLookup);
        setLastAttemptMap(lastAttemptLookup);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load problems");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [search, difficultyFilter]);

  useEffect(() => {
    setImportantMap((prev) => {
      const next = { ...prev };
      problems.forEach((problem) => {
        next[problem.id] = problem.is_important ?? false;
      });
      return next;
    });
    setDoneMap((prev) => {
      const next = { ...prev };
      problems.forEach((problem) => {
        next[problem.id] = problem.is_done ?? false;
      });
      return next;
    });
    setBucketMap((prev) => {
      const next = { ...prev };
      problems.forEach((problem) => {
        next[problem.id] = normalizeLabels(problem.bucket_labels ?? []);
      });
      return next;
    });
    setProblemNotes((prev) => {
      const next = { ...prev };
      problems.forEach((problem) => {
        next[problem.id] = problem.workspace_notes ?? "";
      });
      return next;
    });
    setApproachMap((prev) => {
      const next = { ...prev };
      problems.forEach((problem) => {
        const approaches = Array.isArray(problem.approaches_json)
          ? problem.approaches_json.map((item, index) => ({
              id: typeof item.id === "number" ? item.id : Date.now() + index,
              title: item.title ?? "",
              notes: item.notes ?? "",
            }))
          : [];
        next[problem.id] = approaches;
      });
      return next;
    });
  }, [problems]);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      if (!dragRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const next = event.clientX - rect.left;
      const min = 240;
      const max = Math.max(min, rect.width - 320);
      const clamped = Math.max(min, Math.min(max, next));
      setLeftWidth(clamped);
    };

    const handleUp = () => {
      dragRef.current = false;
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, []);

  const bucketOptions = useMemo(() => {
    const all = new Set<string>();
    Object.values(bucketMap).forEach((buckets) => {
      buckets.forEach((bucket) => all.add(bucket));
    });
    return Array.from(all).sort();
  }, [bucketMap]);

  const filteredProblems = useMemo(() => {
    let items = [...problems];
    if (statusFilter !== "All") {
      items = items.filter((problem) => statusMap[problem.id] === statusFilter);
    }
    if (importantFilter === "Important") {
      items = items.filter((problem) => importantMap[problem.id]);
    }
    if (bucketFilter !== "All") {
      items = items.filter((problem) => bucketMap[problem.id]?.includes(bucketFilter));
    }
    return items;
  }, [problems, statusFilter, statusMap, importantFilter, bucketFilter, importantMap, bucketMap]);

  useEffect(() => {
    if (filteredProblems.length === 0) {
      setSelectedProblemId(null);
      return;
    }
    if (!selectedProblemId || !filteredProblems.some((problem) => problem.id === selectedProblemId)) {
      setSelectedProblemId(filteredProblems[0].id);
    }
  }, [filteredProblems, selectedProblemId]);

  const tracker = useMemo(() => {
    const total = problems.length;
    const solved = Object.values(statusMap).filter((status) => status === "Solved").length;
    const partial = Object.values(statusMap).filter((status) => status === "Partial").length;
    const unsolved = total - solved - partial;
    const completion = total ? Math.round((solved / total) * 100) : 0;
    return { total, solved, partial, unsolved, completion };
  }, [problems, statusMap]);

  const selectedProblem =
    filteredProblems.find((problem) => problem.id === selectedProblemId) ?? filteredProblems[0];
  const approaches = selectedProblem ? approachMap[selectedProblem.id] ?? [] : [];
  const workspaceNotes = selectedProblem ? problemNotes[selectedProblem.id] ?? "" : "";
  const selectedBuckets = selectedProblem ? bucketMap[selectedProblem.id] ?? [] : [];
  const selectedImportant = selectedProblem ? importantMap[selectedProblem.id] ?? false : false;
  const currentStatus = selectedProblem ? statusMap[selectedProblem.id] ?? "Unsolved" : "Unsolved";
  const hasSavedSnippets = selectedProblem
    ? hasSnippetPayload(selectedProblem.solution_notes)
    : false;

  const handleCreate = async () => {
    setSaving(true);
    setCreateError(null);
    try {
      const payload: Partial<DSAProblem> = {
        title: form.title,
        platform: form.platform as DSAProblem["platform"],
        link: form.link,
        difficulty: Number(form.difficulty),
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        statement: form.statement,
        solution_notes: form.solution_notes,
      };
      await createDsaProblem(payload);
      setForm(emptyForm);
      setCreateOpen(false);
      const data = await listDsaProblems();
      setProblems(data.results);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create problem");
    } finally {
      setSaving(false);
    }
  };

  const handlePersistSnippets = async (payload: string) => {
    if (!selectedProblemId) return;
    const updated = await updateDsaProblem(selectedProblemId, { solution_notes: payload });
    setProblems((prev) =>
      prev.map((problem) => (problem.id === updated.id ? updated : problem))
    );
  };

  const handleSaveDetail = async () => {
    if (!selectedProblem) return;
    setDetailSaving(true);
    setDetailError(null);
    try {
      const updated = await updateDsaProblem(selectedProblem.id, {
        workspace_notes: workspaceNotes,
        approaches_json: approaches.map((approach) => ({
          id: approach.id,
          title: approach.title,
          notes: approach.notes,
        })),
        bucket_labels: selectedBuckets,
        is_important: selectedImportant,
        is_done: doneMap[selectedProblem.id] ?? false,
      });
      setProblems((prev) =>
        prev.map((problem) => (problem.id === updated.id ? updated : problem))
      );
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Failed to save details");
    } finally {
      setDetailSaving(false);
    }
  };

  const handleAddApproach = () => {
    if (!selectedProblem) return;
    setApproachMap((prev) => {
      const current = prev[selectedProblem.id] ?? [];
      return {
        ...prev,
        [selectedProblem.id]: [
          ...current,
          { id: Date.now(), title: "", notes: "" },
        ],
      };
    });
  };

  const updateApproach = (approachId: number, patch: Partial<Approach>) => {
    if (!selectedProblem) return;
    setApproachMap((prev) => {
      const current = prev[selectedProblem.id] ?? [];
      return {
        ...prev,
        [selectedProblem.id]: current.map((approach) =>
          approach.id === approachId ? { ...approach, ...patch } : approach
        ),
      };
    });
  };

  const removeApproach = (approachId: number) => {
    if (!selectedProblem) return;
    setApproachMap((prev) => {
      const current = prev[selectedProblem.id] ?? [];
      return {
        ...prev,
        [selectedProblem.id]: current.filter((approach) => approach.id !== approachId),
      };
    });
  };

  const toggleImportant = async (problemId: number) => {
    const nextValue = !importantMap[problemId];
    setImportantMap((prev) => ({ ...prev, [problemId]: nextValue }));
    try {
      const updated = await updateDsaProblem(problemId, { is_important: nextValue });
      setProblems((prev) =>
        prev.map((problem) => (problem.id === updated.id ? updated : problem))
      );
    } catch (err) {
      setImportantMap((prev) => ({ ...prev, [problemId]: !nextValue }));
      setDetailError(err instanceof Error ? err.message : "Failed to update important flag");
    }
  };

  const toggleDone = async (problemId: number) => {
    const nextValue = !doneMap[problemId];
    setDoneMap((prev) => ({ ...prev, [problemId]: nextValue }));
    try {
      const updated = await updateDsaProblem(problemId, { is_done: nextValue });
      setProblems((prev) =>
        prev.map((problem) => (problem.id === updated.id ? updated : problem))
      );
    } catch (err) {
      setDoneMap((prev) => ({ ...prev, [problemId]: !nextValue }));
      setDetailError(err instanceof Error ? err.message : "Failed to update done state");
    }
  };

  const handleAddBucket = () => {
    if (!selectedProblem) return;
    const trimmed = bucketInput.trim();
    if (!trimmed) return;
    const normalized = normalizeLabel(trimmed);
    setBucketMap((prev) => {
      const current = prev[selectedProblem.id] ?? [];
      if (current.map(normalizeLabel).includes(normalized)) return prev;
      return { ...prev, [selectedProblem.id]: [...current, normalized] };
    });
    setBucketInput("");
  };

  const removeBucket = (problemId: number, bucket: string) => {
    setBucketMap((prev) => ({
      ...prev,
      [problemId]: (prev[problemId] ?? []).filter((item) => item !== bucket),
    }));
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md border border-border bg-muted px-4 py-2 text-sm text-muted-foreground">
          Error: {error}
        </div>
      )}

      <div className="rounded-md border border-border bg-surface px-2 py-2">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-baseline gap-2">
              <span>Total</span>
              <span className="text-sm font-semibold text-foreground">{tracker.total}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span>Solved</span>
              <span className="text-sm font-semibold text-foreground">{tracker.solved}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span>Partial</span>
              <span className="text-sm font-semibold text-foreground">{tracker.partial}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span>Completion</span>
              <span className="text-sm font-semibold text-foreground">{tracker.completion}%</span>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 lg:ml-auto lg:w-auto lg:flex-nowrap">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search problems"
              className="h-8 text-xs lg:w-56"
            />
            <Select
              value={difficultyFilter}
              onChange={(event) => setDifficultyFilter(event.target.value)}
              className="h-8 text-xs min-w-[120px]"
            >
              <option value="All">All difficulty</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </Select>
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-8 text-xs min-w-[120px]"
            >
              <option value="All">All status</option>
              <option value="Solved">Solved</option>
              <option value="Partial">Partial</option>
              <option value="Unsolved">Unsolved</option>
            </Select>
            <Select
              value={importantFilter}
              onChange={(event) => setImportantFilter(event.target.value)}
              className="h-8 text-xs min-w-[140px]"
            >
              <option value="All">All questions</option>
              <option value="Important">Important only</option>
            </Select>
            <Select
              value={bucketFilter}
              onChange={(event) => setBucketFilter(event.target.value)}
              className="h-8 text-xs min-w-[140px]"
            >
              <option value="All">All buckets</option>
              {bucketOptions.map((bucket) => (
                <option key={bucket} value={bucket}>
                  {bucket}
                </option>
              ))}
            </Select>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label="Add problem"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add DSA problem</DialogTitle>
                  <DialogDescription>Capture a new problem with context and notes.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                  <div className="grid gap-1">
                    <label className="text-xs text-muted-foreground">Title</label>
                    <Input
                      value={form.title}
                      onChange={(event) => setForm({ ...form, title: event.target.value })}
                      placeholder="Two Sum"
                    />
                  </div>
                  <div className="grid gap-1">
                    <label className="text-xs text-muted-foreground">Platform</label>
                    <Select
                      value={form.platform}
                      onChange={(event) => setForm({ ...form, platform: event.target.value })}
                    >
                      <option value="LEETCODE">LeetCode</option>
                      <option value="GFG">GFG</option>
                      <option value="CUSTOM">Custom</option>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1">
                      <label className="text-xs text-muted-foreground">Difficulty</label>
                      <Select
                        value={String(form.difficulty)}
                        onChange={(event) =>
                          setForm({ ...form, difficulty: Number(event.target.value) })
                        }
                      >
                        <option value="1">Easy (1)</option>
                        <option value="2">Easy (2)</option>
                        <option value="3">Medium (3)</option>
                        <option value="4">Hard (4)</option>
                        <option value="5">Hard (5)</option>
                      </Select>
                    </div>
                    <div className="grid gap-1">
                      <label className="text-xs text-muted-foreground">Tags</label>
                      <Input
                        value={form.tags}
                        onChange={(event) => setForm({ ...form, tags: event.target.value })}
                        placeholder="arrays, hashmap"
                      />
                    </div>
                  </div>
                  <div className="grid gap-1">
                    <label className="text-xs text-muted-foreground">Statement</label>
                    <Textarea
                      value={form.statement}
                      onChange={(event) => setForm({ ...form, statement: event.target.value })}
                      placeholder="Paste the problem statement."
                    />
                  </div>
                  <div className="grid gap-1">
                    <label className="text-xs text-muted-foreground">Question link</label>
                    <Input
                      value={form.link}
                      onChange={(event) => setForm({ ...form, link: event.target.value })}
                      placeholder="https://leetcode.com/..."
                    />
                  </div>
                  <div className="grid gap-1">
                    <label className="text-xs text-muted-foreground">Solution notes</label>
                    <Textarea
                      value={form.solution_notes}
                      onChange={(event) => setForm({ ...form, solution_notes: event.target.value })}
                      placeholder="Your solution notes"
                    />
                  </div>
                  {createError && (
                    <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                      {createError}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost">Cancel</Button>
                  </DialogClose>
                  <Button onClick={handleCreate} disabled={saving}>
                    {saving ? "Saving..." : "Save problem"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="grid rounded-md border border-border bg-surface lg:h-[calc(100vh-160px)] lg:overflow-hidden"
        style={{ gridTemplateColumns: `${leftWidth}px 8px 1fr` }}
      >
        <div className="space-y-3 p-2 lg:overflow-y-auto">
          {loading && <p className="text-xs text-muted-foreground">Loading problems...</p>}
          <div className="space-y-2">
            {filteredProblems.map((problem) => {
              const isActive = problem.id === selectedProblem?.id;
              const buckets = bucketMap[problem.id] ?? [];
              const isImportant = importantMap[problem.id];
              const isDone = doneMap[problem.id];
              const visibleTags = filterBucketTags(problem.tags ?? [], buckets);
              return (
                <div
                  key={problem.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedProblemId(problem.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedProblemId(problem.id);
                    }
                  }}
                  className={cn(
                    "relative space-y-2 rounded-md border px-3 py-2 text-left transition",
                    isActive ? "border-accent bg-muted" : "border-border hover:bg-muted"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={isDone}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => {
                          event.stopPropagation();
                          toggleDone(problem.id);
                        }}
                        className="mt-1"
                        aria-label="Mark done"
                      />
                      <div className="space-y-1">
                        <div
                          className={cn(
                            "text-sm font-medium text-foreground",
                            isDone && "line-through text-muted-foreground"
                          )}
                        >
                          {problem.title}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleImportant(problem.id);
                      }}
                      className="rounded-md text-muted-foreground hover:text-foreground"
                      aria-label="Toggle important"
                    >
                      <Star
                        className={cn(
                          "h-4 w-4",
                          isImportant ? "text-amber-500 fill-amber-500" : "text-muted-foreground"
                        )}
                      />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 pb-5">
                    {buckets.map((bucket) => (
                      <BucketBadge key={bucket} label={bucket} />
                    ))}
                    {visibleTags.map((tag) => (
                      <TagBadge key={tag} label={tag} />
                    ))}
                  </div>
                  <div className="absolute bottom-2 right-3">
                    <DifficultyBadge level={difficultyLabel(problem.difficulty)} />
                  </div>
                </div>
              );
            })}
            {!loading && filteredProblems.length === 0 && (
              <p className="text-xs text-muted-foreground">No problems yet.</p>
            )}
          </div>
        </div>

        <div
          className="relative flex items-center justify-center cursor-col-resize"
          onPointerDown={(event) => {
            event.preventDefault();
            dragRef.current = true;
          }}
        >
          <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
          <div className="absolute h-10 w-1.5 rounded-full bg-border" />
        </div>

        <div className="space-y-5 p-3 lg:overflow-y-auto">
          {!selectedProblem && (
            <p className="text-sm text-muted-foreground">Choose a problem to start writing notes.</p>
          )}
          {selectedProblem && (
            <>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold">{selectedProblem.title}</h2>
                    <span className="text-xs text-muted-foreground">
                      {platformLabel(selectedProblem.platform)} • {difficultyLabel(selectedProblem.difficulty)} • Updated {formatDate(selectedProblem.updated_at)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={currentStatus} />
                    <Button
                      variant={selectedImportant ? "primary" : "outline"}
                      size="sm"
                      onClick={() => toggleImportant(selectedProblem.id)}
                    >
                      <Star className={cn("h-3.5 w-3.5", selectedImportant && "fill-white")} />
                      {selectedImportant ? "Important" : "Mark important"}
                    </Button>
                    <Button size="sm" onClick={handleSaveDetail} disabled={detailSaving}>
                      {detailSaving ? "Saving..." : "Save notes"}
                    </Button>
                  </div>
                </div>
                {detailError && (
                  <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                    {detailError}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <Link to={`/dsa/${selectedProblem.id}`} className="text-accent hover:text-accent-hover">
                    Open full detail
                  </Link>
                  {selectedProblem.link && (
                    <a
                      href={selectedProblem.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent hover:text-accent-hover"
                    >
                      Problem link
                    </a>
                  )}
                </div>
                <div className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
                  {selectedProblem.statement || "Add the full statement when you have it handy."}
                </div>
                <p className="text-xs text-muted-foreground">Last attempt: {lastAttemptMap[selectedProblem.id] ?? "—"}</p>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Buckets
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedBuckets.map((bucket) => (
                      <span
                        key={bucket}
                        className={cn(
                          badgeBase,
                          "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400"
                        )}
                      >
                        {bucket}
                        <button
                          type="button"
                          onClick={() => removeBucket(selectedProblem.id, bucket)}
                          className="ml-2 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {selectedBuckets.length === 0 && (
                      <span className="text-xs text-muted-foreground">No buckets yet.</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
                    <Input
                      value={bucketInput}
                      onChange={(event) => setBucketInput(event.target.value)}
                      placeholder="Add bucket"
                      className="h-8 text-xs sm:w-40"
                    />
                    <Button variant="outline" size="sm" onClick={handleAddBucket}>
                      Add
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Workspace notes</p>
                <Textarea
                  value={workspaceNotes}
                  onChange={(event) =>
                    setProblemNotes((prev) => ({
                      ...prev,
                      [selectedProblem.id]: event.target.value,
                    }))
                  }
                  placeholder="Capture key observations, pitfalls, or reminders."
                  className="min-h-[120px]"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Approaches</p>
                  <Button variant="outline" size="sm" onClick={handleAddApproach}>
                    <Plus className="h-3 w-3" />
                    Add approach
                  </Button>
                </div>
                {approaches.length === 0 && (
                  <p className="text-xs text-muted-foreground">No approaches yet.</p>
                )}
                {approaches.map((approach) => (
                  <div
                    key={approach.id}
                    className="rounded-md border border-border bg-background p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={approach.title}
                        onChange={(event) => updateApproach(approach.id, { title: event.target.value })}
                        placeholder="Approach title"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeApproach(approach.id)}
                      >
                        Remove
                      </Button>
                    </div>
                    <Textarea
                      value={approach.notes}
                      onChange={(event) => updateApproach(approach.id, { notes: event.target.value })}
                      placeholder="Explain the approach and complexity tradeoffs."
                      className="min-h-[100px]"
                    />
                  </div>
                ))}
              </div>
              <CodeSnippetsPanel
                source={selectedProblem.solution_notes}
                onPersist={handlePersistSnippets}
              />
              {!hasSavedSnippets && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Saved notes
                  </p>
                  <div className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
                    {selectedProblem.solution_notes || "No saved notes yet."}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

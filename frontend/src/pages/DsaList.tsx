import { Plus, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
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
import { createDsaProblem, listDsaProblems, listProblemAttempts } from "../lib/api";
import type { DSAProblem, DSAAttempt } from "../lib/api";
import { cn } from "../lib/cn";
import { formatDate } from "../lib/format";

type Approach = {
  id: number;
  title: string;
  notes: string;
  code: string;
};

type DifficultyLevel = "Easy" | "Medium" | "Hard";

type BucketMap = Record<number, string[]>;

type ImportantMap = Record<number, boolean>;

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
  const [selectedProblemId, setSelectedProblemId] = useState<number | null>(null);
  const [sheetChecks, setSheetChecks] = useState<Record<number, boolean>>({});
  const [approachMap, setApproachMap] = useState<Record<number, Approach[]>>({});
  const [problemNotes, setProblemNotes] = useState<Record<number, string>>({});
  const [importantMap, setImportantMap] = useState<ImportantMap>({});
  const [bucketMap, setBucketMap] = useState<BucketMap>({});
  const [bucketInput, setBucketInput] = useState("");

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
    setSheetChecks((prev) => {
      const next = { ...prev };
      problems.forEach((problem) => {
        if (next[problem.id] === undefined) {
          next[problem.id] = statusMap[problem.id] === "Solved";
        }
      });
      return next;
    });
    setImportantMap((prev) => {
      const next = { ...prev };
      problems.forEach((problem) => {
        if (next[problem.id] === undefined) {
          next[problem.id] = false;
        }
      });
      return next;
    });
    setBucketMap((prev) => {
      const next = { ...prev };
      problems.forEach((problem) => {
        if (!next[problem.id]) {
          next[problem.id] = [];
        }
      });
      return next;
    });
  }, [problems, statusMap]);

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
      const data = await listDsaProblems();
      setProblems(data.results);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create problem");
    } finally {
      setSaving(false);
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
          { id: Date.now(), title: "", notes: "", code: "" },
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

  const toggleImportant = (problemId: number) => {
    setImportantMap((prev) => ({ ...prev, [problemId]: !prev[problemId] }));
  };

  const handleAddBucket = () => {
    if (!selectedProblem) return;
    const trimmed = bucketInput.trim();
    if (!trimmed) return;
    setBucketMap((prev) => {
      const current = prev[selectedProblem.id] ?? [];
      if (current.includes(trimmed)) return prev;
      return { ...prev, [selectedProblem.id]: [...current, trimmed] };
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">DSA</p>
          <h1 className="text-2xl font-semibold">Problem sheet</h1>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Add problem
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

      {error && (
        <div className="rounded-md border border-border bg-muted px-4 py-2 text-sm text-muted-foreground">
          Error: {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Tracker</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-semibold">{tracker.total}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Solved</p>
                <p className="text-lg font-semibold">{tracker.solved}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Partial</p>
                <p className="text-lg font-semibold">{tracker.partial}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completion</p>
                <p className="text-lg font-semibold">{tracker.completion}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-4">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search problems"
              />
              <Select
                value={difficultyFilter}
                onChange={(event) => setDifficultyFilter(event.target.value)}
              >
                <option value="All">All difficulty</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </Select>
              <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="All">All status</option>
                <option value="Solved">Solved</option>
                <option value="Partial">Partial</option>
                <option value="Unsolved">Unsolved</option>
              </Select>
              <Select
                value={importantFilter}
                onChange={(event) => setImportantFilter(event.target.value)}
              >
                <option value="All">All questions</option>
                <option value="Important">Important only</option>
              </Select>
              <Select value={bucketFilter} onChange={(event) => setBucketFilter(event.target.value)}>
                <option value="All">All buckets</option>
                {bucketOptions.map((bucket) => (
                  <option key={bucket} value={bucket}>
                    {bucket}
                  </option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-0 lg:grid-cols-[360px_1fr] rounded-md border border-border bg-surface">
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">DSA Sheet</h2>
            <span className="text-xs text-muted-foreground">{filteredProblems.length} items</span>
          </div>
          {loading && <p className="text-xs text-muted-foreground">Loading problems...</p>}
          <div className="space-y-2">
            {filteredProblems.map((problem) => {
              const status = statusMap[problem.id] ?? "Unsolved";
              const isActive = problem.id === selectedProblem?.id;
              const buckets = bucketMap[problem.id] ?? [];
              const isImportant = importantMap[problem.id];
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
                    "flex w-full items-start justify-between gap-3 rounded-md border px-3 py-3 text-left transition",
                    isActive ? "border-accent bg-muted" : "border-border hover:bg-muted"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={sheetChecks[problem.id] ?? false}
                      onChange={(event) => {
                        event.stopPropagation();
                        setSheetChecks((prev) => ({
                          ...prev,
                          [problem.id]: !(prev[problem.id] ?? false),
                        }));
                      }}
                      className="mt-1"
                    />
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium text-sm text-foreground">{problem.title}</div>
                        <DifficultyBadge level={difficultyLabel(problem.difficulty)} />
                        {isImportant && (
                          <span className={cn(badgeBase, "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400")}>
                            Important
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {platformLabel(problem.platform)} • Last touched {lastAttemptMap[problem.id] ?? "—"}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {buckets.map((bucket) => (
                          <BucketBadge key={bucket} label={bucket} />
                        ))}
                        {problem.tags.map((tag) => (
                          <TagBadge key={tag} label={tag} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={status} />
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleImportant(problem.id);
                      }}
                      className="rounded-md border border-border p-1 text-muted-foreground hover:bg-background"
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
                </div>
              );
            })}
            {!loading && filteredProblems.length === 0 && (
              <p className="text-xs text-muted-foreground">No problems yet.</p>
            )}
          </div>
        </div>

        <div className="space-y-5 border-l border-border p-6">
          {!selectedProblem && (
            <p className="text-sm text-muted-foreground">Choose a problem to start writing notes.</p>
          )}
          {selectedProblem && (
            <>
              <div className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">{selectedProblem.title}</h2>
                    <p className="text-xs text-muted-foreground">
                      {platformLabel(selectedProblem.platform)} • {difficultyLabel(selectedProblem.difficulty)} • Updated {formatDate(selectedProblem.updated_at)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Button
                      variant={selectedImportant ? "primary" : "outline"}
                      size="sm"
                      onClick={() => toggleImportant(selectedProblem.id)}
                    >
                      <Star className={cn("h-3.5 w-3.5", selectedImportant && "fill-white")} />
                      {selectedImportant ? "Important" : "Mark important"}
                    </Button>
                    <Link
                      to={`/dsa/${selectedProblem.id}`}
                      className="text-xs text-accent hover:text-accent-hover"
                    >
                      Open full detail
                    </Link>
                    {selectedProblem.link && (
                      <a
                        href={selectedProblem.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-accent hover:text-accent-hover"
                      >
                        Problem link
                      </a>
                    )}
                  </div>
                </div>
                <div className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
                  {selectedProblem.statement || "Add the full statement when you have it handy."}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Bucket labels</p>
                <div className="flex flex-wrap gap-2">
                  {selectedBuckets.map((bucket) => (
                    <span
                      key={bucket}
                      className={cn(badgeBase, "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400")}
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
                <div className="flex flex-wrap gap-2">
                  <Input
                    value={bucketInput}
                    onChange={(event) => setBucketInput(event.target.value)}
                    placeholder="Add bucket label"
                  />
                  <Button variant="outline" onClick={handleAddBucket}>
                    Add bucket
                  </Button>
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
                    <Textarea
                      value={approach.code}
                      onChange={(event) => updateApproach(approach.id, { code: event.target.value })}
                      placeholder="Code snippet"
                      className="min-h-[120px] font-mono text-xs"
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Saved notes</p>
                <div className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
                  {selectedProblem.solution_notes || "No saved notes yet."}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

import { ChevronDown, ChevronRight, ExternalLink, Plus, Star } from "lucide-react";
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
import { createDsaProblem, listMergedDsaProblems, listProblemAttempts, updateDsaProblem } from "../lib/api";
import type { DSAProblem, DSAAttempt } from "../lib/api";
import { cn } from "../lib/cn";
import { formatDate } from "../lib/format";
import { CodeSnippetsPanel, hasSnippetPayload } from "../components/dsa/CodeSnippetsPanel";
import { BuddyBadge } from "../components/buddies/BuddyBadge";
import { useBuddyContext } from "../contexts/BuddyContext";

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

const formatBucketLabel = (value: string) => {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const badgeBase =
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium";

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

const statusLabel = (status?: DSAAttempt["status"]) => {
  if (status === "SOLVED") return "Solved";
  if (status === "PARTIAL") return "Partial";
  if (status === "UNSOLVED") return "Unsolved";
  return "Unsolved";
};

const statusTone = (status?: string) => {
  if (status === "Solved") return "text-emerald-500";
  if (status === "Partial") return "text-amber-500";
  return "text-rose-500";
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

const LoadingSpinner = ({ label }: { label: string }) => (
  <div className="flex items-center gap-2 text-xs text-muted-foreground">
    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
    {label}
  </div>
);

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
  const { version } = useBuddyContext();
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
  const [importantMap, setImportantMap] = useState<ImportantMap>({});
  const [doneMap, setDoneMap] = useState<DoneMap>({});
  const [bucketMap, setBucketMap] = useState<BucketMap>({});
  const [bucketInput, setBucketInput] = useState("");
  const [leftWidth, setLeftWidth] = useState(320);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef(false);
  const [openBuckets, setOpenBuckets] = useState<Record<string, boolean>>({});

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

        const data = await listMergedDsaProblems(params);
        if (!active) return;
        setProblems(data.results);
        const statusLookup: Record<number, string> = {};
        const lastAttemptLookup: Record<number, string> = {};
        data.results.forEach((problem) => {
          statusLookup[problem.id] = problem.is_done ? "Solved" : "Unsolved";
          lastAttemptLookup[problem.id] = "—";
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
  }, [search, difficultyFilter, version]);

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
    if (!selectedProblemId) return;
    const selected = problems.find((problem) => problem.id === selectedProblemId);
    if (!selected || selected.is_owner === false) return;
    let active = true;
    const loadAttempts = async () => {
      try {
        const attempts = await listProblemAttempts(selectedProblemId);
        if (!active) return;
        const latest = attempts[0];
        const computedStatus = latest?.status
          ? statusLabel(latest.status)
          : selected.is_done
          ? "Solved"
          : "Unsolved";
        setStatusMap((prev) => ({ ...prev, [selectedProblemId]: computedStatus }));
        setLastAttemptMap((prev) => ({
          ...prev,
          [selectedProblemId]: latest?.created_at ? formatDate(latest.created_at) : "—",
        }));
      } catch {
        if (!active) return;
        setStatusMap((prev) => ({
          ...prev,
          [selectedProblemId]: selected.is_done ? "Solved" : "Unsolved",
        }));
        setLastAttemptMap((prev) => ({ ...prev, [selectedProblemId]: "—" }));
      }
    };
    loadAttempts();
    return () => {
      active = false;
    };
  }, [selectedProblemId, problems]);

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

  const bucketGroups = useMemo(() => {
    const groups: Record<string, DSAProblem[]> = {};
    filteredProblems.forEach((problem) => {
      const buckets = bucketMap[problem.id] ?? [];
      const assigned = buckets.length ? buckets : ["Unbucketed"];
      assigned.forEach((bucket) => {
        if (!groups[bucket]) {
          groups[bucket] = [];
        }
        groups[bucket].push(problem);
      });
    });
    const sortByDifficulty = (items: DSAProblem[]) => {
      const easy = items.filter((item) => item.difficulty <= 2);
      const medium = items.filter((item) => item.difficulty === 3);
      const hard = items.filter((item) => item.difficulty >= 4);
      const byTitle = (a: DSAProblem, b: DSAProblem) => a.title.localeCompare(b.title);
      easy.sort(byTitle);
      medium.sort(byTitle);
      hard.sort(byTitle);
      return [...easy, ...medium, ...hard];
    };
    return Object.keys(groups)
      .sort((a, b) => a.localeCompare(b))
      .map((bucket) => ({
        bucket,
        items: sortByDifficulty(groups[bucket]),
      }));
  }, [filteredProblems, bucketMap]);

  useEffect(() => {
    if (bucketGroups.length === 0) return;
    setOpenBuckets((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      return bucketGroups.reduce((acc, group) => {
        acc[group.bucket] = true;
        return acc;
      }, {} as Record<string, boolean>);
    });
  }, [bucketGroups]);

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
  const selectedBuckets = selectedProblem ? bucketMap[selectedProblem.id] ?? [] : [];
  const selectedImportant = selectedProblem ? importantMap[selectedProblem.id] ?? false : false;
  const currentStatus = selectedProblem ? statusMap[selectedProblem.id] ?? "Unsolved" : "Unsolved";
  const isOwner = selectedProblem ? selectedProblem.is_owner !== false : true;
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
      const data = await listMergedDsaProblems();
      setProblems(data.results);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create problem");
    } finally {
      setSaving(false);
    }
  };

  const handlePersistSnippets = async (payload: string) => {
    if (!selectedProblemId || !isOwner) return;
    const updated = await updateDsaProblem(selectedProblemId, { solution_notes: payload });
    setProblems((prev) =>
      prev.map((problem) => (problem.id === updated.id ? updated : problem))
    );
  };

  const handleSaveDetail = async () => {
    if (!selectedProblem || !isOwner) return;
    setDetailSaving(true);
    setDetailError(null);
    try {
      const updated = await updateDsaProblem(selectedProblem.id, {
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
    if (!selectedProblem || !isOwner) return;
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
    if (!selectedProblem || !isOwner) return;
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
    if (!selectedProblem || !isOwner) return;
    setApproachMap((prev) => {
      const current = prev[selectedProblem.id] ?? [];
      return {
        ...prev,
        [selectedProblem.id]: current.filter((approach) => approach.id !== approachId),
      };
    });
  };

  const toggleImportant = async (problemId: number) => {
    const target = problems.find((item) => item.id === problemId);
    if (target && target.is_owner === false) {
      setDetailError("Buddy entries are read-only.");
      return;
    }
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
    const target = problems.find((item) => item.id === problemId);
    if (target && target.is_owner === false) {
      setDetailError("Buddy entries are read-only.");
      return;
    }
    const nextValue = !doneMap[problemId];
    setDoneMap((prev) => ({ ...prev, [problemId]: nextValue }));
    setStatusMap((prev) => ({
      ...prev,
      [problemId]: nextValue ? "Solved" : "Unsolved",
    }));
    try {
      const updated = await updateDsaProblem(problemId, { is_done: nextValue });
      setProblems((prev) =>
        prev.map((problem) => (problem.id === updated.id ? updated : problem))
      );
    } catch (err) {
      setDoneMap((prev) => ({ ...prev, [problemId]: !nextValue }));
      setStatusMap((prev) => ({
        ...prev,
        [problemId]: !nextValue ? "Solved" : "Unsolved",
      }));
      setDetailError(err instanceof Error ? err.message : "Failed to update done state");
    }
  };

  const handleAddBucket = async () => {
    if (!selectedProblem || !isOwner) return;
    const trimmed = bucketInput.trim();
    if (!trimmed) return;
    const normalized = normalizeLabel(trimmed);
    const current = bucketMap[selectedProblem.id] ?? [];
    if (current.map(normalizeLabel).includes(normalized)) {
      setBucketInput("");
      return;
    }
    const nextBuckets = [...current, normalized];
    setBucketMap((prev) => ({ ...prev, [selectedProblem.id]: nextBuckets }));
    setBucketInput("");
    try {
      const updated = await updateDsaProblem(selectedProblem.id, {
        bucket_labels: nextBuckets,
      });
      setProblems((prev) =>
        prev.map((problem) => (problem.id === updated.id ? updated : problem))
      );
    } catch (err) {
      setBucketMap((prev) => ({ ...prev, [selectedProblem.id]: current }));
      setDetailError(err instanceof Error ? err.message : "Failed to update buckets");
    }
  };

  const removeBucket = async (problemId: number, bucket: string) => {
    const target = problems.find((item) => item.id === problemId);
    if (target && target.is_owner === false) {
      setDetailError("Buddy entries are read-only.");
      return;
    }
    const current = bucketMap[problemId] ?? [];
    const nextBuckets = current.filter((item) => item !== bucket);
    setBucketMap((prev) => ({
      ...prev,
      [problemId]: nextBuckets,
    }));
    try {
      const updated = await updateDsaProblem(problemId, { bucket_labels: nextBuckets });
      setProblems((prev) =>
        prev.map((problem) => (problem.id === updated.id ? updated : problem))
      );
    } catch (err) {
      setBucketMap((prev) => ({ ...prev, [problemId]: current }));
      setDetailError(err instanceof Error ? err.message : "Failed to update buckets");
    }
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
                  {formatBucketLabel(bucket)}
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
          {loading && <LoadingSpinner label="Loading problems..." />}
          <div className="space-y-1.5">
            {bucketGroups.map((group) => {
              const isOpen = openBuckets[group.bucket] ?? false;
              return (
                <div
                  key={group.bucket}
                  className="rounded-md border border-border/80 bg-background"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenBuckets((prev) => ({
                        ...prev,
                        [group.bucket]: !isOpen,
                      }))
                    }
                    className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10"
                  >
                    <span>{formatBucketLabel(group.bucket)}</span>
                    {isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="divide-y divide-border">
                      {group.items.map((problem) => {
                        const isActive = problem.id === selectedProblem?.id;
                        const isDone = doneMap[problem.id];
                        return (
                          <div
                            key={`${group.bucket}-${problem.id}`}
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
                              "flex items-center gap-2 px-3 py-1.5 text-[11px] text-foreground transition",
                              isActive ? "bg-muted" : "hover:bg-muted/70"
                            )}
                            style={{ contentVisibility: "auto" }}
                          >
                            <input
                              type="checkbox"
                              checked={isDone}
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => {
                                event.stopPropagation();
                                toggleDone(problem.id);
                              }}
                              className="h-3.5 w-3.5 appearance-none rounded-full border border-border bg-background transition checked:border-accent checked:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                              aria-label="Mark done"
                              disabled={problem.is_owner === false}
                            />
                            <span
                              className={cn(
                                "text-[11px]",
                                isDone && "line-through text-muted-foreground"
                              )}
                            >
                              {problem.title}
                            </span>
                          </div>
                        );
                      })}
                      {group.items.length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          No questions in this bucket.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {!loading && bucketGroups.length === 0 && (
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
                    {selectedProblem.owner && selectedProblem.is_owner === false && (
                      <BuddyBadge user={selectedProblem.owner} size="xs" />
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("text-xs font-medium", statusTone(currentStatus))}>
                      {currentStatus}
                    </span>
                    <Button
                      variant={selectedImportant ? "primary" : "outline"}
                      size="sm"
                      onClick={() => toggleImportant(selectedProblem.id)}
                      disabled={!isOwner}
                    >
                      <Star className={cn("h-3.5 w-3.5", selectedImportant && "fill-white")} />
                      {selectedImportant ? "Important" : "Mark important"}
                    </Button>
                    <Button size="sm" onClick={handleSaveDetail} disabled={detailSaving || !isOwner}>
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
                      className="inline-flex items-center gap-1 text-accent hover:text-accent-hover"
                      aria-label={`${platformLabel(selectedProblem.platform)} link`}
                      title={`${platformLabel(selectedProblem.platform)} link`}
                    >
                      {selectedProblem.platform === "LEETCODE" ? (
                        <img
                          src="/leetcode.png"
                          alt="LeetCode"
                          className="h-5 w-5"
                        />
                      ) : selectedProblem.platform === "GFG" ? (
                        <img
                          src="/gfg.png"
                          alt="GeeksforGeeks"
                          className="h-5 w-5"
                        />
                      ) : (
                        <ExternalLink className="h-4 w-4" />
                      )}
                    </a>
                  )}
                </div>
                <div className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
                  {selectedProblem.statement || "Add the full statement when you have it handy."}
                </div>
                <p className="text-xs text-muted-foreground">Last attempt: {lastAttemptMap[selectedProblem.id] ?? "—"}</p>
                {!isOwner && (
                  <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                    Buddy entries are read-only. Open the full detail page to view merged notes.
                  </div>
                )}
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
                        {formatBucketLabel(bucket)}
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
                      disabled={!isOwner}
                    />
                    <Button variant="outline" size="sm" onClick={handleAddBucket} disabled={!isOwner}>
                      Add
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Approaches</p>
                  <Button variant="outline" size="sm" onClick={handleAddApproach} disabled={!isOwner}>
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
                        disabled={!isOwner}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeApproach(approach.id)}
                        disabled={!isOwner}
                      >
                        Remove
                      </Button>
                    </div>
                    <Textarea
                      value={approach.notes}
                      onChange={(event) => updateApproach(approach.id, { notes: event.target.value })}
                      placeholder="Explain the approach and complexity tradeoffs."
                      className="min-h-[100px]"
                      disabled={!isOwner}
                    />
                  </div>
                ))}
              </div>
              <CodeSnippetsPanel
                source={selectedProblem.solution_notes}
                onPersist={isOwner ? handlePersistSnippets : undefined}
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

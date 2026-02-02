import { Plus } from "lucide-react";
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
import { formatDate } from "../lib/format";

type Approach = {
  id: number;
  title: string;
  notes: string;
  code: string;
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

const StatusBadge = ({ status }: { status: string }) => {
  const base = "rounded-md px-2 py-0.5 text-xs font-medium";
  if (status === "Solved") {
    return <span className={`${base} bg-muted text-foreground`}>{status}</span>;
  }
  if (status === "Partial") {
    return <span className={`${base} bg-muted text-muted-foreground`}>{status}</span>;
  }
  return <span className={`${base} bg-background text-muted-foreground border border-border`}>{status}</span>;
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
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedProblemId, setSelectedProblemId] = useState<number | null>(null);
  const [sheetChecks, setSheetChecks] = useState<Record<number, boolean>>({});
  const [approachMap, setApproachMap] = useState<Record<number, Approach[]>>({});
  const [problemNotes, setProblemNotes] = useState<Record<number, string>>({});

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
        if (difficultyFilter === "1-2") {
          params.difficulty_min = 1;
          params.difficulty_max = 2;
        }
        if (difficultyFilter === "3") {
          params.difficulty_min = 3;
          params.difficulty_max = 3;
        }
        if (difficultyFilter === "4-5") {
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
  }, [problems, statusMap]);

  const filteredProblems = useMemo(() => {
    if (statusFilter === "All") {
      return problems;
    }
    return problems.filter((problem) => statusMap[problem.id] === statusFilter);
  }, [problems, statusFilter, statusMap]);

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
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
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
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search problems"
              />
              <Select
                value={difficultyFilter}
                onChange={(event) => setDifficultyFilter(event.target.value)}
              >
                <option value="All">All difficulties</option>
                <option value="1-2">1-2</option>
                <option value="3">3</option>
                <option value="4-5">4-5</option>
              </Select>
              <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="All">All status</option>
                <option value="Solved">Solved</option>
                <option value="Partial">Partial</option>
                <option value="Unsolved">Unsolved</option>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>DSA Sheet</CardTitle>
              <span className="text-xs text-muted-foreground">{filteredProblems.length} items</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading && <p className="text-xs text-muted-foreground">Loading problems...</p>}
            {filteredProblems.map((problem) => {
              const status = statusMap[problem.id] ?? "Unsolved";
              const isActive = problem.id === selectedProblem?.id;
              return (
                <button
                  key={problem.id}
                  onClick={() => setSelectedProblemId(problem.id)}
                  className={`flex w-full items-start justify-between gap-3 rounded-md border px-3 py-2 text-left transition ${
                    isActive ? "border-accent bg-muted" : "border-border hover:bg-muted"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={sheetChecks[problem.id] ?? false}
                      onChange={() =>
                        setSheetChecks((prev) => ({
                          ...prev,
                          [problem.id]: !(prev[problem.id] ?? false),
                        }))
                      }
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-sm text-foreground">{problem.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {platformLabel(problem.platform)} • Difficulty {problem.difficulty}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {problem.tags.join(" • ") || "No tags"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={status} />
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {lastAttemptMap[problem.id] ?? "—"}
                    </div>
                  </div>
                </button>
              );
            })}
            {!loading && filteredProblems.length === 0 && (
              <p className="text-xs text-muted-foreground">No problems yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="min-h-[520px]">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>{selectedProblem?.title ?? "Select a problem"}</CardTitle>
                {selectedProblem && (
                  <p className="text-xs text-muted-foreground">
                    {platformLabel(selectedProblem.platform)} • Difficulty {selectedProblem.difficulty} • Updated {formatDate(selectedProblem.updated_at)}
                  </p>
                )}
              </div>
              {selectedProblem && (
                <div className="flex flex-col items-end gap-2">
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
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedProblem && (
              <p className="text-sm text-muted-foreground">Choose a problem to start writing notes.</p>
            )}
            {selectedProblem && (
              <>
                <div className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
                  {selectedProblem.statement || "Add the full statement when you have it handy."}
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
                      className="rounded-md border border-border bg-surface p-3 space-y-2"
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

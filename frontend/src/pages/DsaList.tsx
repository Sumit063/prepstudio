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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/Table";
import { createDsaProblem, listDsaProblems, listProblemAttempts } from "../lib/api";
import type { DSAProblem, DSAAttempt } from "../lib/api";
import { formatDate } from "../lib/format";

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
  const [sheetItems, setSheetItems] = useState(
    [
      { id: 1, title: "Two Sum", done: true },
      { id: 2, title: "Binary Search", done: false },
      { id: 3, title: "Merge Intervals", done: false },
      { id: 4, title: "LRU Cache", done: false },
    ]
  );
  const [sheetInput, setSheetInput] = useState("");
  const [sheetNotes, setSheetNotes] = useState("");

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

  const filteredProblems = useMemo(() => {
    if (statusFilter === "All") {
      return problems;
    }
    return problems.filter((problem) => statusMap[problem.id] === statusFilter);
  }, [problems, statusFilter, statusMap]);

  const tracker = useMemo(() => {
    const total = problems.length;
    const solved = Object.values(statusMap).filter((status) => status === "Solved").length;
    const partial = Object.values(statusMap).filter((status) => status === "Partial").length;
    const unsolved = total - solved - partial;
    const completion = total ? Math.round((solved / total) * 100) : 0;
    return { total, solved, partial, unsolved, completion };
  }, [problems, statusMap]);

  const sheetProgress = useMemo(() => {
    const total = sheetItems.length;
    const done = sheetItems.filter((item) => item.done).length;
    return { total, done };
  }, [sheetItems]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">DSA</p>
          <h1 className="text-2xl font-semibold">Problems library</h1>
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

      <Card>
        <CardHeader>
          <CardTitle>Problem list</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Last attempt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Loading problems...
                    </TableCell>
                  </TableRow>
                )}
                {filteredProblems.map((problem) => (
                  <TableRow key={problem.id}>
                    <TableCell>
                      <Link
                        to={`/dsa/${problem.id}`}
                        className="font-medium text-foreground hover:text-accent"
                      >
                        {problem.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {problem.tags.join(" • ") || "No tags"}
                      </div>
                      {problem.link && (
                        <a
                          href={problem.link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-accent hover:text-accent-hover"
                        >
                          Open link
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{platformLabel(problem.platform)}</TableCell>
                    <TableCell>{problem.difficulty}</TableCell>
                    <TableCell>
                      <StatusBadge status={statusMap[problem.id] ?? "Unsolved"} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{problem.attempts_count}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {lastAttemptMap[problem.id] ?? formatDate(problem.updated_at)}
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && filteredProblems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No problems yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>DSA Sheet</CardTitle>
            <span className="text-xs text-muted-foreground">
              {sheetProgress.done}/{sheetProgress.total} completed
            </span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={sheetInput}
                onChange={(event) => setSheetInput(event.target.value)}
                placeholder="Add a sheet problem"
              />
              <Button
                variant="outline"
                onClick={() => {
                  if (!sheetInput.trim()) return;
                  setSheetItems((prev) => [
                    ...prev,
                    { id: Date.now(), title: sheetInput.trim(), done: false },
                  ]);
                  setSheetInput("");
                }}
              >
                Add
              </Button>
            </div>
            <div className="space-y-2">
              {sheetItems.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span className={item.done ? "line-through text-muted-foreground" : ""}>
                    {item.title}
                  </span>
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() =>
                      setSheetItems((prev) =>
                        prev.map((entry) =>
                          entry.id === item.id ? { ...entry, done: !entry.done } : entry
                        )
                      )
                    }
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Notes</p>
            <Textarea
              value={sheetNotes}
              onChange={(event) => setSheetNotes(event.target.value)}
              placeholder="Add notes for your sheet progress"
              className="min-h-[180px]"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

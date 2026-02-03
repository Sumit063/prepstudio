import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
import {
  createProblemAttempt,
  deleteDsaProblem,
  getDsaProblem,
  listProblemAttempts,
  updateDsaProblem,
} from "../lib/api";
import type { DSAProblem, DSAAttempt } from "../lib/api";
import { formatDate } from "../lib/format";

const formatStatus = (status: DSAAttempt["status"]) => {
  if (status === "SOLVED") return "Solved";
  if (status === "PARTIAL") return "Partial";
  return "Unsolved";
};

const formatPlatform = (platform: DSAProblem["platform"]) => {
  if (platform === "LEETCODE") return "LeetCode";
  if (platform === "GFG") return "GFG";
  return "Custom";
};

const formatDifficulty = (difficulty: number) => {
  if (difficulty <= 2) return "Easy";
  if (difficulty === 3) return "Medium";
  return "Hard";
};

const defaultEditForm = {
  title: "",
  platform: "LEETCODE",
  link: "",
  difficulty: 3,
  tags: "",
  statement: "",
  solution_notes: "",
};

export const DsaDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [problem, setProblem] = useState<DSAProblem | null>(null);
  const [attempts, setAttempts] = useState<DSAAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attemptForm, setAttemptForm] = useState({
    status: "SOLVED",
    time_taken_minutes: 30,
    mistakes: "",
    notes: "",
  });
  const [savingAttempt, setSavingAttempt] = useState(false);
  const [editForm, setEditForm] = useState(defaultEditForm);
  const [savingEdit, setSavingEdit] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const [problemData, attemptData] = await Promise.all([
          getDsaProblem(Number(id)),
          listProblemAttempts(Number(id)),
        ]);
        if (!active) return;
        setProblem(problemData);
        setAttempts(attemptData);
        setEditForm({
          title: problemData.title,
          platform: problemData.platform,
          link: problemData.link ?? "",
          difficulty: problemData.difficulty,
          tags: problemData.tags.join(", "),
          statement: problemData.statement,
          solution_notes: problemData.solution_notes,
        });
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load problem");
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
  }, [id]);

  const handleAddAttempt = async () => {
    if (!id) return;
    setSavingAttempt(true);
    setActionError(null);
    try {
      await createProblemAttempt(Number(id), {
        status: attemptForm.status as DSAAttempt["status"],
        time_taken_minutes: Number(attemptForm.time_taken_minutes),
        mistakes: attemptForm.mistakes,
        notes: attemptForm.notes,
      });
      const refreshed = await listProblemAttempts(Number(id));
      setAttempts(refreshed);
      setAttemptForm({ status: "SOLVED", time_taken_minutes: 30, mistakes: "", notes: "" });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to add attempt");
    } finally {
      setSavingAttempt(false);
    }
  };

  const handleUpdate = async () => {
    if (!problem) return;
    setSavingEdit(true);
    setActionError(null);
    try {
      const updated = await updateDsaProblem(problem.id, {
        title: editForm.title,
        platform: editForm.platform as DSAProblem["platform"],
        link: editForm.link,
        difficulty: Number(editForm.difficulty),
        tags: editForm.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        statement: editForm.statement,
        solution_notes: editForm.solution_notes,
      });
      setProblem(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update problem");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!problem) return;
    if (!window.confirm("Delete this problem?")) return;
    try {
      await deleteDsaProblem(problem.id);
      navigate("/dsa");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete problem");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Link to="/dsa" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to DSA
        </Link>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">Loading problem...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="space-y-4">
        <Link to="/dsa" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to DSA
        </Link>
        <Card>
          <CardContent>
            <p className="text-sm">Problem not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/dsa" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to DSA
        </Link>
        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Edit problem</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit problem</DialogTitle>
                <DialogDescription>Update metadata and notes.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">Title</label>
                  <Input
                    value={editForm.title}
                    onChange={(event) => setEditForm({ ...editForm, title: event.target.value })}
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">Platform</label>
                  <Select
                    value={editForm.platform}
                    onChange={(event) =>
                      setEditForm({ ...editForm, platform: event.target.value })
                    }
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
                      value={String(editForm.difficulty)}
                      onChange={(event) =>
                        setEditForm({ ...editForm, difficulty: Number(event.target.value) })
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
                      value={editForm.tags}
                      onChange={(event) => setEditForm({ ...editForm, tags: event.target.value })}
                      placeholder="arrays, hashmap"
                    />
                  </div>
                </div>
                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">Link</label>
                  <Input
                    value={editForm.link}
                    onChange={(event) => setEditForm({ ...editForm, link: event.target.value })}
                    placeholder="https://"
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">Statement</label>
                  <Textarea
                    value={editForm.statement}
                    onChange={(event) =>
                      setEditForm({ ...editForm, statement: event.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">Solution notes</label>
                  <Textarea
                    value={editForm.solution_notes}
                    onChange={(event) =>
                      setEditForm({ ...editForm, solution_notes: event.target.value })
                    }
                  />
                </div>
                {actionError && (
                  <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                    {actionError}
                  </div>
                )}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <Button onClick={handleUpdate} disabled={savingEdit}>
                  {savingEdit ? "Saving..." : "Save changes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-border bg-muted px-4 py-2 text-sm text-muted-foreground">
          Error: {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{problem.title}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Platform</p>
            <p className="text-sm font-medium">{formatPlatform(problem.platform)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Difficulty</p>
            <p className="text-sm font-medium">{formatDifficulty(problem.difficulty)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tags</p>
            <p className="text-sm font-medium">{problem.tags.join(", ") || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Link</p>
            {problem.link ? (
              <a
                href={problem.link}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-accent hover:text-accent-hover"
              >
                Open problem
              </a>
            ) : (
              <p className="text-sm font-medium">—</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last updated</p>
            <p className="text-sm font-medium">{formatDate(problem.updated_at)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attempts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map((attempt) => (
                  <TableRow key={attempt.id}>
                    <TableCell>{formatStatus(attempt.status)}</TableCell>
                    <TableCell>{attempt.time_taken_minutes}m</TableCell>
                    <TableCell className="text-muted-foreground">
                      {attempt.notes || attempt.mistakes || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(attempt.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
                {attempts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No attempts yet.
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
          <CardTitle>Add attempt</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Status</label>
              <Select
                value={attemptForm.status}
                onChange={(event) =>
                  setAttemptForm({ ...attemptForm, status: event.target.value })
                }
              >
                <option value="SOLVED">Solved</option>
                <option value="PARTIAL">Partial</option>
                <option value="UNSOLVED">Unsolved</option>
              </Select>
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Time (minutes)</label>
              <Input
                type="number"
                value={attemptForm.time_taken_minutes}
                onChange={(event) =>
                  setAttemptForm({
                    ...attemptForm,
                    time_taken_minutes: Number(event.target.value),
                  })
                }
              />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Mistakes</label>
              <Input
                value={attemptForm.mistakes}
                onChange={(event) => setAttemptForm({ ...attemptForm, mistakes: event.target.value })}
                placeholder="Edge cases, complexity"
              />
            </div>
            <div className="grid gap-1 md:col-span-3">
              <label className="text-xs text-muted-foreground">Notes</label>
              <Textarea
                value={attemptForm.notes}
                onChange={(event) => setAttemptForm({ ...attemptForm, notes: event.target.value })}
                placeholder="Key mistakes or insights"
              />
            </div>
          </div>
          {actionError && (
            <div className="mt-3 rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
              {actionError}
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <Button onClick={handleAddAttempt} disabled={savingAttempt}>
              {savingAttempt ? "Saving..." : "Add attempt"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

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
import { CodeSnippetsPanel } from "../components/dsa/CodeSnippetsPanel";
import { MergedEntryList } from "../components/buddies/MergedEntryList";
import {
  createProblemAttempt,
  deleteDsaProblem,
  listProblemAttempts,
  updateDsaProblem,
} from "../lib/api";
import type { DSAProblem, DSAAttempt } from "../lib/api";
import { formatDate } from "../lib/format";
import { useMergedView } from "../hooks/useMergedView";

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

const normalizeLabel = (value: string) => value.trim().toLowerCase();

const filterBucketTags = (tags: string[], buckets: string[]) => {
  const bucketSet = new Set(buckets.map(normalizeLabel));
  return tags.filter((tag) => !bucketSet.has(normalizeLabel(tag)));
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
  const problemId = id ? Number(id) : undefined;
  const { state: mergedState, loading: mergedLoading, error: mergedError } = useMergedView(
    "dsa",
    problemId
  );
  const [problem, setProblem] = useState<DSAProblem | null>(null);
  const [attempts, setAttempts] = useState<DSAAttempt[]>([]);
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
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (mergedState.kind !== "dsa" || !mergedState.data) return;
    const data = mergedState.data;
    setProblem(data.problem);
    const visibleTags = filterBucketTags(
      data.problem.tags ?? [],
      data.problem.bucket_labels ?? []
    );
    setEditForm({
      title: data.problem.title,
      platform: data.problem.platform,
      link: data.problem.link ?? "",
      difficulty: data.problem.difficulty,
      tags: visibleTags.join(", "),
      statement: data.problem.statement,
      solution_notes: data.problem.solution_notes,
    });
  }, [mergedState]);

  useEffect(() => {
    let active = true;
    const loadAttempts = async () => {
      if (!problemId || !problem || problem.is_owner === false) {
        setAttempts([]);
        return;
      }
      try {
        const data = await listProblemAttempts(problemId);
        if (!active) return;
        setAttempts(data);
      } catch {
        if (active) {
          setAttempts([]);
        }
      }
    };
    loadAttempts();
    return () => {
      active = false;
    };
  }, [problemId, problem]);

  const mergedEntries =
    mergedState.kind === "dsa" && mergedState.data ? mergedState.data.entries : [];
  const currentUserId =
    mergedState.kind === "dsa" && mergedState.data ? mergedState.data.current_user_id : undefined;
  const isOwner = problem ? problem.is_owner !== false : false;

  const handleAddAttempt = async () => {
    if (!id || !isOwner) {
      setActionError("Buddy entries are read-only.");
      return;
    }
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
    if (!problem || !isOwner) return;
    setSavingEdit(true);
    setActionError(null);
    try {
      const bucketLabels = problem.bucket_labels ?? [];
      const filteredTags = filterBucketTags(
        editForm.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        bucketLabels
      );
      const updated = await updateDsaProblem(problem.id, {
        title: editForm.title,
        platform: editForm.platform as DSAProblem["platform"],
        link: editForm.link,
        difficulty: Number(editForm.difficulty),
        tags: filteredTags,
        statement: editForm.statement,
        solution_notes: editForm.solution_notes,
      });
      setProblem(updated);
      setEditOpen(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update problem");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!problem || !isOwner) return;
    if (!window.confirm("Delete this problem?")) return;
    try {
      await deleteDsaProblem(problem.id);
      navigate("/dsa");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete problem");
    }
  };

  const handlePersistSnippets = async (payload: string) => {
    if (!problem || !isOwner) return;
    const updated = await updateDsaProblem(problem.id, { solution_notes: payload });
    setProblem(updated);
    setEditForm((prev) => ({ ...prev, solution_notes: updated.solution_notes }));
  };


  if (mergedLoading) {
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
          {isOwner && (
            <>
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
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
            </>
          )}
        </div>
      </div>

      {mergedError && (
        <div className="rounded-md border border-border bg-muted px-4 py-2 text-sm text-muted-foreground">
          Error: {mergedError}
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
            <p className="text-sm font-medium">
              {filterBucketTags(problem.tags ?? [], problem.bucket_labels ?? []).join(", ") || "—"}
            </p>
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
          <div className="max-h-[360px] overflow-y-auto">
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
          <CardTitle>Code snippets</CardTitle>
        </CardHeader>
        <CardContent>
          <CodeSnippetsPanel
            source={problem.solution_notes}
            onPersist={isOwner ? handlePersistSnippets : undefined}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Merged notes</CardTitle>
        </CardHeader>
        <CardContent>
          <MergedEntryList
            entries={mergedEntries}
            currentUserId={currentUserId}
            buddyEmptyLabel="No buddy snippets for this question."
            onlyBuddies
            enableFullscreen
          />
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
            <Button onClick={handleAddAttempt} disabled={savingAttempt || !isOwner}>
              {savingAttempt ? "Saving..." : "Add attempt"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

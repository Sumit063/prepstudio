import { Link2, Plus, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import type { PartialBlock } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
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
import { SystemDesignCanvas } from "../components/SystemDesignCanvas";
import type { DesignCanvasScene } from "../components/SystemDesignCanvas";
import { Input, Textarea } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { deleteDesignTopic, updateDesignTopic } from "../lib/api";
import type { DesignTopic } from "../lib/api";
import { cn } from "../lib/cn";
import { formatDate } from "../lib/format";
import { MergedEntryList } from "../components/buddies/MergedEntryList";
import { useMergedView } from "../hooks/useMergedView";

const categories = [
  { value: "HLD", label: "HLD" },
  { value: "LLD", label: "LLD" },
  { value: "DB", label: "DB" },
  { value: "CACHE", label: "Cache" },
  { value: "QUEUE", label: "Queue" },
  { value: "SCALING", label: "Scaling" },
  { value: "CONSISTENCY", label: "Consistency" },
] as const;

type CategoryValue = (typeof categories)[number]["value"];

type ReferenceItem = {
  id: number;
  label: string;
  url: string;
};

const emptyNoteBlocks: PartialBlock[] = [{ type: "paragraph", content: "" }];

const toNoteBlocks = (raw?: string | null): PartialBlock[] => {
  if (!raw) return emptyNoteBlocks;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as PartialBlock[];
    }
  } catch {
    // fallback to plain text below
  }
  const text = raw.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").trim();
  if (!text) return emptyNoteBlocks;
  return [{ type: "paragraph", content: text }];
};

const normalizeLabel = (value: string) => value.trim().toLowerCase();

const filterBucketTags = (tags: string[], buckets: string[]) => {
  const bucketSet = new Set(buckets.map(normalizeLabel));
  return tags.filter((tag) => !bucketSet.has(normalizeLabel(tag)));
};

const useIsDark = () => {
  const [isDark, setIsDark] = useState(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : false
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains("dark"));
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
};

const badgeBase =
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium";

const emptyForm = {
  title: "",
  category: "HLD" as CategoryValue,
  tags: "",
  notes_markdown: "",
  tradeoffs: "",
};

export const DesignDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const topicId = id ? Number(id) : undefined;
  const { state: mergedState, loading: mergedLoading, error: mergedError } = useMergedView(
    "design",
    topicId
  );
  const [topic, setTopic] = useState<DesignTopic | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [tradeoffsDraft, setTradeoffsDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState(() => JSON.stringify(emptyNoteBlocks));
  const [noteBlocks, setNoteBlocks] = useState<PartialBlock[]>(emptyNoteBlocks);
  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [referenceDraft, setReferenceDraft] = useState({ label: "", url: "" });
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [bucketLabels, setBucketLabels] = useState<string[]>([]);
  const [isImportant, setIsImportant] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [canvasDraft, setCanvasDraft] = useState<DesignCanvasScene | null>(null);
  const [bucketInput, setBucketInput] = useState("");
  const [editorOffset, setEditorOffset] = useState(96);

  const isDark = useIsDark();
  const editor = useCreateBlockNote(
    {
      initialContent: noteBlocks,
    },
    [noteBlocks]
  );

  useEffect(() => {
    if (mergedState.kind !== "design" || !mergedState.data) return;
    const data = mergedState.data.topic;
    setTopic(data);
    const visibleTags = filterBucketTags(data.tags ?? [], data.bucket_labels ?? []);
    setEditForm({
      title: data.title,
      category: data.category as CategoryValue,
      tags: visibleTags.join(", "),
      notes_markdown: data.notes_markdown,
      tradeoffs: data.tradeoffs,
    });
    setTradeoffsDraft(data.tradeoffs ?? "");
    const parsedNotes = toNoteBlocks(data.notes_markdown);
    setNoteBlocks(parsedNotes);
    setNotesDraft(JSON.stringify(parsedNotes));
    const normalized = Array.isArray(data.references_json)
      ? data.references_json.map((ref, index) => {
          if (typeof ref === "string") {
            return { id: index + 1, label: ref, url: ref };
          }
          if (ref && typeof ref === "object") {
            const label =
              "label" in ref
                ? String((ref as { label?: string }).label ?? "Reference")
                : "Reference";
            const url = "url" in ref ? String((ref as { url?: string }).url ?? "") : "";
            return { id: index + 1, label, url };
          }
          return { id: index + 1, label: "Reference", url: "" };
        })
      : [];
    setReferences(normalized);
    setBucketLabels(data.bucket_labels ?? []);
    setIsImportant(Boolean(data.is_important));
    setIsDone(Boolean(data.is_done));
    setCanvasDraft((data.canvas_json as DesignCanvasScene) ?? null);
  }, [mergedState]);

  const mergedEntries =
    mergedState.kind === "design" && mergedState.data ? mergedState.data.entries : [];
  const currentUserId =
    mergedState.kind === "design" && mergedState.data ? mergedState.data.current_user_id : undefined;
  const isOwner = topic ? topic.is_owner !== false : false;

  useEffect(() => {
    const computeOffset = () => {
      const header = document.querySelector("header");
      const headerHeight = header?.getBoundingClientRect().height ?? 0;
      const verticalPadding = 32;
      setEditorOffset(headerHeight + verticalPadding);
    };
    computeOffset();
    window.addEventListener("resize", computeOffset);
    return () => window.removeEventListener("resize", computeOffset);
  }, []);

  const persistMeta = async (patch: Partial<DesignTopic>, fallback: { isImportant: boolean; isDone: boolean }) => {
    if (!topic) return;
    setActionError(null);
    try {
      const updated = await updateDesignTopic(topic.id, patch);
      setTopic(updated);
      setIsImportant(Boolean(updated.is_important));
      setIsDone(Boolean(updated.is_done));
    } catch (err) {
      setIsImportant(fallback.isImportant);
      setIsDone(fallback.isDone);
      setActionError(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const toggleImportant = () => {
    if (!isOwner) {
      setActionError("Buddy entries are read-only.");
      return;
    }
    const next = !isImportant;
    const fallback = { isImportant, isDone };
    setIsImportant(next);
    persistMeta({ is_important: next }, fallback);
  };

  const toggleDone = () => {
    if (!isOwner) {
      setActionError("Buddy entries are read-only.");
      return;
    }
    const next = !isDone;
    const fallback = { isImportant, isDone };
    setIsDone(next);
    persistMeta({ is_done: next }, fallback);
  };

  const handleAddBucket = () => {
    if (!isOwner) return;
    const trimmed = bucketInput.trim();
    if (!trimmed) return;
    const normalized = normalizeLabel(trimmed);
    setBucketLabels((prev) => {
      if (prev.map(normalizeLabel).includes(normalized)) return prev;
      return [...prev, normalized];
    });
    setBucketInput("");
  };

  const removeBucket = (bucket: string) => {
    if (!isOwner) return;
    setBucketLabels((prev) => prev.filter((item) => item !== bucket));
  };

  const handleAddReference = () => {
    if (!isOwner) return;
    if (!referenceDraft.label.trim() && !referenceDraft.url.trim()) return;
    const label = referenceDraft.label.trim() || referenceDraft.url.trim();
    const url = referenceDraft.url.trim();
    setReferences((prev) => [...prev, { id: Date.now(), label, url }]);
    setReferenceDraft({ label: "", url: "" });
  };

  const removeReference = (refId: number) => {
    if (!isOwner) return;
    setReferences((prev) => prev.filter((ref) => ref.id !== refId));
  };

  const handleSave = async () => {
    if (!topic || !isOwner) return;
    setSaving(true);
    setActionError(null);
    try {
      const payload: Partial<DesignTopic> = {
        title: editForm.title,
        category: editForm.category,
        tags: filterBucketTags(
          editForm.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          bucketLabels
        ),
        notes_markdown: notesDraft,
        tradeoffs: tradeoffsDraft,
        references_json: references.map((ref) => ({ label: ref.label, url: ref.url })),
        bucket_labels: bucketLabels,
        is_important: isImportant,
        is_done: isDone,
        canvas_json: canvasDraft ?? {},
      };
      const updated = await updateDesignTopic(topic.id, payload);
      setTopic(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!topic || !isOwner) return;
    if (!window.confirm("Delete this topic?")) return;
    try {
      await deleteDesignTopic(topic.id);
      navigate("/design");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete topic");
    }
  };

  if (mergedLoading) {
    return (
      <div className="space-y-4">
        <Link to="/design" className="text-sm text-muted-foreground hover:text-foreground">
          Back to Design Sheet
        </Link>
        <div className="rounded-md border border-border bg-surface p-4 text-sm text-muted-foreground">
          Loading topic...
        </div>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="space-y-4">
        <Link to="/design" className="text-sm text-muted-foreground hover:text-foreground">
          Back to Design Sheet
        </Link>
        <div className="rounded-md border border-border bg-surface p-4 text-sm">
          Topic not found.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <Link to="/design" className="text-sm text-muted-foreground hover:text-foreground">
            Back to Design Sheet
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base font-semibold">{topic.title}</h1>
            <span className="text-xs text-muted-foreground">
              {topic.category} • Updated {formatDate(topic.updated_at)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isOwner && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleDone}
                className={cn(
                  "border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10",
                  isDone && "bg-emerald-500 text-white hover:bg-emerald-500"
                )}
              >
                {isDone ? "Done" : "Mark done"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleImportant}
                className={cn(
                  "border-amber-500/40 text-amber-600 hover:bg-amber-500/10",
                  isImportant && "bg-amber-500 text-white hover:bg-amber-500"
                )}
              >
                <Star className={cn("h-3.5 w-3.5", isImportant && "fill-white")} />
                {isImportant ? "Important" : "Mark important"}
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">Edit metadata</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit topic</DialogTitle>
                    <DialogDescription>Update title, tags, and category.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-3">
                    <div className="grid gap-1">
                      <label className="text-xs text-muted-foreground">Title</label>
                      <Input
                        value={editForm.title}
                        onChange={(event) => setEditForm({ ...editForm, title: event.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1">
                        <label className="text-xs text-muted-foreground">Category</label>
                        <Select
                          value={editForm.category}
                          onChange={(event) =>
                            setEditForm({ ...editForm, category: event.target.value as CategoryValue })
                          }
                        >
                          {categories.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="grid gap-1">
                        <label className="text-xs text-muted-foreground">Tags</label>
                        <Input
                          value={editForm.tags}
                          onChange={(event) => setEditForm({ ...editForm, tags: event.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="ghost">Close</Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button variant="outline" size="sm" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
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
      {actionError && (
        <div className="rounded-md border border-border bg-muted px-4 py-2 text-sm text-muted-foreground">
          {actionError}
        </div>
      )}

      <div className="rounded-md border border-border bg-surface px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Buckets</span>
          {bucketLabels.map((bucket) => (
            <span
              key={bucket}
              className={cn(badgeBase, "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400")}
            >
              {bucket}
              <button
                type="button"
                onClick={() => removeBucket(bucket)}
                className="ml-2 text-[11px] text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </span>
          ))}
          {bucketLabels.length === 0 && (
            <span className="text-xs text-muted-foreground">No buckets</span>
          )}
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <Input
              value={bucketInput}
              onChange={(event) => setBucketInput(event.target.value)}
              placeholder="Add bucket label"
              className="h-8 text-xs sm:w-48"
              disabled={!isOwner}
            />
            <Button variant="outline" size="sm" onClick={handleAddBucket}>
              Add bucket
            </Button>
          </div>
        </div>
      </div>

      <SystemDesignCanvas
        key={topic.id}
        initialScene={canvasDraft}
        onSceneChange={isOwner ? setCanvasDraft : undefined}
        readOnly={!isOwner}
      />

      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Solution page</p>
        <div
          className={cn(
            "mt-3 w-full overflow-y-auto rounded-md border border-border px-1 py-1",
            "bg-white dark:bg-black"
          )}
          style={{ maxHeight: `calc(100vh - ${editorOffset}px)` }}
        >
          <BlockNoteView
            editor={editor}
            theme={isDark ? "dark" : "light"}
            editable={isOwner}
            onChange={() => {
              // Persist this JSON string later via backend save.
              if (isOwner) {
                setNotesDraft(JSON.stringify(editor.document));
              }
            }}
            className={cn(
              "w-full text-[12px] leading-5",
              "dark:[--bn-colors-editor-background:#000000]",
              "dark:[--bn-colors-editor-text:#fafafa]",
              "dark:[--bn-colors-menu-background:#0b0b0f]",
              "dark:[--bn-colors-menu-text:#fafafa]",
              "dark:[--bn-colors-border:#27272a]",
              "dark:[--bn-colors-hovered-background:#18181b]",
              "dark:[--bn-colors-selected-background:#2563eb]",
              "dark:[--bn-colors-selected-text:#ffffff]",
              "[&_.bn-container]:bg-white dark:[&_.bn-container]:bg-black",
              "[&_.bn-editor]:w-full [&_.bn-editor]:max-w-none",
              "[&_.bn-editor]:px-2 [&_.bn-editor]:py-2",
              "[&_.bn-editor]:text-[12px] [&_.bn-editor]:leading-5",
              "[&_.bn-editor]:min-h-0"
            )}
          />
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Merged entries</p>
        <div className="mt-3">
          <MergedEntryList
            entries={mergedEntries}
            currentUserId={currentUserId}
            buddyEmptyLabel="No buddy snippets for this topic."
            onlyBuddies
            enableFullscreen
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Tradeoffs</p>
            <Textarea
              value={tradeoffsDraft}
              onChange={(event) => setTradeoffsDraft(event.target.value)}
              placeholder="Latency vs throughput, consistency vs availability"
              className="mt-2 min-h-[280px]"
              disabled={!isOwner}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-md border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">References</p>
            <div className="mt-3 grid gap-2">
              <Input
                value={referenceDraft.label}
                onChange={(event) =>
                  setReferenceDraft((prev) => ({ ...prev, label: event.target.value }))
                }
                placeholder="Label"
                disabled={!isOwner}
              />
              <Input
                value={referenceDraft.url}
                onChange={(event) =>
                  setReferenceDraft((prev) => ({ ...prev, url: event.target.value }))
                }
                placeholder="https://youtube.com/..."
                disabled={!isOwner}
              />
              <Button variant="outline" onClick={handleAddReference} disabled={!isOwner}>
                <Plus className="h-4 w-4" />
                Add link
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              {references.map((ref) => (
                <div
                  key={ref.id}
                  className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{ref.label}</div>
                      {ref.url && (
                        <a
                          href={ref.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-accent hover:text-accent-hover"
                        >
                          {ref.url}
                        </a>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeReference(ref.id)} disabled={!isOwner}>
                    Remove
                  </Button>
                </div>
              ))}
              {references.length === 0 && (
                <p className="text-xs text-muted-foreground">No references yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-md border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Tags</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {filterBucketTags(topic.tags ?? [], bucketLabels).map((tag) => (
                <span
                  key={tag}
                  className={cn(badgeBase, "border-border bg-background text-muted-foreground")}
                >
                  {tag}
                </span>
              ))}
              {filterBucketTags(topic.tags ?? [], bucketLabels).length === 0 && (
                <span className="text-xs text-muted-foreground">No tags added.</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import { Link2, Plus, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
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
import { Input, Textarea } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { deleteDesignTopic, getDesignTopic, updateDesignTopic } from "../lib/api";
import type { DesignTopic } from "../lib/api";
import { cn } from "../lib/cn";
import { formatDate } from "../lib/format";

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

type SheetMeta = Record<number, { important: boolean; done: boolean; buckets: string[] }>;

const badgeBase =
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium";

const readSheetMeta = (): SheetMeta => {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.localStorage.getItem("designSheetMeta");
    if (!stored) return {};
    return JSON.parse(stored) as SheetMeta;
  } catch {
    return {};
  }
};

const writeSheetMeta = (meta: SheetMeta) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("designSheetMeta", JSON.stringify(meta));
};

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
  const [topic, setTopic] = useState<DesignTopic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [tradeoffsDraft, setTradeoffsDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [referenceDraft, setReferenceDraft] = useState({ label: "", url: "" });
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sheetMeta, setSheetMeta] = useState<SheetMeta>(() => readSheetMeta());
  const [bucketInput, setBucketInput] = useState("");

  const editor = useEditor(
    {
      extensions: [StarterKit],
      content: notesDraft,
      onUpdate: ({ editor }) => {
        setNotesDraft(editor.getHTML());
      },
      editorProps: {
        attributes: {
          class:
            "min-h-[280px] rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none",
        },
      },
    },
    []
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const data = await getDesignTopic(Number(id));
        if (!active) return;
        setTopic(data);
        setEditForm({
          title: data.title,
          category: data.category as CategoryValue,
          tags: data.tags.join(", "),
          notes_markdown: data.notes_markdown,
          tradeoffs: data.tradeoffs,
        });
        setTradeoffsDraft(data.tradeoffs ?? "");
        setNotesDraft(data.notes_markdown ?? "");
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
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load topic");
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

  useEffect(() => {
    if (editor) {
      editor.commands.setContent(notesDraft || "");
    }
  }, [editor, notesDraft]);

  useEffect(() => {
    writeSheetMeta(sheetMeta);
  }, [sheetMeta]);

  const meta = topic ? sheetMeta[topic.id] ?? { important: false, done: false, buckets: [] } : null;

  const toggleImportant = () => {
    if (!topic) return;
    setSheetMeta((prev) => {
      const current = prev[topic.id] ?? { important: false, done: false, buckets: [] };
      return { ...prev, [topic.id]: { ...current, important: !current.important } };
    });
  };

  const toggleDone = () => {
    if (!topic) return;
    setSheetMeta((prev) => {
      const current = prev[topic.id] ?? { important: false, done: false, buckets: [] };
      return { ...prev, [topic.id]: { ...current, done: !current.done } };
    });
  };

  const handleAddBucket = () => {
    if (!topic) return;
    const trimmed = bucketInput.trim();
    if (!trimmed) return;
    setSheetMeta((prev) => {
      const current = prev[topic.id] ?? { important: false, done: false, buckets: [] };
      if (current.buckets.includes(trimmed)) return prev;
      return {
        ...prev,
        [topic.id]: { ...current, buckets: [...current.buckets, trimmed] },
      };
    });
    setBucketInput("");
  };

  const removeBucket = (bucket: string) => {
    if (!topic) return;
    setSheetMeta((prev) => {
      const current = prev[topic.id] ?? { important: false, done: false, buckets: [] };
      return {
        ...prev,
        [topic.id]: { ...current, buckets: current.buckets.filter((item) => item !== bucket) },
      };
    });
  };

  const handleAddReference = () => {
    if (!referenceDraft.label.trim() && !referenceDraft.url.trim()) return;
    const label = referenceDraft.label.trim() || referenceDraft.url.trim();
    const url = referenceDraft.url.trim();
    setReferences((prev) => [...prev, { id: Date.now(), label, url }]);
    setReferenceDraft({ label: "", url: "" });
  };

  const removeReference = (refId: number) => {
    setReferences((prev) => prev.filter((ref) => ref.id !== refId));
  };

  const handleSave = async () => {
    if (!topic) return;
    setSaving(true);
    setActionError(null);
    try {
      const payload: Partial<DesignTopic> = {
        title: editForm.title,
        category: editForm.category,
        tags: editForm.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        notes_markdown: notesDraft,
        tradeoffs: tradeoffsDraft,
        references_json: references.map((ref) => ({ label: ref.label, url: ref.url })),
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
    if (!topic) return;
    if (!window.confirm("Delete this topic?")) return;
    try {
      await deleteDesignTopic(topic.id);
      navigate("/design");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete topic");
    }
  };

  if (loading) {
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
          <Button
            variant="outline"
            size="sm"
            onClick={toggleDone}
            className={cn(
              "border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10",
              meta?.done && "bg-emerald-500 text-white hover:bg-emerald-500"
            )}
          >
            {meta?.done ? "Done" : "Mark done"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleImportant}
            className={cn(
              "border-amber-500/40 text-amber-600 hover:bg-amber-500/10",
              meta?.important && "bg-amber-500 text-white hover:bg-amber-500"
            )}
          >
            <Star className={cn("h-3.5 w-3.5", meta?.important && "fill-white")} />
            {meta?.important ? "Important" : "Mark important"}
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
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-border bg-muted px-4 py-2 text-sm text-muted-foreground">
          Error: {error}
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
          {(meta?.buckets ?? []).map((bucket) => (
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
          {(meta?.buckets ?? []).length === 0 && (
            <span className="text-xs text-muted-foreground">No buckets</span>
          )}
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <Input
              value={bucketInput}
              onChange={(event) => setBucketInput(event.target.value)}
              placeholder="Add bucket label"
              className="h-8 text-xs sm:w-48"
            />
            <Button variant="outline" size="sm" onClick={handleAddBucket}>
              Add bucket
            </Button>
          </div>
        </div>
      </div>

      <SystemDesignCanvas />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Solution page</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => editor?.chain().focus().toggleBold().run()}
                disabled={!editor}
              >
                Bold
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                disabled={!editor}
              >
                Italic
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                disabled={!editor}
              >
                Bullets
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
                disabled={!editor}
              >
                Code block
              </Button>
            </div>
            <div className="mt-3">
              <EditorContent editor={editor} />
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Tradeoffs</p>
            <Textarea
              value={tradeoffsDraft}
              onChange={(event) => setTradeoffsDraft(event.target.value)}
              placeholder="Latency vs throughput, consistency vs availability"
              className="mt-2 min-h-[140px]"
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
              />
              <Input
                value={referenceDraft.url}
                onChange={(event) =>
                  setReferenceDraft((prev) => ({ ...prev, url: event.target.value }))
                }
                placeholder="https://youtube.com/..."
              />
              <Button variant="outline" onClick={handleAddReference}>
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
                  <Button variant="ghost" size="sm" onClick={() => removeReference(ref.id)}>
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
              {topic.tags.map((tag) => (
                <span
                  key={tag}
                  className={cn(badgeBase, "border-border bg-background text-muted-foreground")}
                >
                  {tag}
                </span>
              ))}
              {topic.tags.length === 0 && (
                <span className="text-xs text-muted-foreground">No tags added.</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

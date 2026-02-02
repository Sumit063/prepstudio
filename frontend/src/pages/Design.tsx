import { useEffect, useMemo, useRef, useState } from "react";
import { Link2, Plus, Trash2 } from "lucide-react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/Tabs";
import { createDesignTopic, deleteDesignTopic, listDesignTopics, updateDesignTopic } from "../lib/api";
import type { DesignTopic } from "../lib/api";
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

type CanvasNode = {
  id: number;
  title: string;
  x: number;
  y: number;
};

type CanvasEdge = {
  id: number;
  from: number;
  to: number;
};

const NODE_WIDTH = 160;
const NODE_HEIGHT = 64;

const emptyForm = {
  title: "",
  category: "HLD" as CategoryValue,
  tags: "",
  notes_markdown: "",
  tradeoffs: "",
};

export const Design = () => {
  const [topics, setTopics] = useState<DesignTopic[]>([]);
  const [activeCategory, setActiveCategory] = useState<CategoryValue>("HLD");
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState(emptyForm);
  const [savingEdit, setSavingEdit] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [topicDrafts, setTopicDrafts] = useState<Record<number, string>>({});
  const [referencesByTopic, setReferencesByTopic] = useState<Record<number, ReferenceItem[]>>({});
  const [referenceDraft, setReferenceDraft] = useState({ label: "", url: "" });

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await listDesignTopics();
        if (!active) return;
        setTopics(data.results);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load topics");
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
  }, []);

  const topicsByCategory = useMemo(() => {
    return categories.reduce((acc, category) => {
      acc[category.value] = topics.filter((topic) => topic.category === category.value);
      return acc;
    }, {} as Record<CategoryValue, DesignTopic[]>);
  }, [topics]);

  useEffect(() => {
    const list = topicsByCategory[activeCategory] ?? [];
    if (list.length === 0) {
      setSelectedTopicId(null);
      return;
    }
    if (!selectedTopicId || !list.find((topic) => topic.id === selectedTopicId)) {
      setSelectedTopicId(list[0].id);
    }
  }, [activeCategory, topicsByCategory, selectedTopicId]);

  const activeTopics = topicsByCategory[activeCategory] ?? [];
  const selectedTopic = activeTopics.find((topic) => topic.id === selectedTopicId) ?? activeTopics[0];
  const selectedTopicIdValue = selectedTopic?.id ?? null;

  const tracker = useMemo(() => {
    const total = topics.length;
    const activeCount = topicsByCategory[activeCategory]?.length ?? 0;
    const withNotes = topics.filter((topic) => topic.notes_markdown?.trim()).length;
    return { total, activeCount, withNotes };
  }, [topics, topicsByCategory, activeCategory]);

  useEffect(() => {
    if (selectedTopic) {
      setEditForm({
        title: selectedTopic.title,
        category: selectedTopic.category as CategoryValue,
        tags: selectedTopic.tags.join(", "),
        notes_markdown: selectedTopic.notes_markdown,
        tradeoffs: selectedTopic.tradeoffs,
      });
    }
  }, [selectedTopic]);

  useEffect(() => {
    if (!selectedTopic) return;
    setReferencesByTopic((prev) => {
      if (prev[selectedTopic.id]) return prev;
      const initial = Array.isArray(selectedTopic.references_json)
        ? selectedTopic.references_json
        : [];
      const normalized = initial.map((ref, index) => {
        if (typeof ref === "string") {
          return { id: index + 1, label: ref, url: ref };
        }
        if (ref && typeof ref === "object") {
          const label =
            "label" in ref
              ? String((ref as { label?: string }).label ?? "Reference")
              : "title" in ref
                ? String((ref as { title?: string }).title ?? "Reference")
                : "Reference";
          const url = "url" in ref ? String((ref as { url?: string }).url ?? "") : "";
          return { id: index + 1, label, url };
        }
        return { id: index + 1, label: "Reference", url: "" };
      });
      return { ...prev, [selectedTopic.id]: normalized };
    });
  }, [selectedTopic]);

  const editor = useEditor(
    {
      extensions: [StarterKit],
      content: selectedTopicIdValue
        ? topicDrafts[selectedTopicIdValue] ?? selectedTopic?.notes_markdown ?? ""
        : "",
      onUpdate: ({ editor }) => {
        if (!selectedTopicIdValue) return;
        setTopicDrafts((prev) => ({
          ...prev,
          [selectedTopicIdValue]: editor.getHTML(),
        }));
      },
      editorProps: {
        attributes: {
          class:
            "min-h-[260px] rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none",
        },
      },
    },
    [selectedTopicIdValue]
  );

  const activeReferences = selectedTopicIdValue
    ? referencesByTopic[selectedTopicIdValue] ?? []
    : [];

  const handleCreate = async () => {
    setSaving(true);
    setActionError(null);
    try {
      const payload: Partial<DesignTopic> = {
        title: form.title,
        category: form.category,
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        notes_markdown: form.notes_markdown,
        tradeoffs: form.tradeoffs,
        references_json: [],
      };
      await createDesignTopic(payload);
      setForm(emptyForm);
      const data = await listDesignTopics();
      setTopics(data.results);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to create topic");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedTopic) return;
    setSavingEdit(true);
    setActionError(null);
    try {
      const updated = await updateDesignTopic(selectedTopic.id, {
        title: editForm.title,
        category: editForm.category,
        tags: editForm.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        notes_markdown: editForm.notes_markdown,
        tradeoffs: editForm.tradeoffs,
      });
      setTopics((prev) => prev.map((topic) => (topic.id === updated.id ? updated : topic)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update topic");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTopic) return;
    if (!window.confirm("Delete this topic?")) return;
    try {
      await deleteDesignTopic(selectedTopic.id);
      setTopics((prev) => prev.filter((topic) => topic.id !== selectedTopic.id));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete topic");
    }
  };

  const handleAddReference = () => {
    if (!selectedTopicIdValue) return;
    if (!referenceDraft.label.trim() && !referenceDraft.url.trim()) return;
    const label = referenceDraft.label.trim() || referenceDraft.url.trim();
    const url = referenceDraft.url.trim();
    setReferencesByTopic((prev) => ({
      ...prev,
      [selectedTopicIdValue]: [
        ...(prev[selectedTopicIdValue] ?? []),
        { id: Date.now(), label, url },
      ],
    }));
    setReferenceDraft({ label: "", url: "" });
  };

  const removeReference = (refId: number) => {
    if (!selectedTopicIdValue) return;
    setReferencesByTopic((prev) => ({
      ...prev,
      [selectedTopicIdValue]: (prev[selectedTopicIdValue] ?? []).filter((ref) => ref.id !== refId),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">System Design</p>
          <h1 className="text-2xl font-semibold">Design sheets</h1>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Add topic
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add design topic</DialogTitle>
              <DialogDescription>Capture architecture notes and tradeoffs.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Title</label>
                <Input
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="Rate limiter"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">Category</label>
                  <Select
                    value={form.category}
                    onChange={(event) =>
                      setForm({ ...form, category: event.target.value as CategoryValue })
                    }
                  >
                    {categories.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">Tags</label>
                  <Input
                    value={form.tags}
                    onChange={(event) => setForm({ ...form, tags: event.target.value })}
                    placeholder="redis, tokens"
                  />
                </div>
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Notes</label>
                <Textarea
                  value={form.notes_markdown}
                  onChange={(event) => setForm({ ...form, notes_markdown: event.target.value })}
                  placeholder="Add architecture notes"
                />
              </div>
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Tradeoffs</label>
                <Textarea
                  value={form.tradeoffs}
                  onChange={(event) => setForm({ ...form, tradeoffs: event.target.value })}
                  placeholder="Latency vs cost"
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
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? "Saving..." : "Save topic"}
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
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Total topics</p>
                <p className="text-lg font-semibold">{tracker.total}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">In category</p>
                <p className="text-lg font-semibold">{tracker.activeCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">With notes</p>
                <p className="text-lg font-semibold">{tracker.withNotes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Study flow</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Use the sheet list to select a topic, then expand the workspace for deeper notes and diagrams.
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeCategory} onValueChange={(value) => setActiveCategory(value as CategoryValue)}>
        <TabsList>
          {categories.map((category) => (
            <TabsTrigger key={category.value} value={category.value}>
              {category.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((category) => (
          <TabsContent key={category.value} value={category.value}>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{category.label} sheet</CardTitle>
                    <span className="text-xs text-muted-foreground">
                      {(topicsByCategory[category.value] ?? []).length} topics
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {loading && <p className="text-xs text-muted-foreground">Loading topics...</p>}
                  {(topicsByCategory[category.value] ?? []).map((topic) => (
                    <button
                      key={topic.id}
                      onClick={() => setSelectedTopicId(topic.id)}
                      className={`flex w-full items-start justify-between gap-3 rounded-md border px-3 py-2 text-left ${
                        topic.id === selectedTopicId
                          ? "border-accent bg-muted"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <div>
                        <div className="text-sm font-medium text-foreground">{topic.title}</div>
                        <div className="text-xs text-muted-foreground">
                          Updated {formatDate(topic.updated_at)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {topic.tags.join(" • ") || "No tags"}
                        </div>
                      </div>
                      <span className="text-[11px] text-muted-foreground">{topic.category}</span>
                    </button>
                  ))}
                  {!loading && (topicsByCategory[category.value] ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground">No topics yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="max-w-none">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>{selectedTopic?.title ?? "Select a topic"}</CardTitle>
                      {selectedTopic && (
                        <p className="text-xs text-muted-foreground">
                          {selectedTopic.category} • Updated {formatDate(selectedTopic.updated_at)}
                        </p>
                      )}
                    </div>
                    {selectedTopic && (
                      <div className="flex items-center gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">Edit</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit topic</DialogTitle>
                              <DialogDescription>Update design notes and tradeoffs.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-3">
                              <div className="grid gap-1">
                                <label className="text-xs text-muted-foreground">Title</label>
                                <Input
                                  value={editForm.title}
                                  onChange={(event) =>
                                    setEditForm({ ...editForm, title: event.target.value })
                                  }
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-1">
                                  <label className="text-xs text-muted-foreground">Category</label>
                                  <Select
                                    value={editForm.category}
                                    onChange={(event) =>
                                      setEditForm({
                                        ...editForm,
                                        category: event.target.value as CategoryValue,
                                      })
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
                                    onChange={(event) =>
                                      setEditForm({ ...editForm, tags: event.target.value })
                                    }
                                  />
                                </div>
                              </div>
                              <div className="grid gap-1">
                                <label className="text-xs text-muted-foreground">Notes</label>
                                <Textarea
                                  value={editForm.notes_markdown}
                                  onChange={(event) =>
                                    setEditForm({ ...editForm, notes_markdown: event.target.value })
                                  }
                                />
                              </div>
                              <div className="grid gap-1">
                                <label className="text-xs text-muted-foreground">Tradeoffs</label>
                                <Textarea
                                  value={editForm.tradeoffs}
                                  onChange={(event) =>
                                    setEditForm({ ...editForm, tradeoffs: event.target.value })
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
                        <Button variant="outline" size="sm" onClick={handleDelete}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {!selectedTopic && (
                    <p className="text-sm text-muted-foreground">
                      Select a topic to start capturing your design notes.
                    </p>
                  )}
                  {selectedTopic && (
                    <>
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Solution page</p>
                        <div className="flex flex-wrap gap-2">
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
                        <EditorContent editor={editor} />
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Tradeoffs</p>
                        <Textarea
                          value={editForm.tradeoffs}
                          onChange={(event) =>
                            setEditForm((prev) => ({ ...prev, tradeoffs: event.target.value }))
                          }
                          placeholder="Latency vs throughput, consistency vs availability"
                          className="min-h-[120px]"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">References</p>
                          <span className="text-xs text-muted-foreground">{activeReferences.length} links</span>
                        </div>
                        <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
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
                            Add
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {activeReferences.map((ref) => (
                            <div
                              key={ref.id}
                              className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm"
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
                          {activeReferences.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              Add reference links from YouTube, Medium, or docs.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Design canvas</p>
                        <CanvasBoard />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

const CanvasBoard = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: number; offsetX: number; offsetY: number } | null>(null);
  const [nodes, setNodes] = useState<CanvasNode[]>([
    { id: 1, title: "Client", x: 40, y: 40 },
    { id: 2, title: "API Gateway", x: 240, y: 40 },
    { id: 3, title: "Service", x: 240, y: 160 },
  ]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);
  const [connectMode, setConnectMode] = useState(false);
  const [connectFrom, setConnectFrom] = useState<number | null>(null);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      if (!dragRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const nextX = event.clientX - rect.left - dragRef.current.offsetX;
      const nextY = event.clientY - rect.top - dragRef.current.offsetY;
      const clampedX = Math.max(0, Math.min(rect.width - NODE_WIDTH, nextX));
      const clampedY = Math.max(0, Math.min(rect.height - NODE_HEIGHT, nextY));
      setNodes((prev) =>
        prev.map((node) =>
          node.id === dragRef.current?.id ? { ...node, x: clampedX, y: clampedY } : node
        )
      );
    };

    const handleUp = () => {
      dragRef.current = null;
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>, nodeId: number) => {
    if (connectMode) return;
    event.stopPropagation();
    const target = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      id: nodeId,
      offsetX: event.clientX - target.left,
      offsetY: event.clientY - target.top,
    };
  };

  const handleNodeClick = (nodeId: number) => {
    if (!connectMode) return;
    if (!connectFrom) {
      setConnectFrom(nodeId);
      return;
    }
    if (connectFrom === nodeId) return;
    setEdges((prev) => [...prev, { id: Date.now(), from: connectFrom, to: nodeId }]);
    setConnectFrom(null);
    setConnectMode(false);
  };

  const handleAddNode = () => {
    const container = containerRef.current?.getBoundingClientRect();
    const x = container ? container.width / 2 - NODE_WIDTH / 2 : 40;
    const y = container ? container.height / 2 - NODE_HEIGHT / 2 : 40;
    setNodes((prev) => [
      ...prev,
      { id: Date.now(), title: "New node", x: x + Math.random() * 20, y: y + Math.random() * 20 },
    ]);
  };

  const handleClear = () => {
    setNodes([]);
    setEdges([]);
    setConnectFrom(null);
    setConnectMode(false);
  };

  const getNodeCenter = (node: CanvasNode) => ({
    x: node.x + NODE_WIDTH / 2,
    y: node.y + NODE_HEIGHT / 2,
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleAddNode}>
          <Plus className="h-3 w-3" />
          Add node
        </Button>
        <Button
          variant={connectMode ? "primary" : "outline"}
          size="sm"
          onClick={() => {
            setConnectMode((prev) => !prev);
            setConnectFrom(null);
          }}
        >
          {connectMode ? "Select nodes" : "Connect nodes"}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleClear}>
          Clear
        </Button>
        {connectFrom && (
          <span className="text-xs text-muted-foreground">Select another node to connect.</span>
        )}
      </div>
      <div
        ref={containerRef}
        className="relative h-[360px] overflow-hidden rounded-md border border-border bg-background"
      >
        <svg className="absolute inset-0 h-full w-full">
          {edges.map((edge) => {
            const fromNode = nodes.find((node) => node.id === edge.from);
            const toNode = nodes.find((node) => node.id === edge.to);
            if (!fromNode || !toNode) return null;
            const from = getNodeCenter(fromNode);
            const to = getNodeCenter(toNode);
            return (
              <line
                key={edge.id}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="#71717a"
                strokeWidth="1.5"
              />
            );
          })}
        </svg>
        {nodes.map((node) => (
          <div
            key={node.id}
            role="button"
            tabIndex={0}
            onPointerDown={(event) => handlePointerDown(event, node.id)}
            onClick={() => handleNodeClick(node.id)}
            className={`absolute rounded-md border px-3 py-2 text-xs font-medium transition ${
              connectFrom === node.id ? "border-accent bg-muted" : "border-border bg-surface"
            }`}
            style={{ left: node.x, top: node.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
          >
            <input
              value={node.title}
              onChange={(event) =>
                setNodes((prev) =>
                  prev.map((entry) =>
                    entry.id === node.id ? { ...entry, title: event.target.value } : entry
                  )
                )
              }
              className="w-full bg-transparent text-xs font-medium text-foreground focus:outline-none"
            />
            <div className="mt-2 text-[11px] text-muted-foreground">Drag to reposition</div>
          </div>
        ))}
        {nodes.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Add nodes to start mapping the architecture.
          </div>
        )}
      </div>
    </div>
  );
};

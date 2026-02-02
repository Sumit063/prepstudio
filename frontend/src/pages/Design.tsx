import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import {
  Dialog,
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
import {
  DesignTopic,
  createDesignTopic,
  deleteDesignTopic,
  listDesignTopics,
  updateDesignTopic,
} from "../lib/api";
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">System Design</p>
          <h1 className="text-2xl font-semibold">Knowledge base</h1>
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
              <Button variant="ghost">Cancel</Button>
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
            <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Topics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {loading && (
                    <p className="text-xs text-muted-foreground">Loading topics...</p>
                  )}
                  {(topicsByCategory[category.value] ?? []).map((topic) => (
                    <button
                      key={topic.id}
                      onClick={() => setSelectedTopicId(topic.id)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                        topic.id === selectedTopicId
                          ? "border-accent bg-muted"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <div className="font-medium">{topic.title}</div>
                      <div className="text-xs text-muted-foreground">
                        Updated {formatDate(topic.updated_at)}
                      </div>
                    </button>
                  ))}
                  {!loading && (topicsByCategory[category.value] ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground">No topics yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{selectedTopic?.title ?? "Select a topic"}</CardTitle>
                    {selectedTopic && (
                      <div className="flex items-center gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline">Edit</Button>
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
                              <Button variant="ghost">Cancel</Button>
                              <Button onClick={handleUpdate} disabled={savingEdit}>
                                {savingEdit ? "Saving..." : "Save changes"}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button variant="outline" onClick={handleDelete}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
                    {selectedTopic?.notes_markdown || "Pick a topic to view notes."}
                  </div>
                  <div className="rounded-md border border-border bg-surface p-3 text-sm text-muted-foreground">
                    {selectedTopic?.tradeoffs || "Tradeoffs not captured yet."}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(selectedTopic?.tags ?? []).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md border border-border bg-surface px-2 py-1 text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

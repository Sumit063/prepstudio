import { useEffect, useMemo, useState } from "react";
import { Plus, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/Tabs";
import { createDesignTopic, listMergedDesignTopics, updateDesignTopic } from "../lib/api";
import type { DesignTopic } from "../lib/api";
import { cn } from "../lib/cn";
import { formatDate } from "../lib/format";
import { BuddyBadge } from "../components/buddies/BuddyBadge";
import { useBuddyContext } from "../contexts/BuddyContext";

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

const badgeBase =
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium";

const normalizeLabel = (value: string) => value.trim().toLowerCase();

const filterBucketTags = (tags: string[], buckets: string[]) => {
  const bucketSet = new Set(buckets.map(normalizeLabel));
  return tags.filter((tag) => !bucketSet.has(normalizeLabel(tag)));
};

const emptyForm = {
  title: "",
  category: "HLD" as CategoryValue,
  tags: "",
  notes_markdown: "",
  tradeoffs: "",
};

const LoadingSpinner = ({ label }: { label: string }) => (
  <div className="flex items-center gap-2 text-xs text-muted-foreground">
    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
    {label}
  </div>
);

export const Design = () => {
  const navigate = useNavigate();
  const { version } = useBuddyContext();
  const [topics, setTopics] = useState<DesignTopic[]>([]);
  const [activeCategory, setActiveCategory] = useState<CategoryValue>("HLD");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [importantFilter, setImportantFilter] = useState("All");
  const [bucketFilter, setBucketFilter] = useState("All");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await listMergedDesignTopics();
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
  }, [version]);

  const bucketOptions = useMemo(() => {
    const all = new Set<string>();
    topics.forEach((topic) => {
      (topic.bucket_labels ?? []).forEach((bucket) => all.add(normalizeLabel(bucket)));
    });
    return Array.from(all).sort();
  }, [topics]);

  const topicsByCategory = useMemo(() => {
    return categories.reduce((acc, category) => {
      acc[category.value] = topics.filter((topic) => topic.category === category.value);
      return acc;
    }, {} as Record<CategoryValue, DesignTopic[]>);
  }, [topics]);

  const filteredTopicsByCategory = useMemo(() => {
    return categories.reduce((acc, category) => {
      let list = topicsByCategory[category.value] ?? [];
      if (importantFilter === "Important") {
        list = list.filter((topic) => topic.is_important);
      }
      if (bucketFilter !== "All") {
        list = list.filter((topic) =>
          (topic.bucket_labels ?? []).some(
            (bucket) => normalizeLabel(bucket) === normalizeLabel(bucketFilter)
          )
        );
      }
      acc[category.value] = list;
      return acc;
    }, {} as Record<CategoryValue, DesignTopic[]>);
  }, [topicsByCategory, importantFilter, bucketFilter]);

  const tracker = useMemo(() => {
    const total = topics.length;
    const activeCount = topicsByCategory[activeCategory]?.length ?? 0;
    const withNotes = topics.filter((topic) => topic.notes_markdown?.trim()).length;
    return { total, activeCount, withNotes };
  }, [topics, topicsByCategory, activeCategory]);

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
      setCreateOpen(false);
      const data = await listMergedDesignTopics();
      setTopics(data.results);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to create topic");
    } finally {
      setSaving(false);
    }
  };

  const updateTopic = (topicId: number, patch: Partial<DesignTopic>) => {
    setTopics((prev) =>
      prev.map((topic) => (topic.id === topicId ? { ...topic, ...patch } : topic))
    );
  };

  const persistTopicMeta = async (topicId: number, patch: Partial<DesignTopic>) => {
    const current = topics.find((item) => item.id === topicId);
    if (!current) return;
    updateTopic(topicId, patch);
    try {
      const updated = await updateDesignTopic(topicId, patch);
      updateTopic(topicId, updated);
    } catch (err) {
      updateTopic(topicId, current);
      setActionError(err instanceof Error ? err.message : "Failed to save changes");
    }
  };

  const toggleImportant = (topicId: number) => {
    const topic = topics.find((item) => item.id === topicId);
    if (!topic) return;
    if (topic.is_owner === false) {
      setActionError("Buddy entries are read-only.");
      return;
    }
    persistTopicMeta(topicId, { is_important: !topic.is_important });
  };

  const toggleDone = (topicId: number) => {
    const topic = topics.find((item) => item.id === topicId);
    if (!topic) return;
    if (topic.is_owner === false) {
      setActionError("Buddy entries are read-only.");
      return;
    }
    persistTopicMeta(topicId, { is_done: !topic.is_done });
  };

  return (
    <div className="space-y-4">
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
      <div className="rounded-md border border-border bg-surface px-2 py-2">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-baseline gap-2">
              <span>Total</span>
              <span className="text-sm font-semibold text-foreground">{tracker.total}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span>In category</span>
              <span className="text-sm font-semibold text-foreground">{tracker.activeCount}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span>With notes</span>
              <span className="text-sm font-semibold text-foreground">{tracker.withNotes}</span>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 lg:ml-auto lg:w-auto lg:flex-nowrap">
            <Select
              value={importantFilter}
              onChange={(event) => setImportantFilter(event.target.value)}
              className="h-8 text-xs min-w-[140px]"
            >
              <option value="All">All topics</option>
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
                  {bucket}
                </option>
              ))}
            </Select>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" aria-label="Add topic">
                  <Plus className="h-4 w-4" />
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
        </div>
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
            <div className="rounded-md border border-border bg-surface p-2 lg:flex lg:h-[calc(100vh-200px)] lg:flex-col">
              <div className="space-y-2 lg:flex-1 lg:overflow-y-auto lg:pr-2">
                {loading && <LoadingSpinner label="Loading topics..." />}
                {(filteredTopicsByCategory[category.value] ?? []).map((topic) => {
                  const buckets = topic.bucket_labels ?? [];
                  const visibleTags = filterBucketTags(topic.tags ?? [], buckets);
                  return (
                    <div
                      key={topic.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/design/${topic.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          navigate(`/design/${topic.id}`);
                        }
                      }}
                      className="flex w-full items-start justify-between gap-3 rounded-md border border-border px-3 py-2 text-left transition hover:bg-muted"
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={topic.is_done}
                          onChange={(event) => {
                            event.stopPropagation();
                            toggleDone(topic.id);
                          }}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => event.stopPropagation()}
                          className="mt-1"
                          disabled={topic.is_owner === false}
                        />
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <div
                              className={cn(
                                "text-sm font-medium text-foreground",
                                topic.is_done && "line-through text-muted-foreground"
                              )}
                            >
                              {topic.title}
                            </div>
                            {topic.owner && topic.is_owner === false && (
                              <BuddyBadge user={topic.owner} size="xs" />
                            )}
                            {topic.is_done && (
                              <span
                                className={cn(
                                  badgeBase,
                                  "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                )}
                              >
                                Done
                              </span>
                            )}
                            {topic.is_important && (
                              <span
                                className={cn(
                                  badgeBase,
                                  "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                )}
                              >
                                Important
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Updated {formatDate(topic.updated_at)}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {buckets.map((bucket) => (
                              <span
                                key={bucket}
                                className={cn(
                                  badgeBase,
                                  "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400"
                                )}
                              >
                                {bucket}
                              </span>
                            ))}
                            {visibleTags.map((tag) => (
                              <span
                                key={tag}
                                className={cn(badgeBase, "border-border bg-surface text-muted-foreground")}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleImportant(topic.id);
                        }}
                        className="rounded-md text-muted-foreground hover:text-foreground"
                        aria-label="Toggle important"
                        disabled={topic.is_owner === false}
                      >
                        <Star
                          className={cn(
                            "h-4 w-4",
                            topic.is_important ? "text-amber-500 fill-amber-500" : "text-muted-foreground"
                          )}
                        />
                      </button>
                    </div>
                  );
                })}
                {!loading && (filteredTopicsByCategory[category.value] ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground">No topics yet.</p>
                )}
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

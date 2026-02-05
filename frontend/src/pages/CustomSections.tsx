import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import type { PartialBlock } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createCustomQuestion,
  createCustomSection,
  createCustomSubsection,
  deleteCustomQuestion,
  deleteCustomSection,
  deleteCustomSubsection,
  getMergedCustomQuestionDetail,
  listCustomQuestions,
  listCustomSections,
  listCustomSubsections,
  updateCustomQuestion,
} from "../lib/api";
import type { CustomQuestion, CustomSection, CustomSubsection, MergedEntry } from "../lib/api";
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
import { cn } from "../lib/cn";
import { formatDate } from "../lib/format";
import { useBuddyContext } from "../contexts/BuddyContext";

const emptyBlocks: PartialBlock[] = [{ type: "paragraph", content: "" }];

type ReferenceItem = {
  id: number;
  label: string;
  url: string;
};

const toBlocks = (raw?: unknown): PartialBlock[] => {
  if (!raw) return emptyBlocks;
  if (Array.isArray(raw)) {
    return raw.length > 0 ? (raw as PartialBlock[]) : emptyBlocks;
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.length > 0 ? (parsed as PartialBlock[]) : emptyBlocks;
      }
    } catch {
      return emptyBlocks;
    }
  }
  return emptyBlocks;
};

const formatBucketLabel = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

const normalizeReferences = (
  raw?: Array<string | { label?: string; url?: string }> | null
) => {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    if (typeof item === "string") {
      return { id: index + 1, label: item, url: item };
    }
    if (item && typeof item === "object") {
      return {
        id: index + 1,
        label: item.label ? String(item.label) : "Reference",
        url: item.url ? String(item.url) : "",
      };
    }
    return { id: index + 1, label: "Reference", url: "" };
  });
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

const LoadingSpinner = ({ label }: { label: string }) => (
  <div className="flex items-center gap-2 text-xs text-muted-foreground">
    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
    {label}
  </div>
);

const emptySectionForm = { title: "", description: "" };

export const CustomSections = () => {
  const { version } = useBuddyContext();
  const [sections, setSections] = useState<CustomSection[]>([]);
  const [subsections, setSubsections] = useState<CustomSubsection[]>([]);
  const [questions, setQuestions] = useState<CustomQuestion[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);
  const [sectionForm, setSectionForm] = useState(emptySectionForm);
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [bucketInput, setBucketInput] = useState("");
  const [newQuestionForm, setNewQuestionForm] = useState({
    title: "",
    subsection: "",
  });
  const [editQuestionForm, setEditQuestionForm] = useState({
    title: "",
    subsection: "",
  });
  const [loadingSections, setLoadingSections] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [referenceItems, setReferenceItems] = useState<ReferenceItem[]>([]);
  const [referenceDraft, setReferenceDraft] = useState({ label: "", url: "" });
  const [answersLoading, setAnswersLoading] = useState(false);
  const [mergedAnswers, setMergedAnswers] = useState<MergedEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [activeOwnerId, setActiveOwnerId] = useState<number | null>(null);
  const [openBuckets, setOpenBuckets] = useState<Record<number, boolean>>({});
  const [leftWidth, setLeftWidth] = useState(280);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef(false);
  const appliedKeyRef = useRef<string | null>(null);

  const [solutionDraft, setSolutionDraft] = useState<PartialBlock[]>(emptyBlocks);
  const editor = useCreateBlockNote({ initialContent: emptyBlocks });
  const isDark = useIsDark();
  const totalSubsections = subsections.length;
  const totalQuestions = questions.length;
  const completedQuestions = questions.filter((item) => item.is_done).length;

  useEffect(() => {
    let active = true;
    const loadSections = async () => {
      setLoadingSections(true);
      setError(null);
      try {
        const data = await listCustomSections();
        if (!active) return;
        setSections(data);
        if (data.length > 0) {
          setSelectedSectionId((prev) => prev ?? data[0].id);
        } else {
          setSelectedSectionId(null);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load sections.");
        }
      } finally {
        if (active) {
          setLoadingSections(false);
        }
      }
    };
    loadSections();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedSectionId) {
      setSubsections([]);
      setQuestions([]);
      setSelectedQuestionId(null);
      return;
    }
    setOpenBuckets({});
    let active = true;
    const loadContent = async () => {
      setLoadingContent(true);
      setError(null);
      try {
        const [subs, items] = await Promise.all([
          listCustomSubsections(selectedSectionId),
          listCustomQuestions(selectedSectionId),
        ]);
        if (!active) return;
        setSubsections(subs);
        setQuestions(items);
        setSelectedQuestionId((prev) => {
          if (items.length === 0) return null;
          if (!prev) {
            const sortedBuckets = [...subs].sort((a, b) => a.title.localeCompare(b.title));
            const firstBucketId = sortedBuckets[0]?.id;
            const firstInBucket =
              firstBucketId != null
                ? items
                    .filter((item) => item.subsection === firstBucketId)
                    .sort((a, b) => a.title.localeCompare(b.title))[0]
                : items[0];
            return firstInBucket?.id ?? items[0]?.id ?? null;
          }
          return items.some((item) => item.id === prev) ? prev : items[0]?.id ?? null;
        });
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load content.");
        }
      } finally {
        if (active) {
          setLoadingContent(false);
        }
      }
    };
    loadContent();
    return () => {
      active = false;
    };
  }, [selectedSectionId]);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      if (!dragRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const next = event.clientX - rect.left;
      const min = 240;
      const max = Math.max(min, rect.width - 360);
      setLeftWidth(Math.max(min, Math.min(max, next)));
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

  const selectedSection = sections.find((section) => section.id === selectedSectionId) ?? null;
  const selectedQuestion =
    questions.find((item) => item.id === selectedQuestionId) ?? questions[0] ?? null;

  useEffect(() => {
    if (!selectedQuestion) {
      setSolutionDraft(emptyBlocks);
      setMergedAnswers([]);
      setCurrentUserId(null);
      setActiveOwnerId(null);
      return;
    }
    const nextBlocks = toBlocks(selectedQuestion.solution_json);
    setSolutionDraft(nextBlocks);
    appliedKeyRef.current = null;
    setReferenceItems(normalizeReferences(selectedQuestion.references_json));
    setEditQuestionForm({
      title: selectedQuestion.title,
      subsection: String(selectedQuestion.subsection),
    });
  }, [selectedQuestion?.id]);

  useEffect(() => {
    if (!selectedQuestion) return;
    let active = true;
    const load = async () => {
      setAnswersLoading(true);
      try {
        const data = await getMergedCustomQuestionDetail(selectedQuestion.id);
        if (!active) return;
        setMergedAnswers(data.entries);
        setCurrentUserId(data.current_user_id);
        setActiveOwnerId(data.current_user_id);
      } catch (err) {
        if (!active) return;
        setMergedAnswers([]);
        setCurrentUserId(null);
        setActiveOwnerId(null);
      } finally {
        if (active) {
          setAnswersLoading(false);
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [selectedQuestion?.id, version]);

  useEffect(() => {
    if (!selectedQuestion || !activeOwnerId || !currentUserId) return;
    if (activeOwnerId === currentUserId) {
      setReferenceItems(normalizeReferences(selectedQuestion.references_json));
    } else {
      const referenceEntry = mergedAnswers.find(
        (item) => item.type === "references" && item.owner.id === activeOwnerId
      );
      const refContent = referenceEntry
        ? (referenceEntry.content as Array<string | { label?: string; url?: string }>)
        : [];
      setReferenceItems(normalizeReferences(refContent));
    }
  }, [activeOwnerId, currentUserId, mergedAnswers, selectedQuestion?.id]);

  useEffect(() => {
    if (!selectedQuestion || !currentUserId) return;
    if (activeOwnerId !== currentUserId) return;
    const key = `${selectedQuestion.id}:${currentUserId}:self`;
    if (appliedKeyRef.current === key) return;
    const blocks = toBlocks(selectedQuestion.solution_json);
    try {
      editor.replaceBlocks(editor.document, blocks.length > 0 ? blocks : emptyBlocks);
      appliedKeyRef.current = key;
    } catch {
      // no-op: editor might not be mounted yet
    }
  }, [selectedQuestion?.id, selectedQuestion?.solution_json, currentUserId, activeOwnerId, editor]);

  useEffect(() => {
    if (!selectedQuestion || !activeOwnerId || !currentUserId) return;
    if (activeOwnerId === currentUserId) return;
    const solutionEntry = mergedAnswers.find(
      (item) => item.type === "solution" && item.owner.id === activeOwnerId
    );
    const key = `${selectedQuestion.id}:${activeOwnerId}:${solutionEntry?.id ?? "none"}`;
    if (appliedKeyRef.current === key) return;
    const blocks = toBlocks(solutionEntry?.content);
    try {
      editor.replaceBlocks(editor.document, blocks.length > 0 ? blocks : emptyBlocks);
      appliedKeyRef.current = key;
    } catch {
      // no-op: editor might not be mounted yet
    }
  }, [selectedQuestion?.id, activeOwnerId, currentUserId, mergedAnswers, editor]);

  const answerPills = useMemo(() => {
    if (!currentUserId) return [];
    const seen = new Set<number>();
    const pills: Array<{ id: number; label: string }> = [];
    const add = (id: number, label: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      pills.push({ id, label });
    };
    add(currentUserId, "You");
    mergedAnswers.forEach((entry) => {
      add(entry.owner.id, entry.owner.name || entry.owner.username);
    });
    return pills;
  }, [currentUserId, mergedAnswers]);

  const bucketGroups = useMemo(() => {
    const groups = new Map<number, CustomQuestion[]>();
    questions.forEach((question) => {
      const bucketId = question.subsection;
      if (!groups.has(bucketId)) {
        groups.set(bucketId, []);
      }
      groups.get(bucketId)?.push(question);
    });
    const sortedBuckets = [...subsections].sort((a, b) => a.title.localeCompare(b.title));
    return sortedBuckets.map((bucket) => ({
      bucket,
      items: (groups.get(bucket.id) ?? []).sort((a, b) => a.title.localeCompare(b.title)),
    }));
  }, [subsections, questions]);

  useEffect(() => {
    setOpenBuckets((prev) => {
      if (Object.keys(prev).length) return prev;
      const next: Record<number, boolean> = {};
      bucketGroups.forEach((group) => {
        next[group.bucket.id] = true;
      });
      return next;
    });
  }, [bucketGroups]);

  const handleCreateSection = async () => {
    setSaving(true);
    setDetailError(null);
    try {
      const created = await createCustomSection(sectionForm);
      setSections((prev) => [...prev, created].sort((a, b) => a.title.localeCompare(b.title)));
      setSelectedSectionId(created.id);
      setSectionForm(emptySectionForm);
      setSectionDialogOpen(false);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Failed to create section.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddBucket = async () => {
    if (!selectedSectionId || !bucketInput.trim()) return;
    setSaving(true);
    setDetailError(null);
    try {
      const created = await createCustomSubsection({
        section: selectedSectionId,
        title: bucketInput.trim(),
      });
      setSubsections((prev) => [...prev, created].sort((a, b) => a.title.localeCompare(b.title)));
      setBucketInput("");
      setOpenBuckets((prev) => ({ ...prev, [created.id]: true }));
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Failed to add subsection.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateQuestion = async () => {
    if (
      !selectedSectionId ||
      !newQuestionForm.title.trim() ||
      !newQuestionForm.subsection
    ) {
      return;
    }
    setSaving(true);
    setDetailError(null);
    try {
      const created = await createCustomQuestion({
        subsection: Number(newQuestionForm.subsection),
        title: newQuestionForm.title.trim(),
        solution_json: emptyBlocks,
      });
      setQuestions((prev) => [...prev, created].sort((a, b) => a.title.localeCompare(b.title)));
      setSelectedQuestionId(created.id);
      setQuestionDialogOpen(false);
      setNewQuestionForm({ title: "", subsection: "" });
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Failed to create question.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveQuestion = async () => {
    if (!selectedQuestion) return;
    setSaving(true);
    setDetailError(null);
    try {
      const updated = await updateCustomQuestion(selectedQuestion.id, {
        title: editQuestionForm.title.trim(),
        subsection: Number(editQuestionForm.subsection),
        solution_json: solutionDraft,
        references_json: referenceItems.map((item) => ({
          label: item.label,
          url: item.url,
        })),
      });
      setQuestions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Failed to save question.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDone = async (questionId: number) => {
    const target = questions.find((item) => item.id === questionId);
    if (!target) return;
    const nextValue = !target.is_done;
    setQuestions((prev) =>
      prev.map((item) => (item.id === questionId ? { ...item, is_done: nextValue } : item))
    );
    try {
      const updated = await updateCustomQuestion(questionId, { is_done: nextValue });
      setQuestions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setQuestions((prev) =>
        prev.map((item) => (item.id === questionId ? { ...item, is_done: !nextValue } : item))
      );
      setDetailError(err instanceof Error ? err.message : "Failed to update solved state.");
    }
  };

  const handleAddReference = () => {
    if (activeOwnerId !== currentUserId) return;
    if (!referenceDraft.label.trim() && !referenceDraft.url.trim()) return;
    setReferenceItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        label: referenceDraft.label.trim() || "Reference",
        url: referenceDraft.url.trim(),
      },
    ]);
    setReferenceDraft({ label: "", url: "" });
  };

  const handleUpdateReference = (id: number, patch: Partial<ReferenceItem>) => {
    if (activeOwnerId !== currentUserId) return;
    setReferenceItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleRemoveReference = (id: number) => {
    if (activeOwnerId !== currentUserId) return;
    setReferenceItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleDeleteSection = async () => {
    if (!selectedSectionId) return;
    const confirmed = window.confirm("Delete this section and all its content?");
    if (!confirmed) return;
    setSaving(true);
    setDetailError(null);
    try {
      const removedId = selectedSectionId;
      await deleteCustomSection(removedId);
      setSections((prev) => prev.filter((item) => item.id !== removedId));
      const remaining = sections.filter((item) => item.id !== removedId);
      setSelectedSectionId(remaining[0]?.id ?? null);
      setSubsections([]);
      setQuestions([]);
      setSelectedQuestionId(null);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Failed to delete section.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubsection = async (subsectionId: number) => {
    const bucket = subsections.find((item) => item.id === subsectionId);
    const confirmed = window.confirm(
      `Delete subsection "${bucket?.title ?? "this"}" and all its questions?`
    );
    if (!confirmed) return;
    setSaving(true);
    setDetailError(null);
    try {
      await deleteCustomSubsection(subsectionId);
      setSubsections((prev) => prev.filter((item) => item.id !== subsectionId));
      setQuestions((prev) => prev.filter((item) => item.subsection !== subsectionId));
      setOpenBuckets((prev) => {
        const next = { ...prev };
        delete next[subsectionId];
        return next;
      });
      setSelectedQuestionId((prev) => {
        if (!prev) return prev;
        const stillExists = questions.find(
          (item) => item.id === prev && item.subsection !== subsectionId
        );
        if (stillExists) return prev;
        const remaining = questions.filter((item) => item.subsection !== subsectionId);
        return remaining[0]?.id ?? null;
      });
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Failed to delete subsection.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuestion = async () => {
    if (!selectedQuestion) return;
    const confirmed = window.confirm("Delete this question?");
    if (!confirmed) return;
    setSaving(true);
    setDetailError(null);
    try {
      await deleteCustomQuestion(selectedQuestion.id);
      setQuestions((prev) => prev.filter((item) => item.id !== selectedQuestion.id));
      const remaining = questions.filter((item) => item.id !== selectedQuestion.id);
      setSelectedQuestionId(remaining[0]?.id ?? null);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Failed to delete question.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md border border-border bg-muted px-4 py-2 text-sm text-muted-foreground">
          {error}
        </div>
      )}

      <div className="rounded-md border border-border bg-surface px-2 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-baseline gap-2">
              <span>Topics</span>
              <span className="text-sm font-semibold text-foreground">{totalSubsections}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span>Questions</span>
              <span className="text-sm font-semibold text-foreground">{totalQuestions}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span>Completed</span>
              <span className="text-sm font-semibold text-foreground">{completedQuestions}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={selectedSectionId ? String(selectedSectionId) : ""}
              onChange={(event) =>
                setSelectedSectionId(event.target.value ? Number(event.target.value) : null)
              }
              className="h-8 text-xs w-48"
            >
              {sections.length === 0 && <option value="">No sections yet</option>}
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
            </Select>
            <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-emerald-500"
                  aria-label="Add section"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create section</DialogTitle>
                  <DialogDescription>Define a new user-owned bucket of questions.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                  <div className="grid gap-1">
                    <label className="text-xs text-muted-foreground">Section title</label>
                    <Input
                      value={sectionForm.title}
                      onChange={(event) =>
                        setSectionForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                      placeholder="e.g. API design drills"
                    />
                  </div>
                  <div className="grid gap-1">
                    <label className="text-xs text-muted-foreground">Description (optional)</label>
                    <Textarea
                      value={sectionForm.description}
                      onChange={(event) =>
                        setSectionForm((prev) => ({ ...prev, description: event.target.value }))
                      }
                      placeholder="Short context for this section"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost">Cancel</Button>
                  </DialogClose>
                  <Button onClick={handleCreateSection} disabled={saving || !sectionForm.title.trim()}>
                    {saving ? "Saving..." : "Create"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {selectedSectionId && (
              <button
                type="button"
                onClick={handleDeleteSection}
                className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-rose-500"
                aria-label="Delete section"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add question</DialogTitle>
                <DialogDescription>Question prompts live under a subsection bucket.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">Question</label>
                  <Input
                    value={newQuestionForm.title}
                    onChange={(event) =>
                      setNewQuestionForm((prev) => ({ ...prev, title: event.target.value }))
                    }
                    placeholder="Write the prompt or question title"
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-xs text-muted-foreground">Subsection</label>
                  <Select
                    value={newQuestionForm.subsection}
                    onChange={(event) =>
                      setNewQuestionForm((prev) => ({
                        ...prev,
                        subsection: event.target.value,
                      }))
                    }
                  >
                    <option value="">Select a bucket</option>
                    {subsections.map((bucket) => (
                      <option key={bucket.id} value={bucket.id}>
                        {formatBucketLabel(bucket.title)}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <Button
                  onClick={handleCreateQuestion}
                  disabled={saving || !newQuestionForm.title.trim() || !newQuestionForm.subsection}
                >
                  {saving ? "Saving..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        {detailError && (
          <div className="mt-2 rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
            {detailError}
          </div>
        )}
      </div>

      <div
        ref={containerRef}
        className="grid rounded-md border border-border bg-surface lg:h-[calc(100vh-160px)] lg:overflow-hidden"
        style={{ gridTemplateColumns: `${leftWidth}px 8px 1fr` }}
      >
        <div className="space-y-3 p-2 lg:overflow-y-auto">
          {loadingSections || loadingContent ? (
            <LoadingSpinner label="Loading section..." />
          ) : null}
          {!selectedSection && !loadingSections && (
            <p className="text-xs text-muted-foreground">Create a section to get started.</p>
          )}
          {selectedSection && (
            <div className="space-y-1.5">
              {bucketGroups.map((group) => {
                const isOpen = openBuckets[group.bucket.id] ?? false;
                return (
                  <div key={group.bucket.id} className="rounded-md border border-border/80 bg-background">
                    <div className="flex items-center justify-between gap-2 px-2 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenBuckets((prev) => ({
                            ...prev,
                            [group.bucket.id]: !isOpen,
                          }))
                        }
                        className="flex flex-1 items-center gap-1 text-left"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <span>{formatBucketLabel(group.bucket.title)}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewQuestionForm({
                            title: "",
                            subsection: String(group.bucket.id),
                          });
                          setQuestionDialogOpen(true);
                        }}
                        className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-emerald-500"
                        aria-label={`Add question to ${group.bucket.title}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSubsection(group.bucket.id)}
                        className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-rose-500"
                        aria-label={`Delete subsection ${group.bucket.title}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {isOpen && (
                      <div className="divide-y divide-border">
                        {group.items.map((question) => {
                          const isActive = question.id === selectedQuestionId;
                          return (
                            <div
                              key={question.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => setSelectedQuestionId(question.id)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setSelectedQuestionId(question.id);
                                }
                              }}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 text-[11px] text-foreground transition",
                                isActive
                                  ? "bg-muted text-foreground ring-1 ring-inset ring-accent"
                                  : "hover:bg-muted/70"
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={Boolean(question.is_done)}
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={(event) => event.stopPropagation()}
                                onChange={() => handleToggleDone(question.id)}
                                className="h-3.5 w-3.5 shrink-0 appearance-none rounded-full border border-border bg-background transition checked:border-accent checked:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                                aria-label="Mark done"
                              />
                              <span
                                className={cn(
                                  question.is_done && "line-through text-muted-foreground"
                                )}
                              >
                                {question.title}
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
              {bucketGroups.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Add a subsection to start listing questions.
                </p>
              )}
            </div>
          )}
          {selectedSection && (
            <div className="mt-2 flex items-center gap-2">
              <Input
                value={bucketInput}
                onChange={(event) => setBucketInput(event.target.value)}
                placeholder="Add subsection"
                className="h-8 text-xs"
                disabled={!selectedSectionId}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddBucket}
                disabled={!selectedSectionId || !bucketInput.trim()}
                aria-label="Add subsection"
                className="hover:text-emerald-500"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
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

        <div className="space-y-4 p-3 lg:overflow-y-auto">
          {!selectedQuestion && (
            <p className="text-sm text-muted-foreground">
              Select a question to write an answer.
            </p>
          )}
          {selectedQuestion && (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
                      {selectedQuestion.title}
                    </h2>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      Updated {formatDate(selectedQuestion.updated_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={editQuestionForm.subsection}
                      onChange={(event) =>
                        setEditQuestionForm((prev) => ({
                          ...prev,
                          subsection: event.target.value,
                        }))
                      }
                      disabled={selectedQuestion.is_global}
                      className={cn(
                        "h-8 text-xs w-36",
                        selectedQuestion.is_global && "opacity-60"
                      )}
                    >
                      {subsections.map((bucket) => (
                        <option key={bucket.id} value={bucket.id}>
                          {formatBucketLabel(bucket.title)}
                        </option>
                      ))}
                    </Select>
                    <button
                      type="button"
                      onClick={handleDeleteQuestion}
                      className={cn(
                        "inline-flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-rose-500",
                        selectedQuestion.is_global && "pointer-events-none opacity-50"
                      )}
                      aria-label="Delete question"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Solution
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {answerPills.map((pill) => {
                      const isActive = pill.id === (activeOwnerId ?? currentUserId);
                      return (
                        <button
                          key={pill.id}
                          type="button"
                          onClick={() => setActiveOwnerId(pill.id)}
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[11px] font-medium transition",
                            isActive
                              ? "border-accent bg-accent text-white"
                              : "border-border text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {pill.label}
                        </button>
                      );
                    })}
                    {answersLoading && (
                      <span className="text-[11px] text-muted-foreground">Loading...</span>
                    )}
                  </div>
                </div>
                <div
                  className={cn(
                    "mt-3 flex w-full flex-col rounded-md border border-border",
                    "bg-white dark:bg-black"
                  )}
                  style={{ height: "calc(100vh - 270px)" }}
                >
                  <div className="flex-1 overflow-y-auto px-1 py-1">
                    <BlockNoteView
                      editor={editor}
                      theme={isDark ? "dark" : "light"}
                      editable={activeOwnerId === currentUserId}
                      onChange={() => {
                        if (activeOwnerId === currentUserId) {
                          const next = editor.document;
                          setSolutionDraft(next && next.length > 0 ? next : emptyBlocks);
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
                        "[&_.bn-editor]:min-h-full"
                      )}
                    />
                  </div>
                  <div className="flex justify-end border-t border-border px-2 py-2">
                    <Button
                      size="sm"
                      onClick={handleSaveQuestion}
                      disabled={
                        saving ||
                        activeOwnerId !== currentUserId ||
                        !editQuestionForm.title.trim() ||
                        !editQuestionForm.subsection
                      }
                    >
                      {saving ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  References
                </p>
                <div className="space-y-2">
                  {referenceItems.map((reference) => (
                    <div key={reference.id} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                      <Input
                        value={reference.label}
                        onChange={(event) =>
                          handleUpdateReference(reference.id, { label: event.target.value })
                        }
                        placeholder="Label"
                        className="h-8 text-xs"
                        disabled={activeOwnerId !== currentUserId}
                      />
                      <Input
                        value={reference.url}
                        onChange={(event) =>
                          handleUpdateReference(reference.id, { url: event.target.value })
                        }
                        placeholder="https://"
                        className="h-8 text-xs"
                        disabled={activeOwnerId !== currentUserId}
                      />
                      {activeOwnerId === currentUserId && (
                        <button
                          type="button"
                          onClick={() => handleRemoveReference(reference.id)}
                          className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground"
                          aria-label="Remove reference"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {referenceItems.length === 0 && (
                    <p className="text-xs text-muted-foreground">No references yet.</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={referenceDraft.label}
                    onChange={(event) =>
                      setReferenceDraft((prev) => ({ ...prev, label: event.target.value }))
                    }
                    placeholder="Label"
                    className="h-8 text-xs sm:w-44"
                    disabled={activeOwnerId !== currentUserId}
                  />
                  <Input
                    value={referenceDraft.url}
                    onChange={(event) =>
                      setReferenceDraft((prev) => ({ ...prev, url: event.target.value }))
                    }
                    placeholder="https://"
                    className="h-8 text-xs sm:w-64"
                    disabled={activeOwnerId !== currentUserId}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddReference}
                    disabled={
                      activeOwnerId !== currentUserId ||
                      (!referenceDraft.label.trim() && !referenceDraft.url.trim())
                    }
                  >
                    Add
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

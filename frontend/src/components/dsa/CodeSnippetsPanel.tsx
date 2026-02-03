import CodeMirror from "@uiw/react-codemirror";
import { java } from "@codemirror/lang-java";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { oneDark } from "@codemirror/theme-one-dark";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { cn } from "../../lib/cn";

type SnippetLanguage = "python" | "java" | "cpp";

type CodeSnippet = {
  id?: string;
  title?: string;
  language: SnippetLanguage;
  code: string;
};

type SnippetPayload =
  | CodeSnippet[]
  | { snippets?: CodeSnippet[]; codeSnippets?: CodeSnippet[]; blocks?: CodeSnippet[] };

const normalizeLanguage = (value?: string): SnippetLanguage | null => {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower === "python" || lower === "py") return "python";
  if (lower === "java") return "java";
  if (lower === "cpp" || lower === "c++") return "cpp";
  return null;
};

const parseSnippets = (raw?: string): CodeSnippet[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SnippetPayload;
    const candidates = Array.isArray(parsed)
      ? parsed
      : parsed.snippets ?? parsed.codeSnippets ?? parsed.blocks ?? [];
    if (!Array.isArray(candidates)) return [];
    return candidates
      .map((item, index) => {
        if (!item || typeof item !== "object") return null;
        const language = normalizeLanguage((item as { language?: string }).language);
        if (!language) return null;
        const candidate = item as Partial<CodeSnippet>;
        return {
          id: candidate.id ?? `snippet-${index}`,
          title: typeof candidate.title === "string" ? candidate.title : "",
          language,
          code: typeof candidate.code === "string" ? candidate.code : "",
        };
      })
      .filter((item): item is CodeSnippet => Boolean(item));
  } catch {
    return [];
  }
};

export const hasSnippetPayload = (raw?: string) => parseSnippets(raw).length > 0;

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

const languageLabel: Record<SnippetLanguage, string> = {
  python: "Python",
  java: "Java",
  cpp: "C++",
};

type CodeSnippetsPanelProps = {
  source?: string;
  onPersist?: (payload: string) => Promise<void> | void;
};

const createSnippet = (): CodeSnippet => ({
  id: `snippet-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  title: "",
  language: "python",
  code: "",
});

const serializeSnippets = (snippets: CodeSnippet[]) =>
  JSON.stringify(
    {
      snippets: snippets.map((snippet) => ({
        id: snippet.id,
        title: snippet.title ?? "",
        language: snippet.language,
        code: snippet.code ?? "",
      })),
    },
    null,
    2
  );

export const CodeSnippetsPanel = ({ source, onPersist }: CodeSnippetsPanelProps) => {
  const parsedSnippets = useMemo(() => parseSnippets(source), [source]);
  const isDark = useIsDark();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftSnippets, setDraftSnippets] = useState<CodeSnippet[]>(() => parsedSnippets);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) {
      setDraftSnippets(parsedSnippets);
    }
  }, [parsedSnippets, editing]);

  const getLanguageExtension = (language: SnippetLanguage) => {
    if (language === "python") return python();
    if (language === "java") return java();
    return cpp();
  };

  const handleCopy = async (snippet: CodeSnippet) => {
    try {
      await navigator.clipboard.writeText(snippet.code);
      setCopiedId(snippet.id ?? null);
      window.setTimeout(() => setCopiedId(null), 1200);
    } catch {
      setCopiedId(null);
    }
  };

  const handleAddSnippet = () => {
    setDraftSnippets((prev) => [...prev, createSnippet()]);
  };

  const updateSnippet = (index: number, patch: Partial<CodeSnippet>) => {
    setDraftSnippets((prev) =>
      prev.map((snippet, idx) => (idx === index ? { ...snippet, ...patch } : snippet))
    );
  };

  const removeSnippet = (index: number) => {
    setDraftSnippets((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleCancel = () => {
    setEditing(false);
    setSaveError(null);
    setDraftSnippets(parsedSnippets);
  };

  const handleSave = async () => {
    if (!onPersist) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = serializeSnippets(draftSnippets);
      await onPersist(payload);
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save snippets");
    } finally {
      setSaving(false);
    }
  };

  const visibleSnippets = editing ? draftSnippets : parsedSnippets;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Code snippets</p>
        {onPersist && !editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
        {onPersist && editing && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleAddSnippet}>
              Add snippet
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </div>
      {saveError && (
        <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
          {saveError}
        </div>
      )}
      {visibleSnippets.length === 0 && !editing && (
        <p className="text-sm text-muted-foreground">
          No snippets yet. Use Edit to add new code blocks.
        </p>
      )}
      {visibleSnippets.length === 0 && editing && (
        <p className="text-xs text-muted-foreground">No snippets yet. Add one to begin.</p>
      )}
      {visibleSnippets.map((snippet, index) => (
        <div
          key={snippet.id}
          className="w-full overflow-hidden rounded-md border border-border bg-background"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
            {editing ? (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={snippet.title ?? ""}
                  onChange={(event) => updateSnippet(index, { title: event.target.value })}
                  placeholder="Snippet title"
                  className="h-8 text-xs sm:w-52"
                />
                <Select
                  value={snippet.language}
                  onChange={(event) =>
                    updateSnippet(index, { language: event.target.value as SnippetLanguage })
                  }
                  className="h-8 text-xs sm:w-28"
                >
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                </Select>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {snippet.title || "Snippet"}
                </span>
                <span className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                  {languageLabel[snippet.language]}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              {editing && (
                <Button variant="ghost" size="sm" onClick={() => removeSnippet(index)}>
                  Remove
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(snippet)}
                className={cn(copiedId === snippet.id && "border-accent text-accent")}
              >
                {copiedId === snippet.id ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
          <div className="w-full">
            <CodeMirror
              value={snippet.code}
              editable={editing}
              readOnly={!editing}
              theme={isDark ? oneDark : "light"}
              extensions={[getLanguageExtension(snippet.language)]}
              basicSetup={{
                lineNumbers: true,
                foldGutter: false,
                highlightActiveLine: false,
                highlightActiveLineGutter: false,
              }}
              onChange={
                editing ? (value) => updateSnippet(index, { code: value }) : undefined
              }
              width="100%"
              minHeight="140px"
              maxHeight="50vh"
              className="w-full text-xs font-mono [&_.cm-editor]:rounded-none [&_.cm-gutters]:bg-background [&_.cm-gutters]:text-muted-foreground [&_.cm-content]:py-2"
            />
          </div>
        </div>
      ))}
    </div>
  );
};

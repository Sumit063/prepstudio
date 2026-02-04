import { useEffect, useMemo, useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { AppState, ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import CodeMirror from "@uiw/react-codemirror";
import { java } from "@codemirror/lang-java";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import type { MergedEntry } from "../../lib/api";
import { cn } from "../../lib/cn";
import { BuddyBadge } from "./BuddyBadge";
import { Button } from "../ui/Button";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

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

const entryLabels: Record<string, string> = {
  workspace_note: "Workspace note",
  solution_note: "Solution note",
  approach: "Approach",
  code_snippet: "Code snippet",
  notes: "Notes",
  tradeoffs: "Tradeoffs",
  references: "References",
  canvas: "Diagram",
};

const languageLabels: Record<string, string> = {
  python: "Python",
  java: "Java",
  cpp: "C++",
};

const renderTextBlock = (content: unknown) => {
  if (typeof content !== "string") return null;
  return <p className="whitespace-pre-wrap text-sm text-muted-foreground">{content}</p>;
};

const renderApproach = (content: unknown) => {
  if (!content || typeof content !== "object") return null;
  const payload = content as { title?: string; notes?: string };
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">{payload.title || "Approach"}</p>
      {payload.notes && (
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{payload.notes}</p>
      )}
    </div>
  );
};

const renderReferences = (content: unknown) => {
  if (!Array.isArray(content)) return null;
  return (
    <ul className="space-y-1 text-sm text-muted-foreground">
      {content.map((item, index) => {
        if (typeof item === "string") {
          return (
            <li key={`${item}-${index}`} className="break-words">
              {item}
            </li>
          );
        }
        if (item && typeof item === "object") {
          const label = "label" in item ? String(item.label ?? "Reference") : "Reference";
          const url = "url" in item ? String(item.url ?? "") : "";
          return (
            <li key={`${label}-${index}`} className="break-words">
              <span className="font-medium text-foreground">{label}</span>
              {url && (
                <span className="ml-2 text-xs text-accent">{url}</span>
              )}
            </li>
          );
        }
        return null;
      })}
    </ul>
  );
};

const CodeSnippetViewer = ({ code, language }: { code: string; language?: string | null }) => {
  const isDark = useIsDark();
  const extension = useMemo(() => {
    if (language === "python") return python();
    if (language === "java") return java();
    return cpp();
  }, [language]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-border bg-background",
        "dark:border-[#2d2d2d] dark:bg-[#1e1e1e]"
      )}
    >
      <CodeMirror
        value={code}
        editable={false}
        readOnly
        theme={isDark ? vscodeDark : vscodeLight}
        extensions={[extension]}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
        }}
        height="180px"
        className={cn(
          "w-full text-xs font-mono [&_.cm-editor]:rounded-none",
          "[&_.cm-content]:py-2 [&_.cm-content]:leading-5",
          "dark:[&_.cm-gutters]:bg-[#1e1e1e] dark:[&_.cm-gutters]:text-[#9ca3af]",
          "dark:[&_.cm-content]:text-[#d4d4d4]"
        )}
      />
    </div>
  );
};

const CanvasPreview = ({ scene }: { scene: unknown }) => {
  const initialData = useMemo<ExcalidrawInitialDataState>(() => {
    if (!scene || typeof scene !== "object") {
      return {
        elements: [],
        appState: { theme: "dark", viewBackgroundColor: "#000000", collaborators: new Map() } as AppState,
        files: {},
      };
    }
    const data = scene as {
      elements?: readonly ExcalidrawElement[];
      appState?: AppState;
      files?: Record<string, unknown>;
    };
    const collaborators =
      data.appState?.collaborators instanceof Map ? data.appState.collaborators : new Map();
    return {
      elements: data.elements ?? [],
      appState: ({
        ...(data.appState ?? { theme: "dark", viewBackgroundColor: "#000000" }),
        collaborators,
      } as AppState),
      files: (data.files ?? {}) as Record<string, unknown>,
    };
  }, [scene]);

  return (
    <div className="h-64 w-full overflow-hidden rounded-md border border-border bg-background">
      <Excalidraw
        initialData={initialData}
        viewModeEnabled
        zenModeEnabled
        UIOptions={{
          canvasActions: {
            changeViewBackgroundColor: true,
            toggleTheme: true,
          },
        }}
      />
    </div>
  );
};

type MergedEntryListProps = {
  entries: MergedEntry[];
  currentUserId?: number;
  emptyLabel?: string;
  buddyEmptyLabel?: string;
  onlyBuddies?: boolean;
  enableFullscreen?: boolean;
};

export const MergedEntryList = ({
  entries,
  currentUserId,
  emptyLabel = "No merged entries yet.",
  buddyEmptyLabel = "No buddy snippets for this question.",
  onlyBuddies = false,
  enableFullscreen = false,
}: MergedEntryListProps) => {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [fullscreen]);

  const filteredEntries =
    onlyBuddies && currentUserId
      ? entries.filter((entry) => entry.owner.id !== currentUserId)
      : entries;

  const buddyEntries = currentUserId
    ? filteredEntries.filter((entry) => entry.owner.id !== currentUserId)
    : [];

  const listContent =
    filteredEntries.length === 0 ? (
      <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
        {onlyBuddies ? buddyEmptyLabel : emptyLabel}
      </div>
    ) : (
      <div className="rounded-md border border-border bg-surface">
        <div className="divide-y divide-border">
          {filteredEntries.map((entry) => {
            const label = entryLabels[entry.type] ?? "Entry";
            const language = entry.language ? languageLabels[entry.language] ?? entry.language : null;
            return (
              <div key={entry.id} className="space-y-2 px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {label}
                    </span>
                    {language && (
                      <span className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                        {language}
                      </span>
                    )}
                  </div>
                  <BuddyBadge user={entry.owner} size="xs" />
                </div>
                <div className="space-y-2">
                  {entry.type === "approach" && renderApproach(entry.content)}
                  {entry.type === "code_snippet" &&
                    entry.content &&
                    typeof entry.content === "object" &&
                    (() => {
                      const payload = entry.content as { title?: string; code?: string };
                      return (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-foreground">
                            {payload.title || "Snippet"}
                          </p>
                          <CodeSnippetViewer code={payload.code ?? ""} language={entry.language} />
                        </div>
                      );
                    })()}
                  {entry.type === "references" && renderReferences(entry.content)}
                  {entry.type === "canvas" && <CanvasPreview scene={entry.content} />}
                  {["workspace_note", "solution_note", "notes", "tradeoffs"].includes(entry.type) &&
                    renderTextBlock(entry.content)}
                </div>
              </div>
            );
          })}
        </div>
        {currentUserId && buddyEntries.length === 0 && (
          <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
            {buddyEmptyLabel}
          </div>
        )}
      </div>
    );

  const controls = enableFullscreen ? (
    <div className="mb-2 flex items-center justify-end">
      <Button variant="outline" size="sm" onClick={() => setFullscreen((prev) => !prev)}>
        {fullscreen ? "Exit fullscreen" : "Fullscreen"}
      </Button>
    </div>
  ) : null;

  const content = (
    <div className="space-y-2">
      {controls}
      {listContent}
    </div>
  );

  if (fullscreen && typeof document !== "undefined") {
    return createPortal(
      <div className="fixed inset-0 z-50 bg-background p-4">
        <div className="mb-3 flex items-center justify-end">
          <Button variant="outline" size="sm" onClick={() => setFullscreen(false)} aria-label="Close fullscreen">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="h-full w-full overflow-y-auto">{content}</div>
      </div>,
      document.body
    );
  }

  return content;
};

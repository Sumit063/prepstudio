import { Excalidraw, convertToExcalidrawElements } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./ui/Button";
import { cn } from "../lib/cn";

export type DesignCanvasScene = {
  elements?: readonly ExcalidrawElement[];
  appState?: AppState;
  files?: BinaryFiles;
};

// Defaults only for first-load scenes (no saved data yet).
const DEFAULT_APP_STATE: Partial<AppState> = {
  theme: "dark",
  viewBackgroundColor: "#ffffff",
  currentItemStrokeColor: "#000000",
  currentItemBackgroundColor: "transparent",
};

const createMockScene = (): ExcalidrawInitialDataState => ({
  elements: convertToExcalidrawElements([
    {
      type: "rectangle",
      x: 120,
      y: 140,
      width: 260,
      height: 140,
      label: { text: "CDC Ingestion" },
    },
    {
      type: "text",
      text: "Notes: add context here",
      x: 140,
      y: 320,
    },
  ]),
  appState: DEFAULT_APP_STATE as AppState,
  files: {},
});

const normalizeAppState = (appState?: AppState | null): AppState => {
  const base =
    appState && typeof appState === "object"
      ? (appState as AppState)
      : (DEFAULT_APP_STATE as AppState);
  const collaborators =
    base.collaborators instanceof Map ? base.collaborators : new Map();
  return { ...base, collaborators };
};

type SystemDesignCanvasProps = {
  initialScene?: DesignCanvasScene | null;
  onSceneChange?: (scene: DesignCanvasScene) => void;
  readOnly?: boolean;
};

const buildInitialScene = (scene: DesignCanvasScene | null | undefined) => {
  if (!scene) return createMockScene();
  return {
    elements: scene.elements ?? [],
    appState: normalizeAppState(scene.appState),
    files: scene.files ?? {},
  };
};

export const SystemDesignCanvas = ({
  initialScene,
  onSceneChange,
  readOnly = false,
}: SystemDesignCanvasProps) => {
  const [fullscreen, setFullscreen] = useState(false);
  const [headerOffset, setHeaderOffset] = useState(96);
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const persistTimerRef = useRef<number | null>(null);
  const lastSceneRef = useRef<DesignCanvasScene | null>(null);
  const initialDataRef = useRef<ExcalidrawInitialDataState | null>(null);
  if (!initialDataRef.current) {
    initialDataRef.current = buildInitialScene(initialScene);
  }
  const initialData = initialDataRef.current;

  useEffect(() => {
    const computeOffset = () => {
      const header = document.querySelector("header");
      const headerHeight = header?.getBoundingClientRect().height ?? 0;
      const verticalPadding = 32;
      setHeaderOffset(headerHeight + verticalPadding);
    };
    computeOffset();
    window.addEventListener("resize", computeOffset);
    return () => window.removeEventListener("resize", computeOffset);
  }, []);

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

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
      }
    };
  }, []);

  const handleChange = useCallback(
    (nextElements: readonly ExcalidrawElement[], nextAppState: AppState, nextFiles: BinaryFiles) => {
      if (readOnly) return;
      const safeAppState = normalizeAppState(nextAppState);
      const normalizedState: DesignCanvasScene = {
        elements: nextElements,
        appState: safeAppState,
        files: nextFiles,
      };

      lastSceneRef.current = normalizedState;
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
      }
      persistTimerRef.current = window.setTimeout(() => {
        if (lastSceneRef.current) {
          onSceneChange?.(lastSceneRef.current);
        }
      }, 300);
    },
    [onSceneChange, readOnly]
  );

  const handleClear = () => {
    if (readOnly || !excalidrawAPI) return;
    if (!window.confirm("Clear this canvas?")) return;
    const safeAppState = normalizeAppState(excalidrawAPI.getAppState());
    const cleared: DesignCanvasScene = { elements: [], appState: safeAppState, files: {} };
    excalidrawAPI.updateScene(cleared);
    onSceneChange?.(cleared);
  };

  const containerHeight = fullscreen
    ? "100vh"
    : `calc(100vh - ${headerOffset}px)`;

  const canvas = (
    <div
      className={cn(
        "relative w-full border border-border rounded-none shadow-none",
        "bg-background"
      )}
      style={{ height: containerHeight }}
    >
      <div className="absolute bottom-[38px] right-3 z-10 flex items-center gap-2">
        {!readOnly && (
          <Button variant="outline" size="sm" onClick={handleClear}>
            Clear
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setFullscreen((prev) => !prev)}>
          {fullscreen ? "Exit fullscreen" : "Fullscreen"}
        </Button>
      </div>
      <div className="h-full w-full border border-border bg-background">
        <Excalidraw
          initialData={initialData}
          excalidrawAPI={setExcalidrawAPI}
          onChange={handleChange}
          viewModeEnabled={readOnly}
          zenModeEnabled={readOnly}
          UIOptions={{
            canvasActions: {
              changeViewBackgroundColor: true,
              toggleTheme: true,
            },
          }}
        />
      </div>
    </div>
  );

  if (fullscreen && typeof document !== "undefined") {
    return createPortal(
      <div className="fixed inset-0 z-50">
        {canvas}
      </div>,
      document.body
    );
  }

  return canvas;
};

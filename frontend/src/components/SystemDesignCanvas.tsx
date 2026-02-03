import { Excalidraw, convertToExcalidrawElements } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type {
  AppState,
  BinaryFiles,
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

type SystemDesignCanvasProps = {
  initialScene?: DesignCanvasScene | null;
  onSceneChange?: (scene: DesignCanvasScene) => void;
};

const buildInitialScene = (scene: DesignCanvasScene | null | undefined) => {
  if (!scene) return createMockScene();
  return {
    elements: scene.elements ?? [],
    appState: scene.appState ?? (DEFAULT_APP_STATE as AppState),
    files: scene.files ?? {},
  };
};

export const SystemDesignCanvas = ({ initialScene, onSceneChange }: SystemDesignCanvasProps) => {
  const [fullscreen, setFullscreen] = useState(false);
  const [headerOffset, setHeaderOffset] = useState(96);
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
      const normalizedState: DesignCanvasScene = {
        elements: nextElements,
        appState: nextAppState,
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
    [onSceneChange]
  );

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
      <div className="absolute bottom-[38px] right-3 z-10">
        <Button variant="outline" size="sm" onClick={() => setFullscreen((prev) => !prev)}>
          {fullscreen ? "Exit fullscreen" : "Fullscreen"}
        </Button>
      </div>
      <div className="h-full w-full border border-border bg-background">
        <Excalidraw
          initialData={initialData}
          onChange={handleChange}
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

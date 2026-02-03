import { Excalidraw, convertToExcalidrawElements } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "./ui/Button";
import { cn } from "../lib/cn";

const mockScene = (): ExcalidrawInitialDataState => ({
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
  appState: {
    viewBackgroundColor: "transparent",
    theme: "light",
  },
  files: {},
});

export const SystemDesignCanvas = () => {
  const initialData = useMemo(() => mockScene(), []);
  const [elements, setElements] = useState<readonly ExcalidrawElement[]>(
    initialData.elements ?? []
  );
  const [appState, setAppState] = useState<AppState>(
    (initialData.appState ?? {}) as AppState
  );
  const [files, setFiles] = useState<BinaryFiles>((initialData.files ?? {}) as BinaryFiles);
  const [fullscreen, setFullscreen] = useState(false);
  const [headerOffset, setHeaderOffset] = useState(96);
  const sceneSnapshot = useMemo(
    () => ({ elements, appState, files }),
    [elements, appState, files]
  );

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

  const handleChange = useCallback(
    (nextElements: readonly ExcalidrawElement[], nextAppState: AppState, nextFiles: BinaryFiles) => {
      setElements(nextElements);
      setAppState({
        ...nextAppState,
        viewBackgroundColor: "#ffffff",
        theme: "light",
      });
      setFiles(nextFiles);
      // TODO: persist { elements: nextElements, appState: nextAppState, files: nextFiles }.
    },
    []
  );

  const containerHeight = fullscreen
    ? "100vh"
    : `calc(100vh - ${headerOffset}px)`;

  const canvas = (
    <div
      className={cn(
        "relative w-full border border-border bg-white dark:bg-white",
        "rounded-none shadow-none"
      )}
      style={{ height: containerHeight }}
    >
      <div className="absolute left-3 top-3 z-10 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Design canvas
      </div>
      <div className="absolute bottom-3 right-3 z-10">
        <Button variant="outline" size="sm" onClick={() => setFullscreen((prev) => !prev)}>
          {fullscreen ? "Exit fullscreen" : "Fullscreen"}
        </Button>
      </div>
      <div className="h-full w-full border border-border bg-white dark:bg-white">
        <Excalidraw initialData={initialData} onChange={handleChange} />
      </div>
      {/* Persisting to backend will plug into this state later. */}
      <span className="sr-only">
        {sceneSnapshot.elements.length} elements, {Object.keys(sceneSnapshot.files).length} files
      </span>
    </div>
  );

  if (fullscreen && typeof document !== "undefined") {
    return createPortal(
      <div className="fixed inset-0 z-50 bg-white dark:bg-white">
        {canvas}
      </div>,
      document.body
    );
  }

  return canvas;
};

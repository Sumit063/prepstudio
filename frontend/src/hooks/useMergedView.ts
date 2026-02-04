import { useCallback, useEffect, useState } from "react";
import {
  getMergedProblemDetail,
  getMergedTopicDetail,
  type MergedProblemDetail,
  type MergedTopicDetail,
} from "../lib/api";
import { useBuddyContext } from "../contexts/BuddyContext";

type MergedViewKind = "dsa" | "design";

type MergedViewState =
  | { kind: "dsa"; data: MergedProblemDetail | null }
  | { kind: "design"; data: MergedTopicDetail | null };

export const useMergedView = (kind: MergedViewKind, id?: number) => {
  const { version } = useBuddyContext();
  const [state, setState] = useState<MergedViewState>(() => ({
    kind,
    data: null,
  }));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      if (kind === "dsa") {
        const data = await getMergedProblemDetail(id);
        setState({ kind: "dsa", data });
      } else {
        const data = await getMergedTopicDetail(id);
        setState({ kind: "design", data });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load merged view");
    } finally {
      setLoading(false);
    }
  }, [id, kind]);

  useEffect(() => {
    refresh();
  }, [refresh, version]);

  return { state, loading, error, refresh };
};

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  acceptBuddy,
  listBuddies,
  removeBuddy,
  requestBuddy,
  type BuddyRelationship,
} from "../lib/api";
import { useBuddyContext } from "../contexts/BuddyContext";

const sortByName = (a: BuddyRelationship, b: BuddyRelationship) =>
  a.buddy.name.localeCompare(b.buddy.name);

export const useBuddies = () => {
  const { bump, version } = useBuddyContext();
  const [relationships, setRelationships] = useState<BuddyRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listBuddies();
      setRelationships(data.relationships ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load buddies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, version]);

  const accepted = useMemo(
    () =>
      relationships
        .filter((rel) => rel.status === "ACCEPTED")
        .sort(sortByName),
    [relationships]
  );

  const pendingIncoming = useMemo(
    () =>
      relationships.filter(
        (rel) => rel.status === "PENDING" && rel.direction === "incoming"
      ),
    [relationships]
  );

  const pendingOutgoing = useMemo(
    () =>
      relationships.filter(
        (rel) => rel.status === "PENDING" && rel.direction === "outgoing"
      ),
    [relationships]
  );

  const sendRequest = useCallback(
    async (identifier: string) => {
      const result = await requestBuddy(identifier);
      setRelationships((prev) => {
        const next = prev.filter((rel) => rel.id !== result.id);
        return [...next, result];
      });
      bump();
      return result;
    },
    [bump]
  );

  const acceptRequest = useCallback(
    async (relationshipId: number) => {
      const result = await acceptBuddy(relationshipId);
      setRelationships((prev) =>
        prev.map((rel) => (rel.id === result.id ? result : rel))
      );
      bump();
      return result;
    },
    [bump]
  );

  const removeRelationship = useCallback(
    async (relationshipId: number) => {
      await removeBuddy(relationshipId);
      setRelationships((prev) => prev.filter((rel) => rel.id !== relationshipId));
      bump();
    },
    [bump]
  );

  return {
    relationships,
    accepted,
    pendingIncoming,
    pendingOutgoing,
    loading,
    error,
    refresh,
    sendRequest,
    acceptRequest,
    removeRelationship,
  };
};

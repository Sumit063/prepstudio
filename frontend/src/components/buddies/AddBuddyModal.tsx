import { useEffect, useMemo, useState } from "react";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { searchBuddies, type BuddyRelationship, type OwnerSummary } from "../../lib/api";
import { BuddyBadge } from "./BuddyBadge";

type AddBuddyModalProps = {
  relationships: BuddyRelationship[];
  onRequest: (identifier: string) => Promise<void>;
};

const findRelationship = (relationships: BuddyRelationship[], userId: number) =>
  relationships.find((rel) => rel.buddy.id === userId);

export const AddBuddyModal = ({ relationships, onRequest }: AddBuddyModalProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OwnerSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  const existingIds = useMemo(
    () => new Set(relationships.map((rel) => rel.buddy.id)),
    [relationships]
  );

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setError(null);
      return;
    }
    const handle = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await searchBuddies(query.trim());
        setResults(data.results ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to search users");
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query]);

  const handleRequest = async (user: OwnerSummary) => {
    setPendingId(user.id);
    setError(null);
    try {
      await onRequest(user.email || user.username);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send request");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <DialogContent className="max-w-lg max-h-[520px] overflow-hidden">
      <DialogHeader>
        <DialogTitle>Add buddy</DialogTitle>
        <DialogDescription>Search by username or email to send a buddy request.</DialogDescription>
      </DialogHeader>
      <div className="flex h-[360px] flex-col gap-3">
        <Input
          value={query ?? ""}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search username or email"
          className="h-9 text-sm"
        />
        {loading && <p className="text-xs text-muted-foreground">Searching...</p>}
        {error && (
          <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
            {error}
          </div>
        )}
        <div className="flex-1 overflow-hidden rounded-md border border-border bg-surface">
          <div className="h-full space-y-2 overflow-y-auto p-2">
            {results.map((user) => {
              const relationship = findRelationship(relationships, user.id);
              const isPendingOutgoing = relationship?.direction === "outgoing";
            const isPendingIncoming = relationship?.direction === "incoming";
            const isAccepted = relationship?.status === "ACCEPTED";
            const disabled = isAccepted || isPendingOutgoing || isPendingIncoming;
            return (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2"
              >
                <div className="space-y-1">
                  <BuddyBadge user={user} />
                  {user.email && (
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={disabled ? "outline" : "primary"}
                  disabled={disabled || pendingId === user.id || existingIds.has(user.id)}
                  onClick={() => handleRequest(user)}
                >
                  {isAccepted && "Buddy"}
                  {isPendingOutgoing && "Pending"}
                  {isPendingIncoming && "Awaiting you"}
                  {!relationship && pendingId !== user.id && "Request"}
                  {pendingId === user.id && "Sending..."}
                </Button>
              </div>
            );
          })}
            {!loading && query.trim() && results.length === 0 && (
              <p className="text-xs text-muted-foreground">No users found.</p>
            )}
          </div>
        </div>
      </div>
      <DialogFooter>
        <p className="text-xs text-muted-foreground">
          You can have up to two buddies at a time.
        </p>
      </DialogFooter>
    </DialogContent>
  );
};

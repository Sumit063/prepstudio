import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../ui/Button";
import { Dialog, DialogContent, DialogTrigger } from "../ui/Dialog";
import { cn } from "../../lib/cn";
import { useBuddies } from "../../hooks/useBuddies";
import { AddBuddyModal } from "./AddBuddyModal";
import type { BuddyRelationship, OwnerSummary } from "../../lib/api";
import { formatDate } from "../../lib/format";

type BuddyListProps = {
  collapsed: boolean;
};

const initialFromName = (name?: string) => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
};

const isOnlineNow = (user: OwnerSummary) => {
  if (!user.last_active_at) return false;
  const last = new Date(user.last_active_at).getTime();
  if (Number.isNaN(last)) return false;
  const diffMinutes = (Date.now() - last) / (1000 * 60);
  return diffMinutes <= 10;
};

const buildStatusLabel = (user: OwnerSummary) => {
  if (isOnlineNow(user)) return "Online";
  if (user.last_active_at) return `Last active ${formatDate(user.last_active_at)}`;
  return "Offline";
};

const renderAvatar = (user: OwnerSummary) => {
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name || user.username}
        className="h-10 w-10 rounded-md object-cover"
      />
    );
  }
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted text-xs font-semibold text-foreground">
      {initialFromName(user.name || user.username)}
    </div>
  );
};

export const BuddyList = ({ collapsed }: BuddyListProps) => {
  const {
    relationships,
    accepted,
    pendingIncoming,
    pendingOutgoing,
    loading,
    error,
    acceptRequest,
    removeRelationship,
    sendRequest,
  } = useBuddies();
  const [addOpen, setAddOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeProfile, setActiveProfile] = useState<BuddyRelationship | null>(null);

  const acceptedWithStatus = useMemo(
    () =>
      accepted.map((rel) => ({
        ...rel,
        isOnline: isOnlineNow(rel.buddy),
      })),
    [accepted]
  );

  const openProfile = (relationship: BuddyRelationship) => {
    setActiveProfile(relationship);
    setProfileOpen(true);
  };

  const handleRemove = (relationship: BuddyRelationship) => {
    const name = relationship.buddy.name || relationship.buddy.username;
    if (!window.confirm(`Remove ${name} from your buddies?`)) return;
    removeRelationship(relationship.id);
  };

  return (
    <div
      className={cn(
        "border-t border-border pt-3",
        collapsed ? "px-2 pb-3" : "px-3 pb-4"
      )}
    >
      <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed && (
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Buddies
          </span>
        )}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("h-8 w-8 p-0", collapsed && "h-9 w-9")}
              aria-label="Add buddy"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <AddBuddyModal
            relationships={relationships}
            onRequest={async (identifier) => {
              await sendRequest(identifier);
              setAddOpen(false);
            }}
          />
        </Dialog>
      </div>

      {loading && !collapsed && (
        <p className="mt-3 text-xs text-muted-foreground">Loading buddies...</p>
      )}
      {error && !collapsed && (
        <div className="mt-3 rounded-md border border-border bg-muted px-2 py-2 text-xs text-muted-foreground">
          {error}
        </div>
      )}

      {accepted.length === 0 && !loading && !collapsed && (
        <p className="mt-3 text-xs text-muted-foreground">No buddies yet.</p>
      )}

      {collapsed && accepted.length > 0 && (
        <div className="mt-3 flex flex-col items-center gap-2">
          {acceptedWithStatus.map((rel) => (
            <button
              key={rel.id}
              type="button"
              onClick={() => openProfile(rel)}
              title={rel.buddy.name || rel.buddy.username}
              className="relative flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted text-xs font-semibold text-foreground"
            >
              {(rel.buddy.name || rel.buddy.username).slice(0, 2).toUpperCase()}
              <span
                className={cn(
                  "absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full border border-background",
                  rel.isOnline ? "bg-emerald-500" : "bg-muted-foreground"
                )}
              />
            </button>
          ))}
        </div>
      )}

      {!collapsed && accepted.length > 0 && (
        <div className="mt-3 space-y-2">
          {acceptedWithStatus.map((rel) => (
            <div
              key={rel.id}
              role="button"
              tabIndex={0}
              onClick={() => openProfile(rel)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openProfile(rel);
                }
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-md border px-2 py-2 text-left",
                rel.isOnline
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : "border-border bg-surface"
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    rel.isOnline ? "bg-emerald-500" : "bg-muted-foreground"
                  )}
                />
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-foreground">
                    {rel.buddy.name || rel.buddy.username}
                  </div>
                  <div
                    className={cn(
                      "text-[11px]",
                      rel.isOnline ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                    )}
                  >
                    {buildStatusLabel(rel.buddy)}
                  </div>
                </div>
              </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleRemove(rel);
                  }}
                  aria-label="Remove buddy"
                >
                  Remove
                </Button>
            </div>
          ))}
        </div>
      )}

      {!collapsed && (
        <div className="mt-4 space-y-2">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Pending requests
          </div>
          {pendingIncoming.map((rel) => (
            <div
              key={rel.id}
              className="flex items-center justify-between rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-2"
            >
              <div className="flex items-center gap-2">
                {renderAvatar(rel.buddy)}
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-foreground">
                    {rel.buddy.name || rel.buddy.username}
                  </div>
                  <div className="text-[11px] text-sky-600 dark:text-sky-400">Incoming</div>
                </div>
              </div>
              <Button size="sm" className="bg-emerald-500 text-white hover:bg-emerald-600" onClick={() => acceptRequest(rel.id)}>
                Accept
              </Button>
            </div>
          ))}
          {pendingOutgoing.map((rel) => (
            <div
              key={rel.id}
              className="flex items-center justify-between rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-2 text-xs"
            >
              <div className="flex items-center gap-2">
                {renderAvatar(rel.buddy)}
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-foreground">
                    {rel.buddy.name || rel.buddy.username}
                  </div>
                  <div className="text-[11px] text-amber-600 dark:text-amber-400">Pending</div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(rel)}
                aria-label="Cancel buddy request"
                className="h-auto w-auto p-0 text-rose-500 hover:text-rose-600"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          ))}
          {pendingIncoming.length === 0 && pendingOutgoing.length === 0 && (
            <p className="text-xs text-muted-foreground">No pending requests.</p>
          )}
        </div>
      )}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-sm">
          {activeProfile && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {renderAvatar(activeProfile.buddy)}
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {activeProfile.buddy.name || activeProfile.buddy.username}
                  </div>
                  {activeProfile.buddy.email && (
                    <div className="text-xs text-muted-foreground">
                      {activeProfile.buddy.email}
                    </div>
                  )}
                </div>
              </div>
              <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                {isOnlineNow(activeProfile.buddy)
                  ? "Currently active"
                  : buildStatusLabel(activeProfile.buddy)}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

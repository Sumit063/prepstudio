import type { OwnerSummary } from "../../lib/api";
import { cn } from "../../lib/cn";

type BuddyBadgeProps = {
  user: OwnerSummary;
  size?: "xs" | "sm";
};

const initialFromName = (name?: string) => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
};

export const BuddyBadge = ({ user, size = "sm" }: BuddyBadgeProps) => {
  const initials = initialFromName(user.name || user.username);
  const sizeClasses = size === "xs" ? "h-5 w-5 text-[10px]" : "h-6 w-6 text-[11px]";
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-border bg-muted px-2 py-1 text-[11px] text-muted-foreground">
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-md border border-border bg-background font-semibold text-foreground",
          sizeClasses
        )}
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.name} className="h-full w-full rounded-md object-cover" />
        ) : (
          initials
        )}
      </span>
      <span className="flex items-center gap-1">{user.name || user.username}</span>
    </span>
  );
};

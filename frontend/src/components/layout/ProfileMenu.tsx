import { LogOut, Settings, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { logoutUser } from "../../lib/api";
import { clearAuthTokens, getRefreshToken, getUsername } from "../../lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/DropdownMenu";

export const ProfileMenu = () => {
  const navigate = useNavigate();
  const username = getUsername() ?? "User";
  const initials =
    username
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((chunk) => chunk[0]?.toUpperCase())
      .join("") || "U";

  const handleLogout = async () => {
    try {
      await logoutUser(getRefreshToken() ?? undefined);
    } catch {
      // Ignore logout errors and clear local auth state.
    } finally {
      clearAuthTokens();
      navigate("/login", { replace: true });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-xs font-semibold">
            {initials}
          </span>
          <span className="text-sm">{username}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Workspace</DropdownMenuLabel>
        <DropdownMenuItem>
          <User className="h-4 w-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings className="h-4 w-4" />
          Preferences
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleLogout}>
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { navItems } from "../../app/routes";
import { cn } from "../../lib/cn";
import { BuddyList } from "../buddies/BuddyList";

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 flex flex-col border-r border-border bg-surface transition-[width] duration-200",
        collapsed ? "w-[75px]" : "w-52"
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center border-b border-border px-3",
          collapsed ? "justify-center" : "justify-start"
        )}
      >
        <Link to="/" className="flex items-center justify-center" aria-label="PrepStudio home">
          <img
            src="/logo.png"
            alt="PrepStudio"
            className="w-[75px] h-auto object-contain"
          />
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-2 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              title={item.label}
              className={({ isActive }) =>
                cn(
                  "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                  "text-muted-foreground hover:bg-muted hover:text-foreground",
                  isActive && "bg-muted text-foreground",
                  collapsed && "justify-center px-2"
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-0 h-full w-1 rounded-r-sm bg-accent" />
                  )}
                  <Icon className={cn(collapsed ? "h-5 w-5" : "h-4 w-4")} />
                  {!collapsed && <span>{item.label}</span>}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
      <BuddyList collapsed={collapsed} />
      <button
        onClick={onToggle}
        className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
};

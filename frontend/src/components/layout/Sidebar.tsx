import { ChevronLeft, ChevronRight } from "lucide-react";
import { NavLink } from "react-router-dom";
import { navItems } from "../../app/routes";
import { cn } from "../../lib/cn";

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 flex flex-col border-r border-border bg-surface transition-[width] duration-200",
        collapsed ? "w-16" : "w-56"
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted text-xs font-semibold">
            PS
          </div>
          {!collapsed && (
            <div>
              <p className="text-sm font-semibold">PrepStudio</p>
              <p className="text-xs text-muted-foreground">Learning workspace</p>
            </div>
          )}
        </div>
        <button
          onClick={onToggle}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
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
                  <Icon className="h-4 w-4" />
                  {!collapsed && <span>{item.label}</span>}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
      {!collapsed && (
        <div className="border-t border-border px-4 py-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Today</p>
          <p>2 reviews due • 1 design note updated</p>
        </div>
      )}
    </aside>
  );
};

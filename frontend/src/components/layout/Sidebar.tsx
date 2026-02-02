import { NavLink } from "react-router-dom";
import { navItems } from "../../app/routes";
import { cn } from "../../lib/cn";

export const Sidebar = () => {
  return (
    <aside className="fixed inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-surface">
      <div className="flex h-16 items-center gap-2 border-b border-border px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted text-xs font-semibold">
          PS
        </div>
        <div>
          <p className="text-sm font-semibold">PrepStudio</p>
          <p className="text-xs text-muted-foreground">Learning workspace</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                cn(
                  "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                  "text-muted-foreground hover:bg-muted hover:text-foreground",
                  isActive && "bg-muted text-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-0 h-full w-1 rounded-r-sm bg-accent" />
                  )}
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
      <div className="border-t border-border px-4 py-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Today</p>
        <p>2 reviews due • 1 design note updated</p>
      </div>
    </aside>
  );
};

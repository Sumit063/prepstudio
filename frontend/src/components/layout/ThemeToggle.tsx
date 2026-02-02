import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { setThemeClass } from "../../lib/theme";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/Tooltip";

const getInitialTheme = () => {
  if (typeof window === "undefined") {
    return false;
  }
  const stored = window.localStorage.getItem("theme");
  if (stored) {
    return stored === "dark";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
};

export const ThemeToggle = () => {
  const [isDark, setIsDark] = useState(getInitialTheme);

  useEffect(() => {
    setThemeClass(isDark);
    window.localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setIsDark((prev) => !prev)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground hover:text-foreground"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </TooltipTrigger>
        <TooltipContent>{isDark ? "Switch to light" : "Switch to dark"}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

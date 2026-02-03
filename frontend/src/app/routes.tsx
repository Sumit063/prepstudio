import {
  BookOpen,
  CalendarClock,
  LayoutGrid,
  ListChecks,
  Network,
} from "lucide-react";

export type NavItem = {
  label: string;
  path: string;
  icon: typeof LayoutGrid;
};

export const navItems: NavItem[] = [
  { label: "Dashboard", path: "/", icon: LayoutGrid },
  { label: "DSA", path: "/dsa", icon: BookOpen },
  { label: "System Design", path: "/design", icon: Network },
  { label: "Reviews", path: "/reviews", icon: ListChecks },
  { label: "Study Sessions", path: "/sessions", icon: CalendarClock },
];

export const breadcrumbLabels: Record<string, string> = {
  dsa: "DSA Sheet",
  design: "Design Sheet",
  reviews: "Reviews",
  sessions: "Study Sessions",
};

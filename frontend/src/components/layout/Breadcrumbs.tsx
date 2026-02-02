import { Link, useLocation } from "react-router-dom";
import { breadcrumbLabels } from "../../app/routes";
import { cn } from "../../lib/cn";

const formatSegment = (segment: string) => {
  if (breadcrumbLabels[segment]) {
    return breadcrumbLabels[segment];
  }
  if (/^\d+$/.test(segment)) {
    return `#${segment}`;
  }
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export const Breadcrumbs = ({ className }: { className?: string }) => {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);
  const crumbs = segments.length
    ? segments.map((segment, index) => ({
        label: formatSegment(segment),
        path: `/${segments.slice(0, index + 1).join("/")}`,
      }))
    : [{ label: "Dashboard", path: "/" }];

  return (
    <nav className={cn("flex items-center gap-2 text-sm", className)}>
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <div key={crumb.path} className="flex items-center gap-2">
            {isLast ? (
              <span className="text-foreground">{crumb.label}</span>
            ) : (
              <Link className="text-muted-foreground hover:text-foreground" to={crumb.path}>
                {crumb.label}
              </Link>
            )}
            {!isLast && <span className="text-muted-foreground">/</span>}
          </div>
        );
      })}
    </nav>
  );
};

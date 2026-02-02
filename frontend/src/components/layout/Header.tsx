import { Breadcrumbs } from "./Breadcrumbs";
import { ProfileMenu } from "./ProfileMenu";
import { ThemeToggle } from "./ThemeToggle";

export const Header = () => {
  return (
    <header className="border-b border-border bg-surface">
      <div className="flex h-16 items-center justify-between px-6">
        <Breadcrumbs />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
};

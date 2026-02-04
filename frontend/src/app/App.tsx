import { useState } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { AuthGuard } from "../components/auth/AuthGuard";
import { Header } from "../components/layout/Header";
import { Sidebar } from "../components/layout/Sidebar";
import { Dashboard } from "../pages/Dashboard";
import { Design } from "../pages/Design";
import { DesignDetail } from "../pages/DesignDetail";
import { DsaDetail } from "../pages/DsaDetail";
import { DsaList } from "../pages/DsaList";
import { Login } from "../pages/Login";
import { Register } from "../pages/Register";
import { Reviews } from "../pages/Reviews";
import { StudySessions } from "../pages/StudySessions";
import { cn } from "../lib/cn";
import { BuddyProvider } from "../contexts/BuddyContext";

const AppShell = ({
  sidebarCollapsed,
  onToggleSidebar,
}: {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}) => (
  <div className="min-h-screen bg-background text-foreground">
    <Sidebar collapsed={sidebarCollapsed} onToggle={onToggleSidebar} />
    <div
      className={cn(
        "transition-[padding] duration-200",
        sidebarCollapsed ? "pl-[75px]" : "pl-52"
      )}
    >
      <Header />
      <main className={cn("py-4", sidebarCollapsed ? "px-2" : "px-4")}>
        <div
          className={cn(
            "mx-auto w-full",
            sidebarCollapsed ? "max-w-[1440px]" : "max-w-7xl"
          )}
        >
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dsa" element={<DsaList />} />
            <Route path="/dsa/:id" element={<DsaDetail />} />
            <Route path="/design" element={<Design />} />
            <Route path="/design/:id" element={<DesignDetail />} />
            <Route path="/reviews" element={<Reviews />} />
            <Route path="/sessions" element={<StudySessions />} />
          </Routes>
        </div>
      </main>
    </div>
  </div>
);

const AppContent = () => {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isAuthRoute =
    location.pathname.startsWith("/login") ||
    location.pathname.startsWith("/register");

  if (isAuthRoute) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    );
  }

  return (
    <AuthGuard>
      <BuddyProvider>
        <AppShell
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
        />
      </BuddyProvider>
    </AuthGuard>
  );
};

const App = () => (
  <BrowserRouter>
    <AppContent />
  </BrowserRouter>
);

export default App;

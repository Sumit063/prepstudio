import { useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Header } from "../components/layout/Header";
import { Sidebar } from "../components/layout/Sidebar";
import { Dashboard } from "../pages/Dashboard";
import { Design } from "../pages/Design";
import { DesignDetail } from "../pages/DesignDetail";
import { DsaDetail } from "../pages/DsaDetail";
import { DsaList } from "../pages/DsaList";
import { Reviews } from "../pages/Reviews";
import { StudySessions } from "../pages/StudySessions";
import { cn } from "../lib/cn";

const App = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-foreground">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((prev) => !prev)}
        />
        <div
          className={cn(
            "transition-[padding] duration-200",
            sidebarCollapsed ? "pl-12" : "pl-52"
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
    </BrowserRouter>
  );
};

export default App;

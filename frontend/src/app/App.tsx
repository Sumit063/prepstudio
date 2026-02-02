import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Header } from "../components/layout/Header";
import { Sidebar } from "../components/layout/Sidebar";
import { Dashboard } from "../pages/Dashboard";
import { Design } from "../pages/Design";
import { DsaDetail } from "../pages/DsaDetail";
import { DsaList } from "../pages/DsaList";
import { Reviews } from "../pages/Reviews";
import { StudySessions } from "../pages/StudySessions";

const App = () => {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-foreground">
        <Sidebar />
        <div className="pl-64">
          <Header />
          <main className="px-6 py-6">
            <div className="mx-auto w-full max-w-6xl">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/dsa" element={<DsaList />} />
                <Route path="/dsa/:id" element={<DsaDetail />} />
                <Route path="/design" element={<Design />} />
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

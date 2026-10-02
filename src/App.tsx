import React, { useState } from "react";
import { LoginPage } from "./components/LoginPage";
import { DashboardPage } from "./components/DashboardPage";
import { ProjectGuide } from "./components/ProjectGuide";
import { ArrowLeft, Terminal } from "lucide-react";

export default function App() {
  const [user, setUser] = useState<string | null>(() => {
    try {
      return localStorage.getItem("sbm_user") || null;
    } catch {
      return null;
    }
  });
  const [showGuideModal, setShowGuideModal] = useState(false);

  const handleLoginSuccess = (username: string) => {
    try {
      localStorage.setItem("sbm_user", username);
    } catch {}
    setUser(username);
    setShowGuideModal(false);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {}
    try {
      localStorage.removeItem("sbm_user");
    } catch {}
    setUser(null);
  };

  if (showGuideModal && !user) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <button
              onClick={() => setShowGuideModal(false)}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-blue-600 bg-slate-100 hover:bg-slate-200/80 px-3 py-2 rounded-lg transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Login Page</span>
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <Terminal className="w-4 h-4 text-blue-600" />
              <span>Flask Project Source Code &amp; Execution Guide</span>
            </div>
          </div>
          <ProjectGuide />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        onOpenGuide={() => setShowGuideModal(true)}
      />
    );
  }

  return <DashboardPage username={user} onLogout={handleLogout} />;
}

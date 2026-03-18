import React, { useState } from "react";
import { Toaster, toast } from "sonner";
import { Settings } from "lucide-react";
import { KioskView } from "./components/KioskView";
import { AdminDashboard } from "./components/AdminDashboard";
import { AdminLogin } from "./components/AdminLogin";
import { DatabaseProvider, useDatabase } from "./database/DatabaseContext";

function AppContent() {
  const [view, setView] = useState<"kiosk" | "admin" | "login">("kiosk");
  const db = useDatabase();

  const handleAdminAccess = () => {
    if (db.currentAdmin) {
      setView("admin");
    } else {
      setView("login");
    }
  };

  const handleLoginSuccess = () => {
    setView("admin");
    toast.success("Welcome back, Administrator");
  };

  const handleLogout = () => {
    db.setCurrentAdmin(null);
    setView("kiosk");
    toast.info("Logged out successfully");
  };

  const handleReturnToKiosk = () => {
    // Clear authentication state
    db.setCurrentAdmin(null);

    // Clear all cookies
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i];
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substring(0, eqPos) : cookie;
      document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    }

    // Clear storage
    localStorage.clear();
    sessionStorage.clear();
    
    setView("kiosk");
    toast.info("Session cleared. Returned to Kiosk mode.");
  };

  return (
    <div className="min-h-screen bg-[#F5F7F6] text-slate-900 font-sans overflow-hidden">
      <Toaster position="top-right" />
      
      {view === "kiosk" && (
        <div className="relative w-full h-screen">
          <KioskView />
          <button 
            onClick={handleAdminAccess}
            className="absolute bottom-6 right-6 p-4 rounded-full bg-slate-200/50 hover:bg-slate-300 transition-colors group"
          >
            <Settings className="w-6 h-6 text-slate-500 group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>
      )}

      {view === "login" && (
        <AdminLogin 
          onCancel={() => setView("kiosk")} 
          onSuccess={handleLoginSuccess} 
        />
      )}

      {view === "admin" && (
        <AdminDashboard 
          onLogout={handleLogout}
          onReturnToKiosk={handleReturnToKiosk}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <DatabaseProvider>
      <AppContent />
    </DatabaseProvider>
  );
}
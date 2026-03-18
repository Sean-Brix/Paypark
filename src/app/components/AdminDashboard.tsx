import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  LayoutDashboard, 
  History, 
  Banknote, 
  Settings as SettingsIcon, 
  LogOut, 
  Monitor,
  Bell,
  Search
} from "lucide-react";
import { DashboardHome } from "./DashboardHome";
import { TransactionsTable } from "./TransactionsTable";
import { FinanceView } from "./FinanceView";
import { AdminSettings } from "./AdminSettings";
import logoImage from 'figma:asset/f9b2dd1f8f807fb04d6f9f5feed8a994eb1778c7.png';
import { useDatabase } from "../database/DatabaseContext";

interface AdminDashboardProps {
  onLogout: () => void;
  onReturnToKiosk: () => void;
}

export function AdminDashboard({ onLogout, onReturnToKiosk }: AdminDashboardProps) {
  const db = useDatabase();
  const [activeTab, setActiveTab] = useState<"analytics" | "transactions" | "finance" | "settings">("analytics");

  const menuItems = [
    { id: "analytics", label: "Analytics", icon: LayoutDashboard },
    { id: "transactions", label: "Transactions", icon: History },
    { id: "finance", label: "Finance", icon: Banknote },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ];

  const admin = db.currentAdmin;

  return (
    <div className="flex h-screen bg-white overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-72 bg-white flex flex-col p-8 border-r border-slate-200 relative overflow-hidden">
        
        <div className="relative z-10 flex items-center gap-3 mb-10 px-2">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="w-12 h-12 flex-shrink-0 bg-white border border-slate-200 flex items-center justify-center overflow-hidden"
          >
            <img 
              src={logoImage} 
              alt="Logo" 
              className="w-full h-full object-cover" 
            />
          </motion.div>
          <div className="min-w-0">
            <h1 className="font-bold text-xl text-slate-800 tracking-tight leading-none">PAY-PARK</h1>
            <p className="text-[10px] font-bold text-[#1E7F5C] tracking-[0.2em] uppercase opacity-70">Admin</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 relative z-10">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] mb-4 px-4">Management</p>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center gap-4 p-4 transition-all duration-200 group relative ${
                  isActive 
                    ? "bg-[#1E7F5C] text-white" 
                    : "hover:bg-slate-50 text-slate-500 hover:text-slate-800"
                }`}
              >
                <div className={`p-1 ${isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600"}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="font-medium text-sm tracking-tight">{item.label}</span>
                {isActive && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute left-0 w-1 h-full bg-[#F4B740]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="pt-8 mt-8 border-t border-slate-100 space-y-1 relative z-10">
          <button 
            onClick={onReturnToKiosk}
            className="w-full flex items-center gap-4 p-4 text-slate-500 hover:bg-slate-50 hover:text-[#1E7F5C] transition-all font-medium text-sm group"
          >
            <div className="p-1">
              <Monitor className="w-5 h-5" />
            </div>
            <span>Terminal</span>
          </button>
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-4 p-4 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all font-medium text-sm group"
          >
            <div className="p-1">
              <LogOut className="w-5 h-5" />
            </div>
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="bg-white p-6 px-10 flex justify-between items-center border-b border-slate-200">
          <div className="flex items-center gap-8">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <div className="w-2 h-2 bg-[#1E7F5C]" />
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">
                  {menuItems.find(i => i.id === activeTab)?.label}
                </h2>
              </div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">System ID: {db.settings.kioskName || 'PARK-01'}</p>
            </div>
            
            <div className="h-10 w-[1px] bg-slate-200" />
            
            <div className="hidden lg:flex items-center gap-4 bg-slate-50 px-4 py-2 border border-slate-200">
              <Search className="w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search transactions..." 
                className="bg-transparent border-none text-xs font-medium focus:ring-0 w-48 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <button className="relative w-10 h-10 bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors border border-slate-200">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-[#F4B740]" />
            </button>
            
            <div className="flex items-center gap-4 group cursor-pointer">
              <div className="text-right">
                <p className="text-[10px] font-bold text-[#1E7F5C] uppercase tracking-widest leading-none mb-1">{admin?.role || "Admin"}</p>
                <p className="font-medium text-slate-700 text-sm">{admin?.displayName || "Administrator"}</p>
              </div>
              <div className="w-12 h-12 bg-[#1E7F5C] flex items-center justify-center text-white font-bold text-lg border border-slate-200">
                {admin?.initials || "AD"}
              </div>
            </div>
          </div>
        </header>

        {/* Content Container */}
        <div className="flex-1 bg-white overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {activeTab === "analytics" && <DashboardHome />}
              {activeTab === "transactions" && <TransactionsTable />}
              {activeTab === "finance" && <FinanceView />}
              {activeTab === "settings" && <AdminSettings />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
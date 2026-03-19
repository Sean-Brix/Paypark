import React, { useState } from "react";
import { motion } from "motion/react";
import { Lock, User, X, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import logoImage from "../../assets/logo.png";
import schoolLogo from "../../assets/logo.png";
import { useDatabase } from "../context/DatabaseContext";

interface AdminLoginProps {
  onCancel: () => void;
  onSuccess: () => void;
}

export function AdminLogin({ onCancel, onSuccess }: AdminLoginProps) {
  const db = useDatabase();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate network delay then authenticate against the database
    setTimeout(() => {
      const admin = db.authenticateAdmin(username, password);
      setIsLoading(false);
      
      if (admin) {
        db.setCurrentAdmin(admin);
        onSuccess();
      } else {
        toast.error("Invalid credentials. Please try again.");
      }
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-xl rounded-[40px] overflow-hidden shadow-2xl flex flex-col md:flex-row h-auto max-h-[90vh]"
      >
        <div className="bg-[#1E7F5C] p-12 text-white flex flex-col justify-between md:w-2/5">
          <div className="flex flex-col h-full">
            <div className="flex gap-4 mb-8">
              <img src={schoolLogo} alt="School Logo" className="w-16 h-16 rounded-full object-cover" />
              <img src={logoImage} alt="Kiosk Logo" className="w-16 h-16 rounded-full object-cover brightness-0 invert" />
            </div>
            <h2 className="text-4xl font-black mb-4 uppercase leading-tight">ADMIN ACCESS</h2>
            <p className="text-white/70 text-lg">Enter credentials to manage kiosk and view analytics.</p>
          </div>
          <button 
            onClick={onCancel}
            className="mt-12 flex items-center gap-2 font-bold text-white/50 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" /> CANCEL
          </button>
        </div>

        <div className="p-12 flex-1 flex flex-col justify-center">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Username</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 focus:border-[#1E7F5C] outline-none transition-all font-medium"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 focus:border-[#1E7F5C] outline-none transition-all font-medium"
                  required
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#1E7F5C] text-white rounded-2xl py-5 font-black text-xl shadow-lg shadow-green-900/20 flex items-center justify-center gap-3 hover:bg-[#166347] transition-all disabled:opacity-50"
            >
              {isLoading ? "AUTHENTICATING..." : "LOG IN NOW"}
              <ArrowRight className="w-6 h-6" />
            </button>
          </form>
          
          <p className="mt-8 text-center text-slate-400 font-medium">
            Authorized Personnel Only
          </p>
        </div>
      </motion.div>
    </div>
  );
}
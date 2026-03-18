import React from "react";
import { Save, User, MapPin, Monitor, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useDatabase } from "../database/DatabaseContext";

export function AdminSettings() {
  const db = useDatabase();
  const { settings, updateSettings, currentAdmin } = db;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    updateSettings({
      [name]: name.includes('Price') ? parseFloat(value) || 0 : value
    });
  };

  const handleSave = () => {
    toast.success("Settings updated successfully");
  };

  return (
    <div className="max-w-5xl mx-auto space-y-0 pb-20 p-8 lg:p-12">
      <div className="space-y-10">
        <section className="space-y-6">
          <div className="flex items-center gap-3 text-[#1E7F5C]">
            <Monitor className="w-6 h-6" />
            <h3 className="text-xl font-black uppercase">Kiosk Configuration</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Kiosk Name</label>
              <input 
                name="kioskName"
                value={settings.kioskName}
                onChange={handleChange}
                className="w-full bg-slate-50 border-2 border-slate-100 py-4 px-6 focus:border-[#1E7F5C] outline-none transition-all font-bold text-slate-700"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Location</label>
              <div className="relative">
                <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input 
                  name="location"
                  value={settings.location}
                  onChange={handleChange}
                  className="w-full bg-slate-50 border-2 border-slate-100 py-4 pl-14 pr-6 focus:border-[#1E7F5C] outline-none transition-all font-bold text-slate-700"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6 pt-10 border-t border-slate-100">
          <div className="flex items-center gap-3 text-[#1E7F5C]">
            <CreditCard className="w-6 h-6" />
            <h3 className="text-xl font-black uppercase">Pricing Management</h3>
          </div>
          
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Car Price (₱)</label>
              <input 
                type="number"
                name="carPrice"
                value={settings.carPrice}
                onChange={handleChange}
                className="w-full bg-slate-50 border-2 border-slate-100 py-4 px-6 focus:border-[#1E7F5C] outline-none transition-all font-bold text-slate-700 text-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Motorcycle (₱)</label>
              <input 
                type="number"
                name="motorcyclePrice"
                value={settings.motorcyclePrice}
                onChange={handleChange}
                className="w-full bg-slate-50 border-2 border-slate-100 py-4 px-6 focus:border-[#1E7F5C] outline-none transition-all font-bold text-slate-700 text-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">E-Bike (₱)</label>
              <input 
                type="number"
                name="ebikePrice"
                value={settings.ebikePrice}
                onChange={handleChange}
                className="w-full bg-slate-50 border-2 border-slate-100 py-4 px-6 focus:border-[#1E7F5C] outline-none transition-all font-bold text-slate-700 text-xl"
              />
            </div>
          </div>
        </section>

        <section className="space-y-6 pt-10 border-t border-slate-100">
          <div className="flex items-center gap-3 text-slate-400">
            <User className="w-6 h-6" />
            <h3 className="text-xl font-black uppercase">Profile Security</h3>
          </div>
          
          <div className="p-6 bg-slate-50 flex items-center justify-between border border-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white shadow-sm flex items-center justify-center font-black text-[#1E7F5C] text-xl border border-slate-100">
                {currentAdmin?.initials || "AD"}
              </div>
              <div>
                <p className="font-bold text-slate-800">{currentAdmin?.displayName || "Administrator"}</p>
                <p className="text-xs text-slate-400 font-bold uppercase">{currentAdmin?.role || "Admin"}</p>
              </div>
            </div>
            <button className="px-6 py-3 border-2 border-slate-200 text-slate-500 font-black text-sm hover:border-[#1E7F5C] hover:text-[#1E7F5C] transition-all">
              CHANGE PASSWORD
            </button>
          </div>
        </section>

        <div className="pt-6">
          <button 
            onClick={handleSave}
            className="w-full bg-[#1E7F5C] text-white py-5 font-black text-xl shadow-lg shadow-green-900/20 flex items-center justify-center gap-3 hover:bg-[#166347] transition-all"
          >
            <Save className="w-6 h-6" />
            SAVE ALL CHANGES
          </button>
        </div>
      </div>
    </div>
  );
}

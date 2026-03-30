import React, { useState } from "react";
import { Save, User, MapPin, Monitor, CreditCard, X, Shield } from "lucide-react";
import { toast } from "sonner";
import { useDatabase } from "../context/DatabaseContext";
import { apiClient } from "../api/client";

export function AdminSettings() {
  const db = useDatabase();
  const { settings, updateSettings, currentAdmin } = db;
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  if (!settings) {
    return (
      <div className="max-w-5xl mx-auto p-8 lg:p-12">
        <div className="border border-slate-200 bg-white p-8 text-sm font-bold uppercase tracking-widest text-slate-400">
          Loading settings...
        </div>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    updateSettings({
      [name]: name.includes("Price") ? parseFloat(value) || 0 : value
    });
  };

  const handleSave = () => {
    toast.success("Settings updated successfully");
  };

  const openPasswordDialog = () => {
    setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setIsPasswordDialogOpen(true);
  };

  const closePasswordDialog = () => {
    if (!isUpdatingPassword) {
      setIsPasswordDialogOpen(false);
    }
  };

  const handlePasswordFieldChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setPasswordForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!currentAdmin?.id) {
      toast.error("No active admin session.");
      return;
    }

    const currentPassword = passwordForm.currentPassword.trim();
    const newPassword = passwordForm.newPassword.trim();
    const confirmPassword = passwordForm.confirmPassword.trim();

    if (!currentPassword) {
      toast.error("Current password is required.");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New password and confirm password do not match.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await apiClient.changeAdminPassword({
        adminId: currentAdmin.id,
        currentPassword,
        newPassword,
      });
      toast.success("Admin password updated.");
      setIsPasswordDialogOpen(false);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update password.");
    } finally {
      setIsUpdatingPassword(false);
    }
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
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Car Price (PHP)</label>
              <input
                type="number"
                name="carPrice"
                value={settings.carPrice}
                onChange={handleChange}
                className="w-full bg-slate-50 border-2 border-slate-100 py-4 px-6 focus:border-[#1E7F5C] outline-none transition-all font-bold text-slate-700 text-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Motorcycle (PHP)</label>
              <input
                type="number"
                name="motorcyclePrice"
                value={settings.motorcyclePrice}
                onChange={handleChange}
                className="w-full bg-slate-50 border-2 border-slate-100 py-4 px-6 focus:border-[#1E7F5C] outline-none transition-all font-bold text-slate-700 text-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">E-Bike (PHP)</label>
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
            <button
              type="button"
              onClick={openPasswordDialog}
              className="px-6 py-3 border-2 border-slate-200 text-slate-500 font-black text-sm hover:border-[#1E7F5C] hover:text-[#1E7F5C] transition-all"
            >
              CHANGE PASSWORD
            </button>
          </div>
        </section>

        <div className="pt-6">
          <button
            type="button"
            onClick={handleSave}
            className="w-full bg-[#1E7F5C] text-white py-5 font-black text-xl shadow-lg shadow-green-900/20 flex items-center justify-center gap-3 hover:bg-[#166347] transition-all"
          >
            <Save className="w-6 h-6" />
            SAVE ALL CHANGES
          </button>
        </div>
      </div>

      {isPasswordDialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-6"
          onClick={closePasswordDialog}
        >
          <div
            className="w-full max-w-xl border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-8 py-6">
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6 text-[#1E7F5C]" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-[#1E7F5C]">Profile Security</p>
                  <h3 className="text-2xl font-black text-slate-800 uppercase">Change Password</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={closePasswordDialog}
                className="flex h-11 w-11 items-center justify-center border border-slate-200 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-5 px-8 py-8">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Current Password</label>
                <input
                  type="password"
                  name="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordFieldChange}
                  className="w-full border-2 border-slate-100 bg-slate-50 px-5 py-4 font-bold text-slate-700 outline-none transition-all focus:border-[#1E7F5C]"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">New Password</label>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordFieldChange}
                  className="w-full border-2 border-slate-100 bg-slate-50 px-5 py-4 font-bold text-slate-700 outline-none transition-all focus:border-[#1E7F5C]"
                  required
                  minLength={6}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Confirm New Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordFieldChange}
                  className="w-full border-2 border-slate-100 bg-slate-50 px-5 py-4 font-bold text-slate-700 outline-none transition-all focus:border-[#1E7F5C]"
                  required
                  minLength={6}
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closePasswordDialog}
                  disabled={isUpdatingPassword}
                  className="px-6 py-4 border-2 border-slate-200 text-slate-500 font-black text-sm hover:border-slate-300 hover:text-slate-700 transition-all disabled:opacity-50"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="px-6 py-4 bg-[#1E7F5C] text-white font-black text-sm shadow-lg shadow-green-900/20 hover:bg-[#166347] transition-all disabled:opacity-50"
                >
                  {isUpdatingPassword ? "UPDATING..." : "UPDATE PASSWORD"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

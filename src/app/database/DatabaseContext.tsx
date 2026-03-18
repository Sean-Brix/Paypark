import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";

// Import seed data from JSON tables
import seedTransactionsRaw from "./transactions.json";
import seedSettingsRaw from "./settings.json";
import seedAdminsRaw from "./admins.json";
import seedExpensesRaw from "./expenses.json";
import seedVehiclesRaw from "./vehicles.json";

// ─── Types ───────────────────────────────────────────────────────────

export interface Transaction {
  id: string;
  type: string;
  amount: number;
  timestamp: string;
  status: string;
  kioskId: string;
  controlNumber: string;
}

export interface Settings {
  kioskId: string;
  kioskName: string;
  location: string;
  carPrice: number;
  motorcyclePrice: number;
  ebikePrice: number;
  operatingHours: { open: string; close: string };
  receiptHeader: string;
  receiptFooter: string;
  systemVersion: string;
}

export interface Admin {
  id: string;
  username: string;
  password: string;
  displayName: string;
  role: string;
  initials: string;
  createdAt: string;
  lastLogin: string;
}

export interface Expense {
  id: string;
  label: string;
  amount: number;
  date: string;
  category: string;
  description: string;
}

export interface Vehicle {
  id: string;
  type: string;
  label: string;
  sub: string;
  priceKey: string;
  color: string;
  icon: string;
  enabled: boolean;
}

// ─── Safe seed data casting (after type definitions) ─────────────────

const seedTransactions = (Array.isArray(seedTransactionsRaw) ? seedTransactionsRaw : []) as Transaction[];
const seedSettings = (seedSettingsRaw || {}) as Settings;
const seedAdmins = (Array.isArray(seedAdminsRaw) ? seedAdminsRaw : []) as Admin[];
const seedExpenses = (Array.isArray(seedExpensesRaw) ? seedExpensesRaw : []) as Expense[];
const seedVehicles = (Array.isArray(seedVehiclesRaw) ? seedVehiclesRaw : []) as Vehicle[];

// ─── Context Value ───────────────────────────────────────────────────

interface DatabaseContextValue {
  // Data
  transactions: Transaction[];
  settings: Settings;
  admins: Admin[];
  expenses: Expense[];
  vehicles: Vehicle[];

  // Transaction operations
  addTransaction: (type: string, amount: number) => Transaction;

  // Settings operations
  updateSettings: (patch: Partial<Settings>) => void;

  // Expense operations
  addExpense: (expense: Omit<Expense, "id">) => void;

  // Auth operations
  authenticateAdmin: (username: string, password: string) => Admin | null;
  currentAdmin: Admin | null;
  setCurrentAdmin: (admin: Admin | null) => void;

  // Computed helpers
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>(seedTransactions as Transaction[]);
  const [settings, setSettings] = useState<Settings>(seedSettings as Settings);
  const [admins] = useState<Admin[]>(seedAdmins as Admin[]);
  const [expenses, setExpenses] = useState<Expense[]>(seedExpenses as Expense[]);
  const [vehicles] = useState<Vehicle[]>(seedVehicles as Vehicle[]);
  const [currentAdmin, setCurrentAdmin] = useState<Admin | null>(null);

  // Generate a control number
  const generateControlNumber = useCallback(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, "0");
    const d = now.getDate().toString().padStart(2, "0");
    const seq = Math.floor(Math.random() * 999999).toString().padStart(6, "0");
    return `${y}-${m}-${d}-${seq}`;
  }, []);

  // Generate a transaction ID
  const generateTransactionId = useCallback(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, "0");
    const d = now.getDate().toString().padStart(2, "0");
    const seq = (transactions.length + 1).toString().padStart(6, "0");
    return `TXN-${y}${m}${d}-${seq}`;
  }, [transactions.length]);

  const addTransaction = useCallback(
    (type: string, amount: number): Transaction => {
      const newTx: Transaction = {
        id: generateTransactionId(),
        type,
        amount,
        timestamp: new Date().toISOString(),
        status: "Success",
        kioskId: settings.kioskId,
        controlNumber: generateControlNumber(),
      };
      setTransactions((prev) => [newTx, ...prev]);
      return newTx;
    },
    [generateTransactionId, generateControlNumber, settings.kioskId]
  );

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const addExpense = useCallback((expense: Omit<Expense, "id">) => {
    const id = `EXP-${(expenses.length + 1).toString().padStart(3, "0")}`;
    setExpenses((prev) => [{ id, ...expense }, ...prev]);
  }, [expenses.length]);

  const authenticateAdmin = useCallback(
    (username: string, password: string): Admin | null => {
      const found = admins.find(
        (a) => a.username === username && a.password === password
      );
      return found || null;
    },
    [admins]
  );

  // Computed
  const totalRevenue = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const totalExpenses = expenses.reduce((sum, ex) => sum + ex.amount, 0);
  const netProfit = totalRevenue - totalExpenses;

  return (
    <DatabaseContext.Provider
      value={{
        transactions,
        settings,
        admins,
        expenses,
        vehicles,
        addTransaction,
        updateSettings,
        addExpense,
        authenticateAdmin,
        currentAdmin,
        setCurrentAdmin,
        totalRevenue,
        totalExpenses,
        netProfit,
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────

export function useDatabase() {
  const ctx = useContext(DatabaseContext);
  if (!ctx) {
    throw new Error("useDatabase must be used within a DatabaseProvider");
  }
  return ctx;
}
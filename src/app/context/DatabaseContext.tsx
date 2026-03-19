import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import type {
  Transaction,
  Settings,
  Admin,
  Expense,
  Vehicle,
} from "../api/types";
import { apiClient } from "../api/client";

// ─── Context Value ───────────────────────────────────────────────────

interface DatabaseContextValue {
  // Data
  transactions: Transaction[];
  settings: Settings | null;
  admins: Admin[];
  expenses: Expense[];
  vehicles: Vehicle[];

  // Transaction operations
  addTransaction: (type: string, amount: number, kioskId?: string) => Promise<Transaction>;
  fetchTransactions: (page?: number, limit?: number) => Promise<void>;

  // Settings operations
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  fetchSettings: (kioskId?: string) => Promise<void>;

  // Expense operations
  addExpense: (expense: Omit<Expense, "id" | "createdAt" | "updatedAt">) => Promise<Expense>;
  fetchExpenses: (page?: number, limit?: number) => Promise<void>;

  // Vehicles operations
  fetchVehicles: () => Promise<void>;

  // Auth operations
  authenticateAdmin: (username: string, password: string) => Promise<Admin | null>;
  currentAdmin: Admin | null;
  setCurrentAdmin: (admin: Admin | null) => void;

  // Computed helpers
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;

  // Loading and error states
  isLoading: boolean;
  error: string | null;
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [currentAdmin, setCurrentAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kioskId = "KIOSK-001"; // Default kiosk ID

  // ────── Fetch Operations ──────────────────────────────────────────

  const fetchSettings = useCallback(async (id: string = kioskId) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiClient.getSettings(id);
      setSettings(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load settings";
      setError(message);
      console.error("Error fetching settings:", message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchTransactions = useCallback(async (page: number = 1, limit: number = 20) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiClient.getTransactions(page, limit);
      setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load transactions";
      setError(message);
      console.error("Error fetching transactions:", message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchExpenses = useCallback(async (page: number = 1, limit: number = 20) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiClient.getExpenses(page, limit);
      setExpenses(Array.isArray(data.expenses) ? data.expenses : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load expenses";
      setError(message);
      console.error("Error fetching expenses:", message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchVehicles = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiClient.getVehicles();
      setVehicles(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load vehicles";
      setError(message);
      console.error("Error fetching vehicles:", message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ────── Mutation Operations ──────────────────────────────────────

  const authenticateAdmin = useCallback(async (username: string, password: string) => {
    try {
      setError(null);
      const admin = await apiClient.login(username, password);
      setCurrentAdmin(admin);
      return admin;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      setError(message);
      console.error("Error authenticating:", message);
      return null;
    }
  }, []);

  const addTransaction = useCallback(
    async (type: string, amount: number, id: string = kioskId) => {
      try {
        setError(null);
        const transaction = await apiClient.createTransaction({
          kioskId: id,
          type,
          amount,
          status: "Success",
          timestamp: new Date().toISOString(),
          notes: "",
        });
        setTransactions((prev) => [transaction, ...prev]);
        return transaction;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create transaction";
        setError(message);
        console.error("Error creating transaction:", message);
        throw err;
      }
    },
    []
  );

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      try {
        setError(null);
        const updated = await apiClient.updateSettings(kioskId, patch);
        setSettings(updated);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update settings";
        setError(message);
        console.error("Error updating settings:", message);
        throw err;
      }
    },
    []
  );

  const addExpense = useCallback(
    async (expense: Omit<Expense, "id" | "createdAt" | "updatedAt">) => {
      try {
        setError(null);
        const created = await apiClient.createExpense(expense);
        setExpenses((prev) => [created, ...prev]);
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create expense";
        setError(message);
        console.error("Error creating expense:", message);
        throw err;
      }
    },
    []
  );

  // ────── Initial Data Load ─────────────────────────────────────────

  useEffect(() => {
    const loadInitialData = async () => {
      await Promise.all([
        fetchSettings(),
        fetchTransactions(),
        fetchExpenses(),
        fetchVehicles(),
      ]);
    };

    loadInitialData();
  }, [fetchSettings, fetchTransactions, fetchExpenses, fetchVehicles]);

  // ────── Computed Values ───────────────────────────────────────────

  const totalRevenue = useMemo(
    () => (Array.isArray(transactions) ? transactions : []).reduce((sum, tx) => sum + (tx.status === "Success" ? tx.amount : 0), 0),
    [transactions]
  );

  const totalExpenses = useMemo(
    () => (Array.isArray(expenses) ? expenses : []).reduce((sum, ex) => sum + ex.amount, 0),
    [expenses]
  );

  const netProfit = useMemo(() => totalRevenue - totalExpenses, [totalRevenue, totalExpenses]);

  const value: DatabaseContextValue = {
    transactions,
    settings,
    admins,
    expenses,
    vehicles,
    addTransaction,
    fetchTransactions,
    updateSettings,
    fetchSettings,
    addExpense,
    fetchExpenses,
    fetchVehicles,
    authenticateAdmin,
    currentAdmin,
    setCurrentAdmin,
    totalRevenue,
    totalExpenses,
    netProfit,
    isLoading,
    error,
  };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error("useDatabase must be used within a DatabaseProvider");
  }
  return context;
}

export type { Transaction, Settings, Admin, Expense, Vehicle };

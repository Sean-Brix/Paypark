/**
 * API Client Service
 * Handles all communication with the Paypark backend server
 */
import type {
  Admin,
  Settings,
  Vehicle,
  Transaction,
  Expense,
} from "./types";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "/api").trim();

class ApiClient {
  private baseUrl = API_BASE_URL;

  /**
   * Generic fetch wrapper with error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: `HTTP ${response.status}`,
      }));
      throw new Error(error.message || `Request failed: ${response.statusCode}`);
    }

    const data = await response.json();
    return data.data || data;
  }

  // ────── Auth ──────────────────────────────────────────

  async login(username: string, password: string): Promise<Admin> {
    return this.request<Admin>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  }

  // ────── Settings ──────────────────────────────────────

  async getSettings(kioskId: string = "KIOSK-001"): Promise<Settings> {
    return this.request<Settings>(`/settings?kioskId=${kioskId}`);
  }

  async updateSettings(
    kioskId: string,
    updates: Partial<Settings>
  ): Promise<Settings> {
    return this.request<Settings>(`/settings`, {
      method: "PATCH",
      body: JSON.stringify({ kioskId, ...updates }),
    });
  }

  // ────── Vehicles ──────────────────────────────────────

  async getVehicles(): Promise<Vehicle[]> {
    return this.request<Vehicle[]>("/vehicles");
  }

  async updateVehicle(vehicleId: string, updates: Partial<Vehicle>): Promise<Vehicle> {
    return this.request<Vehicle>(`/vehicles/${vehicleId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  // ────── Transactions ──────────────────────────────────

  async getTransactions(
    page: number = 1,
    limit: number = 20,
    filters?: {
      type?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ): Promise<{ transactions: Transaction[]; total: number; page: number }> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...filters,
    });
    const data = await this.request<{
      items?: Transaction[];
      pagination?: { total?: number; page?: number };
    }>(`/transactions?${params.toString()}`);

    return {
      transactions: Array.isArray(data?.items) ? data.items : [],
      total: Number(data?.pagination?.total ?? 0),
      page: Number(data?.pagination?.page ?? page),
    };
  }

  async createTransaction(
    transaction: Omit<Transaction, "id" | "controlNumber" | "createdAt" | "updatedAt">
  ): Promise<Transaction> {
    return this.request<Transaction>("/transactions", {
      method: "POST",
      body: JSON.stringify(transaction),
    });
  }

  // ────── Expenses ──────────────────────────────────────

  async getExpenses(
    page: number = 1,
    limit: number = 20,
    filters?: {
      category?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ): Promise<{ expenses: Expense[]; total: number; page: number }> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...filters,
    });
    const data = await this.request<{
      items?: Expense[];
      pagination?: { total?: number; page?: number };
    }>(`/expenses?${params.toString()}`);

    return {
      expenses: Array.isArray(data?.items) ? data.items : [],
      total: Number(data?.pagination?.total ?? 0),
      page: Number(data?.pagination?.page ?? page),
    };
  }

  async createExpense(
    expense: Omit<Expense, "id" | "createdAt" | "updatedAt">
  ): Promise<Expense> {
    return this.request<Expense>("/expenses", {
      method: "POST",
      body: JSON.stringify(expense),
    });
  }

  // ────── Payments (Single Webhook Endpoint) ─────────────

  async sendPaymentWebhook(payload: {
    kioskId?: string;
    type?: string;
    vehicleType?: string;
    targetAmount?: number;
    coinAmount?: number;
    amount?: number;
    eventId?: string;
    timestamp?: string;
  }): Promise<{
    status: "Pending" | "Success";
    totalInserted: number;
    targetAmount: number | null;
    remaining: number | null;
    transaction: Transaction | null;
    controlNumber: string;
  }> {
    return this.request("/payments/webhook", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
}

export const apiClient = new ApiClient();

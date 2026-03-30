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

  private buildQuery(
    params: Record<string, string | number | undefined | null>
  ): string {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) {
        continue;
      }

      const normalizedValue = typeof value === "string" ? value.trim() : String(value);
      if (normalizedValue.length === 0) {
        continue;
      }

      searchParams.set(key, normalizedValue);
    }

    const queryString = searchParams.toString();
    return queryString.length > 0 ? `?${queryString}` : "";
  }

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

  async login(username: string, password: string): Promise<Admin> {
    return this.request<Admin>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  }

  async changeAdminPassword(payload: {
    adminId: string;
    currentPassword: string;
    newPassword: string;
  }): Promise<{ updated: boolean }> {
    return this.request<{ updated: boolean }>("/auth/password", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async getSettings(kioskId: string = "KIOSK-001"): Promise<Settings> {
    return this.request<Settings>(`/settings?kioskId=${kioskId}`);
  }

  async updateSettings(
    kioskId: string,
    updates: Partial<Settings>
  ): Promise<Settings> {
    return this.request<Settings>("/settings", {
      method: "PATCH",
      body: JSON.stringify({ kioskId, ...updates }),
    });
  }

  async getVehicles(): Promise<Vehicle[]> {
    return this.request<Vehicle[]>("/vehicles");
  }

  async updateVehicle(
    vehicleId: string,
    updates: Partial<Vehicle>
  ): Promise<Vehicle> {
    return this.request<Vehicle>(`/vehicles/${vehicleId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  async getTransactions(
    page: number = 1,
    limit: number = 20,
    filters?: {
      id?: string;
      search?: string;
      type?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ): Promise<{ transactions: Transaction[]; total: number; page: number; totalPages: number; limit: number }> {
    const data = await this.request<{
      items?: Transaction[];
      pagination?: { total?: number; page?: number; totalPages?: number; limit?: number };
    }>(`/transactions${this.buildQuery({
      page,
      limit,
      ...filters,
    })}`);

    return {
      transactions: Array.isArray(data?.items) ? data.items : [],
      total: Number(data?.pagination?.total ?? 0),
      page: Number(data?.pagination?.page ?? page),
      totalPages: Number(data?.pagination?.totalPages ?? 1),
      limit: Number(data?.pagination?.limit ?? limit),
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

  async getExpenses(
    page: number = 1,
    limit: number = 20,
    filters?: {
      category?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ): Promise<{ expenses: Expense[]; total: number; page: number }> {
    const data = await this.request<{
      items?: Expense[];
      pagination?: { total?: number; page?: number };
    }>(`/expenses${this.buildQuery({
      page,
      limit,
      ...filters,
    })}`);

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

  async startPaymentSession(payload: {
    kioskId?: string;
    type?: string;
    vehicleType?: string;
    targetAmount: number;
  }): Promise<{
    status: "Pending" | "Success";
    totalInserted: number;
    targetAmount: number | null;
    remaining: number | null;
    transaction: Transaction | null;
    controlNumber: string;
    kioskId: string;
  }> {
    return this.request("/payments/session", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getPaymentStatus(
    controlNumber: string,
    kioskId: string = "KIOSK-001"
  ): Promise<{
    status: "Pending" | "Success";
    totalInserted: number;
    targetAmount: number | null;
    remaining: number | null;
    transaction: Partial<Transaction> | null;
    controlNumber: string | null;
    kioskId: string;
  }> {
    const params = new URLSearchParams({
      kioskId,
      controlNumber,
    });

    return this.request(`/payments/status?${params.toString()}`, {
      method: "GET",
    });
  }

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

  async printReceipt(payload: {
    vehicleType: string;
    amount: number;
    controlNumber: string;
    timestamp: string;
    receiptHeader?: string;
    receiptFooter?: string;
  }): Promise<{ success: boolean; message: string }> {
    const printServiceUrl = "http://localhost:3333";

    try {
      const response = await fetch(`${printServiceUrl}/print/receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: `HTTP ${response.status}`,
        }));
        throw new Error(error.message || `Print request failed: ${response.statusCode}`);
      }

      return await response.json();
    } catch (error) {
      console.warn(`Local print service unavailable: ${error.message}`);
      return this.request("/print/receipt", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
  }
}

export const apiClient = new ApiClient();

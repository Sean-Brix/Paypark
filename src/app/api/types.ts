/**
 * API Types - Matches backend Prisma models
 * Shared contract between frontend and server
 */

export interface Admin {
  id: string;
  username: string;
  displayName: string;
  role: string;
  initials: string;
  lastLogin: string | null;
  createdAt: string;
}

export interface Settings {
  kioskId: string;
  kioskName: string;
  location: string;
  carPrice: number;
  motorcyclePrice: number;
  ebikePrice: number;
  operatingHours: {
    open: string; // HH:mm
    close: string; // HH:mm
  };
  receiptHeader: string;
  receiptFooter: string;
  systemVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vehicle {
  id: string;
  type: string;
  label: string;
  sub: string;
  priceKey: "carPrice" | "motorcyclePrice" | "ebikePrice";
  color: string;
  icon: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  kioskId: string;
  type: string;
  amount: number;
  status: string;
  controlNumber: string;
  timestamp: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Expense {
  id: string;
  label: string;
  amount: number;
  category: string;
  date: string;
  description: string;
  createdAt?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  status?: number;
}

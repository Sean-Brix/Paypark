import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Search,
  FileText,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient, type TransactionQueryFilters } from "../api/client";
import type { Transaction } from "../api/types";
import { useDatabase } from "../context/DatabaseContext";

const PAGE_SIZE = 10;
type DateScope = "overall" | "day" | "month" | "year";

const DATE_SCOPE_LABELS: Record<DateScope, string> = {
  overall: "Overall",
  day: "Per Day",
  month: "Per Month",
  year: "Per Year",
};

function formatCurrency(amount: number) {
  return `${"\u20B1"}${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateValue: string) {
  return new Date(dateValue).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(dateValue: string) {
  return new Date(dateValue).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHtml(value: string | number) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getVisiblePages(currentPage: number, totalPages: number) {
  const maxVisiblePages = 5;
  const startPage = Math.max(
    1,
    Math.min(currentPage - 2, totalPages - maxVisiblePages + 1)
  );
  const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  return Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);
}

function buildExportFileStamp() {
  return new Date().toISOString().slice(0, 19).replaceAll(":", "-");
}

function getTodayDateValue() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function getMonthValue() {
  return getTodayDateValue().slice(0, 7);
}

function getYearValue() {
  return getTodayDateValue().slice(0, 4);
}

function toDateValue(value: Date) {
  const localDate = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function getDateRangeForScope(scope: DateScope, dayValue: string, monthValue: string, yearValue: string) {
  if (scope === "day") {
    const normalizedDay = String(dayValue || "").trim();
    if (!normalizedDay) {
      return {
        label: "Per Day",
      };
    }

    return {
      dateFrom: normalizedDay,
      dateTo: normalizedDay,
      label: `Per Day: ${normalizedDay}`,
    };
  }

  if (scope === "month") {
    const [yearRaw, monthRaw] = String(monthValue || "").split("-");
    const year = Number.parseInt(yearRaw || "", 10);
    const monthIndex = Number.parseInt(monthRaw || "", 10) - 1;

    if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
      return {
        label: "Per Month",
      };
    }

    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0);

    return {
      dateFrom: toDateValue(start),
      dateTo: toDateValue(end),
      label: `Per Month: ${monthValue}`,
    };
  }

  if (scope === "year") {
    const parsedYear = Number.parseInt(String(yearValue || ""), 10);
    if (!Number.isFinite(parsedYear)) {
      return {
        label: "Per Year",
      };
    }

    return {
      dateFrom: `${parsedYear}-01-01`,
      dateTo: `${parsedYear}-12-31`,
      label: `Per Year: ${parsedYear}`,
    };
  }

  return {
    label: "Overall",
  };
}

function buildPdfDocument(
  transactions: Transaction[],
  filters: { search?: string; id?: string; scopeLabel: string },
  totalAmount: number
) {
  const filterSummary = [
    `Report scope: ${filters.scopeLabel}`,
    filters.search ? `Transaction search: ${filters.search}` : null,
    filters.id ? `ID search: ${filters.id}` : null,
    `Status: Success`,
  ]
    .filter(Boolean)
    .join(" | ");

  const rows = transactions
    .map(
      (transaction) => `
        <tr>
          <td>${escapeHtml(transaction.id)}</td>
          <td>${escapeHtml(transaction.type)}</td>
          <td>${escapeHtml(formatCurrency(transaction.amount))}</td>
          <td>${escapeHtml(formatDate(transaction.timestamp))}</td>
          <td>${escapeHtml(formatTime(transaction.timestamp))}</td>
          <td>${escapeHtml(transaction.status)}</td>
          <td>${escapeHtml(transaction.controlNumber)}</td>
          <td>${escapeHtml(transaction.kioskId)}</td>
        </tr>
      `
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Transactions Export</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      }

      body {
        margin: 32px;
        color: #0f172a;
      }

      h1 {
        margin: 0 0 8px;
        font-size: 28px;
      }

      p {
        margin: 0 0 8px;
        color: #475569;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 24px;
        font-size: 12px;
      }

      th,
      td {
        border: 1px solid #cbd5e1;
        padding: 10px 12px;
        text-align: left;
      }

      th {
        background: #f8fafc;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 10px;
      }

      @media print {
        body {
          margin: 16px;
        }
      }
    </style>
  </head>
  <body>
    <h1>Successful Transactions</h1>
    <p>Generated: ${escapeHtml(new Date().toLocaleString())}</p>
    <p>${escapeHtml(filterSummary)}</p>
    <p><strong>Total Collected: ${escapeHtml(formatCurrency(totalAmount))}</strong></p>
    <table>
      <thead>
        <tr>
          <th>Transaction ID</th>
          <th>Vehicle</th>
          <th>Amount</th>
          <th>Date</th>
          <th>Time</th>
          <th>Status</th>
          <th>Control No.</th>
          <th>Kiosk</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    <script>
      window.addEventListener("load", () => {
        window.setTimeout(() => window.print(), 150);
      });
      window.addEventListener("afterprint", () => window.close());
    </script>
  </body>
</html>`;
}

interface TransactionsTableProps {
  searchQuery?: string;
}

export function TransactionsTable({ searchQuery = "" }: TransactionsTableProps) {
  const db = useDatabase();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [idQuery, setIdQuery] = useState("");
  const [dateScope, setDateScope] = useState<DateScope>("overall");
  const [dayValue, setDayValue] = useState(getTodayDateValue);
  const [monthValue, setMonthValue] = useState(getMonthValue);
  const [yearValue, setYearValue] = useState(getYearValue);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState<"pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deferredSearchQuery = useDeferredValue(searchQuery.trim());
  const deferredIdQuery = useDeferredValue(idQuery.trim());
  const refreshToken = db.transactions.length;
  const dateRange = useMemo(
    () => getDateRangeForScope(dateScope, dayValue, monthValue, yearValue),
    [dateScope, dayValue, monthValue, yearValue]
  );

  useEffect(() => {
    setPage(1);
  }, [searchQuery, idQuery, dateScope, dayValue, monthValue, yearValue]);

  const activeFilters = useMemo<TransactionQueryFilters>(
    () => ({
      status: "Success",
      search: deferredSearchQuery || undefined,
      id: deferredIdQuery || undefined,
      dateFrom: dateRange.dateFrom,
      dateTo: dateRange.dateTo,
    }),
    [dateRange.dateFrom, dateRange.dateTo, deferredIdQuery, deferredSearchQuery]
  );

  const activeScopeLabel = dateRange.label;

  useEffect(() => {
    let isCancelled = false;

    async function loadTransactions() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await apiClient.getTransactions(page, PAGE_SIZE, activeFilters);

        if (isCancelled) {
          return;
        }

        setTransactions(data.transactions);
        setTotal(data.total);
        setTotalPages(Math.max(1, data.totalPages));
      } catch (loadError) {
        if (isCancelled) {
          return;
        }

        setTransactions([]);
        setTotal(0);
        setTotalPages(1);
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load transactions."
        );
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadTransactions();

    return () => {
      isCancelled = true;
    };
  }, [page, activeFilters, refreshToken]);

  const visiblePages = useMemo(() => getVisiblePages(page, totalPages), [page, totalPages]);

  const totalLabel = total === 1 ? "1 record" : `${total} records`;

  async function getAllMatchingTransactions() {
    return apiClient.getAllTransactions(activeFilters);
  }

  async function handleExportPdf() {
    const printWindow = window.open("", "_blank", "width=1200,height=900");
    if (!printWindow) {
      toast.error("Allow pop-ups to export the table as PDF.");
      return;
    }

    setIsExporting("pdf");

    try {
      const exportedTransactions = await getAllMatchingTransactions();
      if (exportedTransactions.length === 0) {
        printWindow.close();
        toast.error("No transactions match the current filters.");
        return;
      }

      const totalAmount = exportedTransactions.reduce(
        (sum, transaction) => sum + Number(transaction.amount || 0),
        0
      );

      printWindow.document.open();
      printWindow.document.write(
        buildPdfDocument(
          exportedTransactions,
          {
            search: activeFilters.search,
            id: activeFilters.id,
            scopeLabel: activeScopeLabel,
          },
          totalAmount
        )
      );
      printWindow.document.close();
      toast.success("Print dialog opened. Choose Save as PDF to finish exporting.");
    } catch (exportError) {
      printWindow.close();
      toast.error(
        exportError instanceof Error ? exportError.message : "Failed to export PDF."
      );
    } finally {
      setIsExporting(null);
    }
  }

  async function handleCopyTransaction(transaction: Transaction) {
    try {
      await navigator.clipboard.writeText(
        [
          `Transaction ID: ${transaction.id}`,
          `Control Number: ${transaction.controlNumber}`,
          `Vehicle Type: ${transaction.type}`,
          `Amount: ${formatCurrency(transaction.amount)}`,
          `Timestamp: ${new Date(transaction.timestamp).toLocaleString()}`,
          `Kiosk ID: ${transaction.kioskId}`,
        ].join("\n")
      );
      toast.success("Transaction details copied.");
    } catch {
      toast.error("Clipboard access is not available.");
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 p-8 border-b border-slate-200 bg-white">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Recent Activity</h3>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
            Successful payment logs with live search and pagination
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input
              type="text"
              value={idQuery}
              onChange={(event) => setIdQuery(event.target.value)}
              placeholder="Search ID or control no..."
              className="w-full bg-slate-50 border border-slate-200 py-3 pl-11 pr-4 focus:ring-2 focus:ring-[#1E7F5C]/10 outline-none font-bold text-sm text-slate-600 placeholder:text-slate-300 transition-all"
            />
          </div>
          <select
            value={dateScope}
            onChange={(event) => setDateScope(event.target.value as DateScope)}
            className="bg-slate-50 border border-slate-200 py-3 px-4 focus:ring-2 focus:ring-[#1E7F5C]/10 outline-none font-bold text-sm text-slate-600"
          >
            <option value="overall">Overall</option>
            <option value="day">Per Day</option>
            <option value="month">Per Month</option>
            <option value="year">Per Year</option>
          </select>
          {dateScope === "day" ? (
            <input
              type="date"
              value={dayValue}
              onChange={(event) => setDayValue(event.target.value)}
              className="bg-slate-50 border border-slate-200 py-3 px-4 focus:ring-2 focus:ring-[#1E7F5C]/10 outline-none font-bold text-sm text-slate-600"
            />
          ) : null}
          {dateScope === "month" ? (
            <input
              type="month"
              value={monthValue}
              onChange={(event) => setMonthValue(event.target.value)}
              className="bg-slate-50 border border-slate-200 py-3 px-4 focus:ring-2 focus:ring-[#1E7F5C]/10 outline-none font-bold text-sm text-slate-600"
            />
          ) : null}
          {dateScope === "year" ? (
            <input
              type="number"
              min="2000"
              max="9999"
              value={yearValue}
              onChange={(event) => setYearValue(event.target.value)}
              className="w-28 bg-slate-50 border border-slate-200 py-3 px-4 focus:ring-2 focus:ring-[#1E7F5C]/10 outline-none font-bold text-sm text-slate-600"
              placeholder="YYYY"
            />
          ) : null}
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExporting !== null}
            className="flex items-center justify-center gap-2 px-6 py-3 border border-slate-200 bg-white text-slate-700 font-black text-xs uppercase tracking-widest hover:border-[#1E7F5C] hover:text-[#1E7F5C] transition-all disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FileText className="w-4 h-4" />
            {isExporting === "pdf" ? "Preparing..." : "Export PDF"}
          </button>
        </div>
      </div>

      <div className="bg-white flex-1 overflow-hidden flex flex-col">
        <div className="px-8 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
          <span>{totalLabel}</span>
          <span>
            {`Scope: ${DATE_SCOPE_LABELS[dateScope]}${
              dateScope === "day"
                ? ` (${dayValue || "Select date"})`
                : dateScope === "month"
                  ? ` (${monthValue || "Select month"})`
                  : dateScope === "year"
                    ? ` (${yearValue || "Select year"})`
                    : ""
            }`}
            {" | "}
            {searchQuery.trim() ? `Search: ${searchQuery.trim()}` : "Search: All transactions"}
            {idQuery.trim() ? ` | ID: ${idQuery.trim()}` : ""}
          </span>
        </div>

        <div className="overflow-y-auto flex-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-300">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white z-10 shadow-sm shadow-slate-100">
              <tr className="border-b border-slate-100">
                <th className="hidden lg:table-cell px-6 lg:px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Transaction</th>
                <th className="px-4 md:px-6 lg:px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Vehicle</th>
                <th className="px-4 md:px-6 lg:px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Revenue</th>
                <th className="hidden xl:table-cell px-6 lg:px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Timestamp</th>
                <th className="hidden md:table-cell px-4 md:px-6 lg:px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Status</th>
                <th className="hidden xl:table-cell px-6 lg:px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Control No.</th>
                <th className="px-4 md:px-6 lg:px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 lg:px-10 py-12 text-center text-sm font-bold text-slate-400 uppercase tracking-widest">
                    Loading transactions...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-6 lg:px-10 py-12 text-center text-sm font-bold text-red-400 uppercase tracking-widest">
                    {error}
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 lg:px-10 py-12 text-center text-sm font-bold text-slate-400 uppercase tracking-widest">
                    No successful transactions match the current filters.
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="hidden lg:table-cell px-6 lg:px-10 py-4 lg:py-6">
                      <div className="space-y-1">
                        <span className="block font-black text-slate-800 tracking-tighter text-sm">
                          #{transaction.id.slice(-6)}
                        </span>
                        <span className="block font-mono text-[11px] text-slate-400">
                          {transaction.id}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 lg:px-10 py-4 lg:py-6">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 md:w-10 md:h-10 flex-shrink-0 flex items-center justify-center ${
                            transaction.type === "Car"
                              ? "bg-emerald-50 text-emerald-600"
                              : transaction.type === "Motorcycle"
                                ? "bg-amber-50 text-amber-600"
                                : "bg-indigo-50 text-indigo-600"
                          }`}
                        >
                          <div className="w-1.5 h-1.5 bg-current" />
                        </div>
                        <span className="font-bold text-slate-700 text-sm tracking-tight">{transaction.type}</span>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 lg:px-10 py-4 lg:py-6">
                      <span className="font-black text-slate-800 text-sm md:text-lg">
                        {formatCurrency(transaction.amount)}
                      </span>
                    </td>
                    <td className="hidden xl:table-cell px-6 lg:px-10 py-4 lg:py-6">
                      <div className="text-slate-500 font-bold text-xs uppercase tracking-tight">
                        <p>{formatDate(transaction.timestamp)}</p>
                        <p className="text-[10px] opacity-40">{formatTime(transaction.timestamp)}</p>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-4 md:px-6 lg:px-10 py-4 lg:py-6">
                      <span className="inline-flex items-center gap-2 px-3 py-1 md:px-4 md:py-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest border border-emerald-100 whitespace-nowrap">
                        <div className="w-1.5 h-1.5 bg-emerald-500 animate-pulse" />
                        {transaction.status}
                      </span>
                    </td>
                    <td className="hidden xl:table-cell px-6 lg:px-10 py-4 lg:py-6">
                      <span className="font-mono text-xs text-slate-400 tracking-tight">{transaction.controlNumber}</span>
                    </td>
                    <td className="px-4 md:px-6 lg:px-10 py-4 lg:py-6">
                      <div className="flex justify-center">
                        <button
                          type="button"
                          title="Copy transaction details"
                          onClick={() => handleCopyTransaction(transaction)}
                          className="w-8 h-8 md:w-10 md:h-10 text-slate-300 hover:bg-[#1E7F5C] hover:text-white transition-all flex items-center justify-center border border-transparent hover:shadow-lg hover:shadow-[#1E7F5C]/20"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-10 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-6">
          <p className="text-slate-300 font-bold text-xs uppercase tracking-widest">
            Page {page} of {totalPages} &bull; {totalLabel}
          </p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
              disabled={page === 1 || isLoading}
              className="w-12 h-12 border border-slate-100 flex items-center justify-center text-slate-300 hover:bg-slate-50 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex gap-2">
              {visiblePages.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  disabled={isLoading}
                  className={
                    pageNumber === page
                      ? "w-12 h-12 bg-[#1E7F5C] text-white font-black text-sm shadow-xl shadow-[#1E7F5C]/20"
                      : "w-12 h-12 border border-slate-100 text-slate-400 font-black text-sm hover:bg-slate-50 disabled:cursor-not-allowed"
                  }
                >
                  {pageNumber}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
              disabled={page === totalPages || isLoading}
              className="w-12 h-12 border border-slate-100 flex items-center justify-center text-slate-300 hover:bg-slate-50 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

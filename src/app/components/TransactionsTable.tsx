import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Search,
  FileText,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "../api/client";
import type { Transaction } from "../api/types";
import { useDatabase } from "../context/DatabaseContext";

const PAGE_SIZE = 10;
const EXPORT_PAGE_SIZE = 100;

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

function getMonthDateRange(monthValue: string) {
  const normalized = String(monthValue || "").trim();
  if (!/^\d{4}-\d{2}$/.test(normalized)) {
    return { dateFrom: undefined as string | undefined, dateTo: undefined as string | undefined };
  }

  const [yearPart, monthPart] = normalized.split("-");
  const year = Number.parseInt(yearPart, 10);
  const monthIndex = Number.parseInt(monthPart, 10) - 1;

  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return { dateFrom: undefined as string | undefined, dateTo: undefined as string | undefined };
  }

  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const dateFrom = `${yearPart}-${monthPart}-01`;
  const dateTo = `${yearPart}-${monthPart}-${String(lastDay).padStart(2, "0")}`;

  return {
    dateFrom,
    dateTo,
  };
}

function buildPdfDocument(
  transactions: Transaction[],
  filters: { search?: string; id?: string; type?: string; month?: string }
) {
  const filterSummary = [
    filters.search ? `Transaction search: ${filters.search}` : null,
    filters.id ? `ID search: ${filters.id}` : null,
    filters.type ? `Vehicle type: ${filters.type}` : null,
    filters.month ? `Month: ${filters.month}` : null,
    "Status: Success",
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
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState("All");
  const [monthFilter, setMonthFilter] = useState("");
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportMonth, setExportMonth] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState<"pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deferredSearchQuery = useDeferredValue(searchQuery.trim());
  const deferredIdQuery = useDeferredValue(idQuery.trim());
  const deferredVehicleTypeFilter = useDeferredValue(vehicleTypeFilter);
  const deferredMonthFilter = useDeferredValue(monthFilter);
  const refreshToken = db.transactions.length;
  const monthRange = useMemo(() => getMonthDateRange(deferredMonthFilter), [deferredMonthFilter]);
  const vehicleTypeOptions = useMemo(() => {
    const types = db.vehicles.map((vehicle) => vehicle.type).filter(Boolean);
    return ["All", ...Array.from(new Set(types))];
  }, [db.vehicles]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, idQuery, vehicleTypeFilter, monthFilter]);

  useEffect(() => {
    let isCancelled = false;

    async function loadTransactions() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await apiClient.getTransactions(page, PAGE_SIZE, {
          status: "Success",
          search: deferredSearchQuery || undefined,
          id: deferredIdQuery || undefined,
          type:
            deferredVehicleTypeFilter !== "All"
              ? deferredVehicleTypeFilter || undefined
              : undefined,
          dateFrom: monthRange.dateFrom,
          dateTo: monthRange.dateTo,
        });

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
  }, [
    page,
    deferredSearchQuery,
    deferredIdQuery,
    deferredVehicleTypeFilter,
    monthRange.dateFrom,
    monthRange.dateTo,
    refreshToken,
  ]);

  const visiblePages = useMemo(() => getVisiblePages(page, totalPages), [page, totalPages]);

  const activeFilters = useMemo(
    () => ({
      status: "Success",
      search: searchQuery.trim() || undefined,
      id: idQuery.trim() || undefined,
      type: vehicleTypeFilter !== "All" ? vehicleTypeFilter : undefined,
      dateFrom: getMonthDateRange(monthFilter).dateFrom,
      dateTo: getMonthDateRange(monthFilter).dateTo,
    }),
    [idQuery, monthFilter, searchQuery, vehicleTypeFilter]
  );

  const activeFilterSummary = useMemo(() => {
    const parts = [
      searchQuery.trim() ? `Search: ${searchQuery.trim()}` : "Search: All transactions",
      idQuery.trim() ? `ID: ${idQuery.trim()}` : null,
      vehicleTypeFilter !== "All" ? `Type: ${vehicleTypeFilter}` : "Type: All",
      monthFilter ? `Month: ${monthFilter}` : "Month: All",
    ].filter(Boolean);

    return parts.join(" | ");
  }, [idQuery, monthFilter, searchQuery, vehicleTypeFilter]);

  const totalLabel = total === 1 ? "1 record" : `${total} records`;

  async function getAllMatchingTransactions(filterOverrides?: Record<string, string | undefined>) {
    const exportedTransactions: Transaction[] = [];
    let exportPage = 1;
    let exportTotalPages = 1;
    const exportFilters = {
      ...activeFilters,
      ...filterOverrides,
    };

    do {
      const data = await apiClient.getTransactions(exportPage, EXPORT_PAGE_SIZE, exportFilters);
      exportedTransactions.push(...data.transactions);
      exportTotalPages = Math.max(1, data.totalPages);
      exportPage += 1;
    } while (exportPage <= exportTotalPages);

    return exportedTransactions;
  }

  function openExportModal() {
    setExportMonth(monthFilter);
    setIsExportModalOpen(true);
  }

  function closeExportModal() {
    if (isExporting === null) {
      setIsExportModalOpen(false);
    }
  }

  async function handleExportPdf() {
    if (!exportMonth) {
      toast.error("Select a month to export.");
      return;
    }

    const printWindow = window.open("", "_blank", "width=1200,height=900");
    if (!printWindow) {
      toast.error("Allow pop-ups to export the table as PDF.");
      return;
    }

    setIsExporting("pdf");

    try {
      const exportMonthRange = getMonthDateRange(exportMonth);
      const exportedTransactions = await getAllMatchingTransactions({
        dateFrom: exportMonthRange.dateFrom,
        dateTo: exportMonthRange.dateTo,
      });
      if (exportedTransactions.length === 0) {
        printWindow.close();
        toast.error("No transactions match the current filters.");
        return;
      }

      printWindow.document.open();
      printWindow.document.write(
        buildPdfDocument(exportedTransactions, {
          search: activeFilters.search,
          id: activeFilters.id,
          type: activeFilters.type,
          month: exportMonth || undefined,
        })
      );
      printWindow.document.close();
      setIsExportModalOpen(false);
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
            Successful payment logs with filters and pagination
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
          <button
            type="button"
            onClick={openExportModal}
            disabled={isExporting !== null}
            className="flex items-center justify-center gap-2 px-6 py-3 border border-slate-200 bg-white text-slate-700 font-black text-xs uppercase tracking-widest hover:border-[#1E7F5C] hover:text-[#1E7F5C] transition-all disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FileText className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      <div className="px-8 py-4 border-b border-slate-100 bg-white flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <select
            value={vehicleTypeFilter}
            onChange={(event) => setVehicleTypeFilter(event.target.value)}
            className="bg-slate-50 border border-slate-200 py-3 px-4 outline-none font-bold text-sm text-slate-600 focus:ring-2 focus:ring-[#1E7F5C]/10"
          >
            {vehicleTypeOptions.map((typeOption) => (
              <option key={typeOption} value={typeOption}>
                {typeOption === "All" ? "All Vehicle Types" : typeOption}
              </option>
            ))}
          </select>
          <input
            type="month"
            value={monthFilter}
            onChange={(event) => setMonthFilter(event.target.value)}
            className="bg-slate-50 border border-slate-200 py-3 px-4 outline-none font-bold text-sm text-slate-600 focus:ring-2 focus:ring-[#1E7F5C]/10"
          />
          <button
            type="button"
            onClick={() => {
              setVehicleTypeFilter("All");
              setMonthFilter("");
              setIdQuery("");
            }}
            className="px-4 py-3 border border-slate-200 bg-white text-slate-500 font-black text-xs uppercase tracking-widest hover:border-[#1E7F5C] hover:text-[#1E7F5C] transition-all"
          >
            Clear Filters
          </button>
        </div>
      </div>

      <div className="bg-white flex-1 overflow-hidden flex flex-col">
        <div className="px-8 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
          <span>{totalLabel}</span>
          <span>{activeFilterSummary}</span>
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

      {isExportModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-6"
          onClick={closeExportModal}
        >
          <div
            className="w-full max-w-lg border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-8 py-6">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-[#1E7F5C]">Transactions Export</p>
              <h3 className="text-2xl font-black text-slate-800 uppercase">Pick Export Month</h3>
            </div>

            <div className="space-y-6 px-8 py-8">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Month</label>
                <input
                  type="month"
                  value={exportMonth}
                  onChange={(event) => setExportMonth(event.target.value)}
                  className="w-full border-2 border-slate-100 bg-slate-50 px-5 py-4 font-bold text-slate-700 outline-none transition-all focus:border-[#1E7F5C]"
                  required
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeExportModal}
                  disabled={isExporting !== null}
                  className="px-6 py-4 border-2 border-slate-200 text-slate-500 font-black text-sm hover:border-slate-300 hover:text-slate-700 transition-all disabled:opacity-50"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={isExporting !== null}
                  className="px-6 py-4 bg-[#1E7F5C] text-white font-black text-sm shadow-lg shadow-green-900/20 hover:bg-[#166347] transition-all disabled:opacity-50"
                >
                  {isExporting === "pdf" ? "PREPARING..." : "EXPORT PDF"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Search,
  FileText,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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

const DEFAULT_VEHICLE_TYPES = ["Car", "E-Bike", "Motorcycle"];

type VehicleBreakdownItem = {
  type: string;
  count: number;
  amount: number;
};

type TransactionStats = {
  totalVehicles: number;
  totalNet: number;
  averageAmount: number;
  vehicleBreakdown: VehicleBreakdownItem[];
  firstTimestamp: string | null;
  lastTimestamp: string | null;
};

type TimeframeChartPoint = {
  label: string;
  amount: number;
  vehicles: number;
};

type TimeframeChartSeries = {
  title: string;
  subtitle: string;
  points: TimeframeChartPoint[];
};

function normalizeVehicleType(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "Unknown";
  }

  const compact = trimmed.toLowerCase().replace(/[\s_-]+/g, "");
  if (compact === "ebike") {
    return "E-Bike";
  }
  if (compact === "car") {
    return "Car";
  }
  if (compact === "motorcycle") {
    return "Motorcycle";
  }

  return trimmed;
}

function calculateTransactionStats(transactions: Transaction[]): TransactionStats {
  const vehicleTotals = new Map<string, VehicleBreakdownItem>();
  let totalNet = 0;
  let firstTimestampValue = Number.POSITIVE_INFINITY;
  let lastTimestampValue = Number.NEGATIVE_INFINITY;

  for (const transaction of transactions) {
    const amount = Number(transaction.amount || 0);
    totalNet += amount;

    const vehicleType = normalizeVehicleType(transaction.type);
    const current = vehicleTotals.get(vehicleType);

    if (current) {
      current.count += 1;
      current.amount += amount;
    } else {
      vehicleTotals.set(vehicleType, {
        type: vehicleType,
        count: 1,
        amount,
      });
    }

    const timestamp = new Date(transaction.timestamp).getTime();
    if (Number.isFinite(timestamp)) {
      firstTimestampValue = Math.min(firstTimestampValue, timestamp);
      lastTimestampValue = Math.max(lastTimestampValue, timestamp);
    }
  }

  const vehicleBreakdown = Array.from(vehicleTotals.values()).sort(
    (left, right) => right.count - left.count || left.type.localeCompare(right.type)
  );

  return {
    totalVehicles: transactions.length,
    totalNet,
    averageAmount: transactions.length > 0 ? totalNet / transactions.length : 0,
    vehicleBreakdown,
    firstTimestamp: Number.isFinite(firstTimestampValue)
      ? new Date(firstTimestampValue).toISOString()
      : null,
    lastTimestamp: Number.isFinite(lastTimestampValue)
      ? new Date(lastTimestampValue).toISOString()
      : null,
  };
}

function toAxisCurrency(value: number) {
  if (value >= 1_000_000) {
    return `${"\u20B1"}${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${"\u20B1"}${Math.round(value / 1_000)}k`;
  }
  return `${"\u20B1"}${Math.round(value)}`;
}

function buildTimeframeChartSeries(
  transactions: Transaction[],
  scope: DateScope
): TimeframeChartSeries {
  if (transactions.length === 0) {
    return {
      title: "Timeframe Trend",
      subtitle: "No data in the selected timeframe.",
      points: [],
    };
  }

  if (scope === "day") {
    const points = Array.from({ length: 24 }, (_, hour) => ({
      label: `${String(hour).padStart(2, "0")}:00`,
      amount: 0,
      vehicles: 0,
    }));

    for (const transaction of transactions) {
      const date = new Date(transaction.timestamp);
      if (Number.isNaN(date.getTime())) {
        continue;
      }

      const hour = date.getHours();
      points[hour].vehicles += 1;
      points[hour].amount += Number(transaction.amount || 0);
    }

    return {
      title: "Hourly Trend",
      subtitle: "Vehicles and collection amount by hour for the selected day.",
      points,
    };
  }

  if (scope === "month") {
    const byDay = new Map<number, TimeframeChartPoint>();

    for (const transaction of transactions) {
      const date = new Date(transaction.timestamp);
      if (Number.isNaN(date.getTime())) {
        continue;
      }

      const day = date.getDate();
      const current =
        byDay.get(day) ||
        ({
          label: String(day).padStart(2, "0"),
          amount: 0,
          vehicles: 0,
        } as TimeframeChartPoint);

      current.vehicles += 1;
      current.amount += Number(transaction.amount || 0);
      byDay.set(day, current);
    }

    const points = Array.from(byDay.entries())
      .sort((left, right) => left[0] - right[0])
      .map(([, value]) => value);

    return {
      title: "Daily Trend",
      subtitle: "Vehicles and collection amount by day for the selected month.",
      points,
    };
  }

  if (scope === "year") {
    const monthLabels = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const points = monthLabels.map((label) => ({
      label,
      amount: 0,
      vehicles: 0,
    }));

    for (const transaction of transactions) {
      const date = new Date(transaction.timestamp);
      if (Number.isNaN(date.getTime())) {
        continue;
      }

      const monthIndex = date.getMonth();
      points[monthIndex].vehicles += 1;
      points[monthIndex].amount += Number(transaction.amount || 0);
    }

    return {
      title: "Monthly Trend",
      subtitle: "Vehicles and collection amount by month for the selected year.",
      points,
    };
  }

  const byMonth = new Map<number, TimeframeChartPoint>();

  for (const transaction of transactions) {
    const date = new Date(transaction.timestamp);
    if (Number.isNaN(date.getTime())) {
      continue;
    }

    const monthKey = date.getFullYear() * 100 + date.getMonth();
    const label = date.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
    const current =
      byMonth.get(monthKey) ||
      ({
        label,
        amount: 0,
        vehicles: 0,
      } as TimeframeChartPoint);

    current.vehicles += 1;
    current.amount += Number(transaction.amount || 0);
    byMonth.set(monthKey, current);
  }

  const points = Array.from(byMonth.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([, value]) => value);

  return {
    title: "Collection Trend",
    subtitle: "Vehicles and collection amount by month across the selected range.",
    points,
  };
}

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

function buildAmountTrendSvg(points: TimeframeChartPoint[]) {
  if (points.length === 0) {
    return '<p class="graph-empty">No timeframe trend data available.</p>';
  }

  const width = 860;
  const height = 220;
  const paddingLeft = 52;
  const paddingRight = 18;
  const paddingTop = 18;
  const paddingBottom = 42;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const baseY = paddingTop + chartHeight;
  const maxAmount = Math.max(
    1,
    ...points.map((point) => Number(point.amount || 0))
  );

  const pointsWithCoords = points.map((point, index) => {
    const x =
      points.length === 1
        ? paddingLeft + chartWidth / 2
        : paddingLeft + (index / (points.length - 1)) * chartWidth;
    const y =
      baseY - (Number(point.amount || 0) / maxAmount) * chartHeight;

    return {
      ...point,
      x,
      y,
    };
  });

  const linePath = pointsWithCoords
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  const firstPoint = pointsWithCoords[0];
  const lastPoint = pointsWithCoords[pointsWithCoords.length - 1];
  const areaPath = `${linePath} L ${lastPoint.x.toFixed(2)} ${baseY.toFixed(2)} L ${firstPoint.x.toFixed(2)} ${baseY.toFixed(2)} Z`;

  const gridLines = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const y = paddingTop + chartHeight * ratio;
    const amount = maxAmount * (1 - ratio);

    return `
      <line x1="${paddingLeft}" y1="${y.toFixed(2)}" x2="${(width - paddingRight).toFixed(2)}" y2="${y.toFixed(2)}" stroke="#e2e8f0" stroke-dasharray="4 4" />
      <text x="${(paddingLeft - 8).toFixed(2)}" y="${(y + 4).toFixed(2)}" text-anchor="end" font-size="9" font-weight="700" fill="#94a3b8">${escapeHtml(toAxisCurrency(amount))}</text>
    `;
  }).join("");

  const maxVisibleLabels = 10;
  const labelStep = points.length <= maxVisibleLabels
    ? 1
    : Math.ceil(points.length / maxVisibleLabels);

  const labels = pointsWithCoords
    .map((point, index) => {
      if (index % labelStep !== 0 && index !== pointsWithCoords.length - 1) {
        return "";
      }

      return `<text x="${point.x.toFixed(2)}" y="${(height - 14).toFixed(2)}" text-anchor="middle" font-size="9" font-weight="700" fill="#94a3b8">${escapeHtml(point.label)}</text>`;
    })
    .join("");

  const dots = pointsWithCoords
    .map(
      (point) =>
        `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="2.8" fill="#1E7F5C" stroke="#ffffff" stroke-width="1.5" />`
    )
    .join("");

  return `
    <svg class="trend-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Timeframe amount trend">
      ${gridLines}
      <path d="${areaPath}" fill="#1E7F5C" opacity="0.14" />
      <path d="${linePath}" fill="none" stroke="#1E7F5C" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      ${dots}
      ${labels}
    </svg>
  `;
}

function buildVehicleDistributionGraphMarkup(stats: TransactionStats) {
  if (stats.vehicleBreakdown.length === 0) {
    return '<p class="graph-empty">No vehicle distribution data available.</p>';
  }

  const maxCount = Math.max(
    1,
    ...stats.vehicleBreakdown.map((item) => Number(item.count || 0))
  );
  const colors = ["#1E7F5C", "#F4B740", "#3B82F6", "#0EA5E9", "#8B5CF6"];

  const rows = stats.vehicleBreakdown
    .map((item, index) => {
      const count = Number(item.count || 0);
      const normalizedWidth = (count / maxCount) * 100;
      const share = stats.totalVehicles > 0 ? (count / stats.totalVehicles) * 100 : 0;
      const color = colors[index % colors.length];

      return `
        <div class="dist-row">
          <div class="dist-label">${escapeHtml(item.type)}</div>
          <div class="dist-track">
            <span class="dist-fill" style="width:${normalizedWidth.toFixed(2)}%; background:${color};"></span>
          </div>
          <div class="dist-meta">${escapeHtml(count)} (${escapeHtml(share.toFixed(1))}%)</div>
        </div>
      `;
    })
    .join("");

  return `<div class="dist-list">${rows}</div>`;
}

function buildPdfDocument(
  transactions: Transaction[],
  filters: {
    search?: string;
    id?: string;
    type?: string;
    scopeLabel: string;
    scope: DateScope;
  },
  stats: TransactionStats
) {
  const timeframeSeries = buildTimeframeChartSeries(transactions, filters.scope);
  const timeframeTrendGraph = buildAmountTrendSvg(timeframeSeries.points);
  const vehicleDistributionGraph = buildVehicleDistributionGraphMarkup(stats);

  const filterSummary = [
    `Report scope: ${filters.scopeLabel}`,
    filters.type ? `Vehicle filter: ${filters.type}` : null,
    filters.search ? `Transaction search: ${filters.search}` : null,
    filters.id ? `ID search: ${filters.id}` : null,
    `Status: Success`,
  ]
    .filter(Boolean)
    .join(" | ");

  const coverageLabel =
    stats.firstTimestamp && stats.lastTimestamp
      ? `${formatDate(stats.firstTimestamp)} ${formatTime(stats.firstTimestamp)} - ${formatDate(stats.lastTimestamp)} ${formatTime(stats.lastTimestamp)}`
      : "No timestamp coverage available";

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

      h2 {
        margin: 24px 0 8px;
        font-size: 16px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #334155;
      }

      p {
        margin: 0 0 8px;
        color: #475569;
      }

      .page {
        page-break-after: always;
      }

      .page:last-child {
        page-break-after: auto;
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        margin-top: 20px;
      }

      .stat-card {
        border: 1px solid #cbd5e1;
        padding: 12px;
        background: #f8fafc;
      }

      .stat-card .label {
        color: #64748b;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .stat-card .value {
        margin-top: 6px;
        color: #0f172a;
        font-size: 20px;
        font-weight: 800;
      }

      .summary-line {
        margin-top: 10px;
        font-size: 12px;
      }

      .graph-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        margin-top: 16px;
      }

      .graph-card {
        border: 1px solid #cbd5e1;
        padding: 12px;
        background: #ffffff;
      }

      .graph-card h3 {
        margin: 0;
        font-size: 11px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #475569;
      }

      .graph-subtitle {
        margin: 4px 0 10px;
        font-size: 11px;
        color: #64748b;
      }

      .graph-empty {
        margin: 14px 0;
        color: #94a3b8;
        font-size: 11px;
        font-weight: 700;
      }

      .trend-svg {
        width: 100%;
        height: 190px;
        display: block;
      }

      .dist-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 4px;
      }

      .dist-row {
        display: grid;
        grid-template-columns: 86px 1fr auto;
        align-items: center;
        gap: 8px;
      }

      .dist-label {
        color: #334155;
        font-size: 11px;
        font-weight: 700;
      }

      .dist-track {
        height: 10px;
        background: #e2e8f0;
      }

      .dist-fill {
        display: block;
        height: 100%;
      }

      .dist-meta {
        color: #475569;
        font-size: 10px;
        font-weight: 700;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }

      .transactions-table {
        margin-top: 24px;
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

        .page {
          break-after: page;
          page-break-after: always;
        }

        .page:last-child {
          break-after: auto;
          page-break-after: auto;
        }
      }
    </style>
  </head>
  <body>
    <section class="page">
      <h1>Transactions Summary</h1>
      <p>Generated: ${escapeHtml(new Date().toLocaleString())}</p>
      <p>${escapeHtml(filterSummary)}</p>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="label">Total Vehicles</div>
          <div class="value">${escapeHtml(stats.totalVehicles)}</div>
        </div>
        <div class="stat-card">
          <div class="label">Total Net Collected</div>
          <div class="value">${escapeHtml(formatCurrency(stats.totalNet))}</div>
        </div>
        <div class="stat-card">
          <div class="label">Average Per Vehicle</div>
          <div class="value">${escapeHtml(formatCurrency(stats.averageAmount))}</div>
        </div>
        <div class="stat-card">
          <div class="label">Vehicle Types</div>
          <div class="value">${escapeHtml(stats.vehicleBreakdown.length)}</div>
        </div>
      </div>

      <p class="summary-line"><strong>Date Coverage:</strong> ${escapeHtml(coverageLabel)}</p>

      <div class="graph-grid">
        <section class="graph-card">
          <h3>${escapeHtml(timeframeSeries.title)}</h3>
          <p class="graph-subtitle">${escapeHtml(timeframeSeries.subtitle)}</p>
          ${timeframeTrendGraph}
        </section>
        <section class="graph-card">
          <h3>Vehicle Distribution</h3>
          <p class="graph-subtitle">Vehicle share based on the selected timeframe filters.</p>
          ${vehicleDistributionGraph}
        </section>
      </div>
    </section>

    <section class="page">
      <h1>Successful Transactions</h1>
      <p><strong>Total Collected: ${escapeHtml(formatCurrency(stats.totalNet))}</strong></p>
      <table class="transactions-table">
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
    </section>
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
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState("all");
  const [dateScope, setDateScope] = useState<DateScope>("overall");
  const [dayValue, setDayValue] = useState(getTodayDateValue);
  const [monthValue, setMonthValue] = useState(getMonthValue);
  const [yearValue, setYearValue] = useState(getYearValue);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [stats, setStats] = useState<TransactionStats | null>(null);
  const [statsTransactions, setStatsTransactions] = useState<Transaction[]>([]);
  const [statsError, setStatsError] = useState<string | null>(null);
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
  const vehicleTypeOptions = useMemo(() => {
    const orderedTypes = [...DEFAULT_VEHICLE_TYPES];
    const seenTypes = new Set(orderedTypes.map((vehicleType) => vehicleType.toLowerCase()));

    for (const vehicle of db.vehicles) {
      const normalizedType = normalizeVehicleType(vehicle.type);
      const key = normalizedType.toLowerCase();

      if (!seenTypes.has(key)) {
        seenTypes.add(key);
        orderedTypes.push(normalizedType);
      }
    }

    return orderedTypes;
  }, [db.vehicles]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, idQuery, vehicleTypeFilter, dateScope, dayValue, monthValue, yearValue]);

  const activeFilters = useMemo<TransactionQueryFilters>(
    () => ({
      status: "Success",
      search: deferredSearchQuery || undefined,
      id: deferredIdQuery || undefined,
      type: vehicleTypeFilter !== "all" ? vehicleTypeFilter : undefined,
      dateFrom: dateRange.dateFrom,
      dateTo: dateRange.dateTo,
    }),
    [dateRange.dateFrom, dateRange.dateTo, deferredIdQuery, deferredSearchQuery, vehicleTypeFilter]
  );

  const activeScopeLabel = dateRange.label;
  const activeVehicleTypeLabel =
    vehicleTypeFilter === "all" ? "All vehicle types" : vehicleTypeFilter;
  const timeframeSeries = useMemo(
    () => buildTimeframeChartSeries(statsTransactions, dateScope),
    [statsTransactions, dateScope]
  );

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

  useEffect(() => {
    if (!isStatsOpen) {
      return;
    }

    let isCancelled = false;

    async function loadStats() {
      setIsStatsLoading(true);
      setStatsError(null);

      try {
        const matchingTransactions = await apiClient.getAllTransactions(activeFilters);

        if (isCancelled) {
          return;
        }

        setStats(calculateTransactionStats(matchingTransactions));
        setStatsTransactions(matchingTransactions);
      } catch (loadStatsError) {
        if (isCancelled) {
          return;
        }

        setStats(null);
        setStatsTransactions([]);
        setStatsError(
          loadStatsError instanceof Error
            ? loadStatsError.message
            : "Failed to load transaction stats."
        );
      } finally {
        if (!isCancelled) {
          setIsStatsLoading(false);
        }
      }
    }

    loadStats();

    return () => {
      isCancelled = true;
    };
  }, [activeFilters, isStatsOpen, refreshToken]);

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

      const exportStats = calculateTransactionStats(exportedTransactions);

      printWindow.document.open();
      printWindow.document.write(
        buildPdfDocument(
          exportedTransactions,
          {
            search: activeFilters.search,
            id: activeFilters.id,
            type: activeVehicleTypeLabel,
            scopeLabel: activeScopeLabel,
            scope: dateScope,
          },
          exportStats
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
          <select
            value={vehicleTypeFilter}
            onChange={(event) => setVehicleTypeFilter(event.target.value)}
            className="bg-slate-50 border border-slate-200 py-3 px-4 focus:ring-2 focus:ring-[#1E7F5C]/10 outline-none font-bold text-sm text-slate-600"
          >
            <option value="all">All Vehicles</option>
            {vehicleTypeOptions.map((vehicleType) => (
              <option key={vehicleType} value={vehicleType}>
                {vehicleType}
              </option>
            ))}
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
        <div className="px-8 py-4 border-b border-slate-100 grid gap-2 md:grid-cols-[auto_1fr_auto] md:items-center text-xs font-bold uppercase tracking-widest text-slate-400">
          <span>{totalLabel}</span>
          <span className="md:text-right">
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
            {` | Vehicle: ${activeVehicleTypeLabel}`}
          </span>
          <button
            type="button"
            onClick={() => setIsStatsOpen((open) => !open)}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 border border-slate-200 bg-white text-slate-600 hover:text-[#1E7F5C] hover:border-[#1E7F5C] transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            {isStatsOpen ? "Hide Stats" : "Show Stats"}
            {isStatsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {isStatsOpen ? (
          <div className="px-8 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-3">
            {isStatsLoading ? (
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Loading stats...
              </p>
            ) : statsError ? (
              <p className="text-xs font-bold uppercase tracking-widest text-red-400">
                {statsError}
              </p>
            ) : stats ? (
              <>
                <p className="text-sm font-black text-slate-700 tracking-wide">
                  {`Total Vehicle: ${stats.totalVehicles}`}
                  {stats.vehicleBreakdown.length > 0
                    ? ` | ${stats.vehicleBreakdown
                        .map((vehicle) => `${vehicle.type}: ${vehicle.count}`)
                        .join(" | ")}`
                    : ""}
                </p>
                <div className="border border-slate-200 bg-white px-4 py-4">
                  <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2 mb-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        {timeframeSeries.title}
                      </p>
                      <p className="text-sm font-bold text-slate-700 mt-1">
                        {timeframeSeries.subtitle}
                      </p>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      {timeframeSeries.points.length} points
                    </p>
                  </div>

                  {timeframeSeries.points.length > 0 ? (
                    <div className="h-60 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={timeframeSeries.points}>
                          <defs>
                            <linearGradient id="transactionsAmountGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#1E7F5C" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#1E7F5C" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="transactionsVehiclesGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#F4B740" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#F4B740" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis
                            dataKey="label"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#94a3b8", fontWeight: 700, fontSize: 11 }}
                            minTickGap={20}
                          />
                          <YAxis
                            yAxisId="left"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#94a3b8", fontWeight: 600, fontSize: 10 }}
                            tickFormatter={toAxisCurrency}
                          />
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#94a3b8", fontWeight: 600, fontSize: 10 }}
                            allowDecimals={false}
                          />
                          <Tooltip content={<TimeframeTooltip />} />
                          <Area
                            yAxisId="left"
                            type="monotone"
                            dataKey="amount"
                            stroke="#1E7F5C"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#transactionsAmountGradient)"
                            dot={{ r: 3, fill: "#1E7F5C", strokeWidth: 2, stroke: "#fff" }}
                          />
                          <Area
                            yAxisId="right"
                            type="monotone"
                            dataKey="vehicles"
                            stroke="#F4B740"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#transactionsVehiclesGradient)"
                            dot={{ r: 3, fill: "#F4B740", strokeWidth: 2, stroke: "#fff" }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400 py-8 text-center">
                      No trend points available for this timeframe.
                    </p>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Total Net
                    </p>
                    <p className="text-lg font-black text-slate-800 mt-1">
                      {formatCurrency(stats.totalNet)}
                    </p>
                  </div>
                  <div className="border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Average / Vehicle
                    </p>
                    <p className="text-lg font-black text-slate-800 mt-1">
                      {formatCurrency(stats.averageAmount)}
                    </p>
                  </div>
                  <div className="border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Vehicle Types
                    </p>
                    <p className="text-lg font-black text-slate-800 mt-1">
                      {stats.vehicleBreakdown.length}
                    </p>
                  </div>
                  <div className="border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Date Coverage
                    </p>
                    <p className="text-[11px] font-bold text-slate-600 mt-1 leading-relaxed">
                      {stats.firstTimestamp && stats.lastTimestamp
                        ? `${formatDate(stats.firstTimestamp)} ${formatTime(stats.firstTimestamp)} - ${formatDate(stats.lastTimestamp)} ${formatTime(stats.lastTimestamp)}`
                        : "No timestamp coverage"}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                No stats available for the current filters.
              </p>
            )}
          </div>
        ) : null}

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

function TimeframeTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const amount = Number(payload.find((item) => item.dataKey === "amount")?.value || 0);
  const vehicles = Number(payload.find((item) => item.dataKey === "vehicles")?.value || 0);

  return (
    <div className="border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="text-xs font-bold text-slate-700 mt-1">{`Amount: ${formatCurrency(amount)}`}</p>
      <p className="text-xs font-bold text-slate-700">{`Vehicles: ${vehicles}`}</p>
    </div>
  );
}

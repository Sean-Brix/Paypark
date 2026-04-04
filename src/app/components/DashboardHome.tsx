import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { 
  Car, Bike, Zap, ArrowUpRight, ArrowDownRight, 
  Clock, ParkingCircle, Coins, ChevronDown,
  Sun, Sunrise, Sunset
} from "lucide-react";
import { apiClient, type TransactionQueryFilters } from "../api/client";
import type { Transaction } from "../api/types";

type TimeFilter = "hourly" | "daily" | "weekly" | "monthly";
type AnalyticsScope = "overall" | "day";

const VEHICLE_COLORS: Record<string, string> = {
  Car: "#1E7F5C",
  Motorcycle: "#F4B740",
  "E-Bike": "#6366f1",
};

const VEHICLE_ICONS: Record<string, React.ElementType> = {
  Car,
  Motorcycle: Bike,
  "E-Bike": Zap,
};

const FILTER_LABELS: Record<TimeFilter, string> = {
  hourly: "Hourly",
  daily: "Daily (7 Days)",
  weekly: "Weekly (4 Weeks)",
  monthly: "Monthly (5 Months)",
};

const FILTER_SUBTITLES: Record<TimeFilter, string> = {
  hourly: "Check-ins by Time of Day",
  daily: "Check-ins Over the Last 7 Days",
  weekly: "Check-ins Over the Last 4 Weeks",
  monthly: "Check-ins Over the Last 5 Months",
};

function getTodayDateValue() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

export function DashboardHome() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("monthly");
  const [analyticsScope, setAnalyticsScope] = useState<AnalyticsScope>("overall");
  const [analyticsDate, setAnalyticsDate] = useState(getTodayDateValue);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function loadAnalyticsTransactions() {
      setIsLoadingAnalytics(true);
      setAnalyticsError(null);

      try {
        const filters: TransactionQueryFilters = {
          status: "Success",
        };

        if (analyticsScope === "day") {
          filters.dateFrom = analyticsDate;
          filters.dateTo = analyticsDate;
        }

        const allTransactions = await apiClient.getAllTransactions(filters);
        if (!isCancelled) {
          setTransactions(allTransactions);
        }
      } catch (error) {
        if (!isCancelled) {
          setTransactions([]);
          setAnalyticsError(
            error instanceof Error ? error.message : "Failed to load analytics data."
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingAnalytics(false);
        }
      }
    }

    loadAnalyticsTransactions();

    return () => {
      isCancelled = true;
    };
  }, [analyticsDate, analyticsScope]);

  const totalRevenue = useMemo(
    () => transactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0),
    [transactions]
  );

  // ── Computed insights from the transaction database ──────────────

  const insights = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const focusDateStr = analyticsScope === "day" ? analyticsDate : todayStr;

    // Focus date transactions
    const todayTx = transactions.filter(t => t.timestamp.slice(0, 10) === focusDateStr);
    const todayCount = todayTx.length;
    const todayAmount = todayTx.reduce((s, t) => s + t.amount, 0);

    // Yesterday comparison
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const yesterdayTx = transactions.filter(t => t.timestamp.slice(0, 10) === yesterdayStr);
    const yesterdayCount = yesterdayTx.length;

    const countChange = analyticsScope === "day"
      ? "0"
      : yesterdayCount > 0
        ? (((todayCount - yesterdayCount) / yesterdayCount) * 100).toFixed(1)
        : todayCount > 0 ? "+100" : "0";

    // ── Hourly distribution (all transactions) ──
    const hourBuckets: Record<string, { Car: number; Motorcycle: number; "E-Bike": number }> = {};
    const hourLabels = [
      "6-8 AM", "8-10 AM", "10-12 PM", "12-2 PM", "2-4 PM", "4-6 PM", "6-8 PM", "8-10 PM"
    ];
    hourLabels.forEach(l => { hourBuckets[l] = { Car: 0, Motorcycle: 0, "E-Bike": 0 }; });

    transactions.forEach(tx => {
      const h = new Date(tx.timestamp).getHours();
      let label = "";
      if (h >= 6 && h < 8) label = "6-8 AM";
      else if (h >= 8 && h < 10) label = "8-10 AM";
      else if (h >= 10 && h < 12) label = "10-12 PM";
      else if (h >= 12 && h < 14) label = "12-2 PM";
      else if (h >= 14 && h < 16) label = "2-4 PM";
      else if (h >= 16 && h < 18) label = "4-6 PM";
      else if (h >= 18 && h < 20) label = "6-8 PM";
      else if (h >= 20 && h < 22) label = "8-10 PM";
      if (label && hourBuckets[label]) {
        const type = tx.type as "Car" | "Motorcycle" | "E-Bike";
        if (hourBuckets[label][type] !== undefined) hourBuckets[label][type]++;
      }
    });

    const hourlyData = hourLabels.map(name => ({
      name,
      Car: hourBuckets[name].Car,
      Motorcycle: hourBuckets[name].Motorcycle,
      "E-Bike": hourBuckets[name]["E-Bike"],
      total: hourBuckets[name].Car + hourBuckets[name].Motorcycle + hourBuckets[name]["E-Bike"],
    }));

    // Peak hour
    const peakHour = hourlyData.reduce((max, cur) => cur.total > max.total ? cur : max, hourlyData[0]);

    // ── Daily distribution (last 7 days) ──
    const dailyData: { name: string; Car: number; Motorcycle: number; "E-Bike": number; total: number }[] = [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().slice(0, 10);
      const dayTx = transactions.filter(t => t.timestamp.slice(0, 10) === dStr);
      const dayLabel = `${dayNames[d.getDay()]} ${d.getDate()}`;
      dailyData.push({
        name: dayLabel,
        Car: dayTx.filter(t => t.type === "Car").length,
        Motorcycle: dayTx.filter(t => t.type === "Motorcycle").length,
        "E-Bike": dayTx.filter(t => t.type === "E-Bike").length,
        total: dayTx.length,
      });
    }

    // ── Weekly distribution (last 4 weeks) ──
    const weeklyData: { name: string; Car: number; Motorcycle: number; "E-Bike": number; total: number }[] = [];
    const monthAbbr = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const ordinal = (n: number) => n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
    const weekOfMonth = (d: Date) => Math.ceil(d.getDate() / 7);

    for (let w = 3; w >= 0; w--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - (w * 7));
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);

      const startStr = weekStart.toISOString().slice(0, 10);
      const endStr = weekEnd.toISOString().slice(0, 10);
      const weekTx = transactions.filter(t => {
        const tDate = t.timestamp.slice(0, 10);
        return tDate >= startStr && tDate <= endStr;
      });

      const startMon = monthAbbr[weekStart.getMonth()];
      const endMon = monthAbbr[weekEnd.getMonth()];
      const startWk = ordinal(weekOfMonth(weekStart));
      const endWk = ordinal(weekOfMonth(weekEnd));

      let label: string;
      if (startMon === endMon) {
        label = `${startMon}|${startWk} – ${endWk}`;
      } else {
        label = `${startMon} – ${endMon}|${startWk} – ${endWk}`;
      }

      weeklyData.push({
        name: label,
        Car: weekTx.filter(t => t.type === "Car").length,
        Motorcycle: weekTx.filter(t => t.type === "Motorcycle").length,
        "E-Bike": weekTx.filter(t => t.type === "E-Bike").length,
        total: weekTx.length,
      });
    }

    // ── Monthly trend (last 5 months) ──
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyMap: Record<string, { Car: number; Motorcycle: number; "E-Bike": number; amount: number }> = {};
    const monthKeys: string[] = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
      monthKeys.push(key);
      monthlyMap[key] = { Car: 0, Motorcycle: 0, "E-Bike": 0, amount: 0 };
    }

    transactions.forEach(tx => {
      const key = tx.timestamp.slice(0, 7);
      if (monthlyMap[key]) {
        const type = tx.type as "Car" | "Motorcycle" | "E-Bike";
        if (monthlyMap[key][type] !== undefined) monthlyMap[key][type]++;
        monthlyMap[key].amount += tx.amount;
      }
    });

    const monthlyData = monthKeys.map(key => {
      const [, m] = key.split("-");
      const d = monthlyMap[key];
      return {
        name: `${monthNames[parseInt(m) - 1]} ${key.slice(0, 4)}`,
        Car: d.Car,
        Motorcycle: d.Motorcycle,
        "E-Bike": d["E-Bike"],
        total: d.Car + d.Motorcycle + d["E-Bike"],
        amount: d.amount,
      };
    });

    // ── Amount Collected trend (last 5 months for bottom chart) ──
    const amountTrendData = monthKeys.map(key => {
      const [, m] = key.split("-");
      const d = monthlyMap[key];
      return {
        name: `${monthNames[parseInt(m) - 1]} ${key.slice(0, 4)}`,
        amount: d.amount,
        vehicles: d.Car + d.Motorcycle + d["E-Bike"],
      };
    });

    // Vehicle type totals
    const carCount = transactions.filter(t => t.type === "Car").length;
    const motoCount = transactions.filter(t => t.type === "Motorcycle").length;
    const ebikeCount = transactions.filter(t => t.type === "E-Bike").length;
    const mostCommonType = carCount >= motoCount && carCount >= ebikeCount ? "Car"
      : motoCount >= ebikeCount ? "Motorcycle" : "E-Bike";

    // Time-of-day breakdown
    const morningTx = transactions.filter(t => { const h = new Date(t.timestamp).getHours(); return h >= 6 && h < 12; });
    const afternoonTx = transactions.filter(t => { const h = new Date(t.timestamp).getHours(); return h >= 12 && h < 18; });
    const eveningTx = transactions.filter(t => { const h = new Date(t.timestamp).getHours(); return h >= 18 && h < 22; });

    // Average vehicles per active day
    const uniqueDays = new Set(transactions.map(t => t.timestamp.slice(0, 10)));
    const avgPerDay = uniqueDays.size > 0 ? (transactions.length / uniqueDays.size).toFixed(1) : "0";

    return {
      todayCount,
      todayAmount,
      countChange,
      hourlyData,
      dailyData,
      weeklyData,
      monthlyData,
      amountTrendData,
      peakHour,
      carCount,
      motoCount,
      ebikeCount,
      mostCommonType,
      morningCount: morningTx.length,
      afternoonCount: afternoonTx.length,
      eveningCount: eveningTx.length,
      avgPerDay,
      uniqueDaysCount: uniqueDays.size,
    };
  }, [analyticsDate, analyticsScope, transactions]);

  // ── Get active chart data based on filter ──
  const activeChartData = useMemo(() => {
    switch (timeFilter) {
      case "hourly": return insights.hourlyData;
      case "daily": return insights.dailyData;
      case "weekly": return insights.weeklyData;
      case "monthly": return insights.monthlyData;
    }
  }, [timeFilter, insights]);

  return (
    <div className="flex flex-col h-full">
      {/* ── Top Stats ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border-b border-slate-200 divide-y md:divide-y-0 md:divide-x divide-slate-200 bg-white">
        <StatCard 
          label={analyticsScope === "day" ? "Vehicles (Selected Day)" : "Vehicles Today"}
          value={insights.todayCount.toString()} 
          trend={analyticsScope === "day" ? analyticsDate : `${Number(insights.countChange) >= 0 ? "+" : ""}${insights.countChange}%`}
          trendUp={analyticsScope === "day" ? true : Number(insights.countChange) >= 0}
          neutral={analyticsScope === "day"}
          icon={<ParkingCircle className="w-5 h-5" />}
          color="#1E7F5C"
        />
        <StatCard 
          label={analyticsScope === "day" ? "Amount (Selected Day)" : "Amount Collected"}
          value={`₱${totalRevenue.toLocaleString()}`} 
          trend={analyticsScope === "day" ? analyticsDate : "Overall"}
          neutral
          icon={<Coins className="w-5 h-5" />}
          color="#F4B740"
        />
        <StatCard 
          label="Peak Hours" 
          value={insights.peakHour.name} 
          trend={`${insights.peakHour.total} vehicles`}
          neutral
          icon={<Clock className="w-5 h-5" />}
          color="#6366f1"
        />
        <StatCard 
          label="Most Common" 
          value={insights.mostCommonType} 
          trend={`${insights.mostCommonType === "Car" ? insights.carCount : insights.mostCommonType === "Motorcycle" ? insights.motoCount : insights.ebikeCount} total`}
          neutral
          icon={React.createElement(VEHICLE_ICONS[insights.mostCommonType], { className: "w-5 h-5" })}
          color="#0f172a"
        />
      </div>

      {isLoadingAnalytics ? (
        <div className="border-b border-slate-200 bg-white px-8 py-3 text-xs font-bold uppercase tracking-widest text-slate-400">
          Loading analytics data...
        </div>
      ) : null}

      {analyticsError ? (
        <div className="border-b border-red-100 bg-red-50 px-8 py-3 text-xs font-bold uppercase tracking-widest text-red-500">
          {analyticsError}
        </div>
      ) : null}

      {/* ── Row 1 : Unified Chart + Vehicle Breakdown ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 border-b border-slate-200">
        {/* Unified Chart with Dropdown */}
        <div className="lg:col-span-2 bg-white p-8 lg:p-10 relative overflow-hidden">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-[0.1em] mb-1">Parking Activity</h3>
              <p className="text-2xl font-bold text-slate-800 tracking-tight">{FILTER_SUBTITLES[timeFilter]}</p>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={analyticsScope}
                onChange={(event) => setAnalyticsScope(event.target.value as AnalyticsScope)}
                className="px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors text-xs font-bold text-slate-600 uppercase tracking-wider"
              >
                <option value="overall">Overall</option>
                <option value="day">Specific Day</option>
              </select>
              {analyticsScope === "day" ? (
                <input
                  type="date"
                  value={analyticsDate}
                  onChange={(event) => setAnalyticsDate(event.target.value)}
                  className="px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors text-xs font-bold text-slate-600"
                />
              ) : null}
              
              {/* Filter Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors text-xs font-bold text-slate-600 uppercase tracking-wider"
                >
                  {FILTER_LABELS[timeFilter]}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
                </button>
                {dropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 shadow-lg min-w-[180px]">
                      {(["hourly", "daily", "weekly", "monthly"] as TimeFilter[]).map(f => (
                        <button
                          key={f}
                          onClick={() => { setTimeFilter(f); setDropdownOpen(false); }}
                          className={`w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                            timeFilter === f
                              ? "bg-[#1E7F5C]/10 text-[#1E7F5C]"
                              : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                          }`}
                        >
                          {FILTER_LABELS[f]}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activeChartData} barCategoryGap={timeFilter === "weekly" ? "15%" : "20%"}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={timeFilter === "weekly" ? <WeeklyTick /> : { fill: "#94a3b8", fontWeight: 700, fontSize: 10 }}
                  dy={10}
                  interval={0}
                  height={timeFilter === "weekly" ? 50 : 30}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "#94a3b8", fontWeight: 600, fontSize: 10 }}
                  allowDecimals={false}
                />
                <Tooltip content={<StackedTooltip />} />
                <Bar dataKey="Car" stackId="a" fill="#1E7F5C" />
                <Bar dataKey="Motorcycle" stackId="a" fill="#F4B740" />
                <Bar dataKey="E-Bike" stackId="a" fill="#6366f1" />
              </BarChart>

              {/* Vehicle legend */}
              <div className="hidden mt-8 md:flex items-center gap-4">
                {(["Car", "Motorcycle", "E-Bike"] as const).map(type => (
                  <div key={type} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5" style={{ backgroundColor: VEHICLE_COLORS[type] }} />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{type}</span>
                  </div>
                ))}
              </div>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Vehicle Type Breakdown */}
        <div className="bg-white p-8 lg:p-10 flex flex-col">
          <div className="mb-8">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-[0.1em] mb-1">Vehicle Distribution</h3>
            <p className="text-2xl font-bold text-slate-800 tracking-tight">By Type</p>
          </div>

          <div className="space-y-6 flex-1">
            <VehicleBar 
              icon={<Car className="w-5 h-5" />} 
              label="Cars" 
              count={insights.carCount} 
              total={transactions.length}
              color="#1E7F5C"
            />
            <VehicleBar 
              icon={<Bike className="w-5 h-5" />} 
              label="Motorcycles" 
              count={insights.motoCount} 
              total={transactions.length}
              color="#F4B740"
            />
            <VehicleBar 
              icon={<Zap className="w-5 h-5" />} 
              label="E-Bikes" 
              count={insights.ebikeCount} 
              total={transactions.length}
              color="#6366f1"
            />
          </div>

          {/* Time of Day Summary */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Activity by Period</p>
            <div className="grid grid-cols-3 gap-3">
              <PeriodBadge icon={<Sunrise className="w-4 h-4" />} label="Morning" count={insights.morningCount} color="#F4B740" />
              <PeriodBadge icon={<Sun className="w-4 h-4" />} label="Afternoon" count={insights.afternoonCount} color="#1E7F5C" />
              <PeriodBadge icon={<Sunset className="w-4 h-4" />} label="Evening" count={insights.eveningCount} color="#6366f1" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 2 : Amount Collected Trend + Quick Insights ───────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 flex-1">
        {/* Amount Collected Trend (Area Chart) */}
        <div className="lg:col-span-2 bg-white p-8 lg:p-10 relative overflow-hidden">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-[0.1em] mb-1">Collection Trend</h3>
              <p className="text-2xl font-bold text-slate-800 tracking-tight">Amount Collected by Month</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-[#1E7F5C]" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount (₱)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-[#F4B740]" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vehicles</span>
              </div>
            </div>
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={insights.amountTrendData}>
                <defs>
                  <linearGradient id="gradAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1E7F5C" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#1E7F5C" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gradVehicles" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F4B740" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#F4B740" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "#94a3b8", fontWeight: 700, fontSize: 11 }}
                  dy={10}
                />
                <YAxis 
                  yAxisId="left"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "#94a3b8", fontWeight: 600, fontSize: 10 }}
                  tickFormatter={(v: number) => `₱${v}`}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "#94a3b8", fontWeight: 600, fontSize: 10 }}
                  allowDecimals={false}
                />
                <Tooltip content={<AmountTooltip />} />
                <Area 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#1E7F5C" 
                  strokeWidth={2.5}
                  fillOpacity={1} 
                  fill="url(#gradAmount)" 
                  dot={{ r: 4, fill: "#1E7F5C", strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 6, fill: "#1E7F5C", strokeWidth: 3, stroke: "#fff" }}
                />
                <Area 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="vehicles" 
                  stroke="#F4B740" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#gradVehicles)" 
                  dot={{ r: 3, fill: "#F4B740", strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 5, fill: "#F4B740", strokeWidth: 3, stroke: "#fff" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Insights Panel */}
        <div className="bg-white p-8 lg:p-10 flex flex-col">
          <div className="mb-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-[0.1em] mb-1">Quick Insights</h3>
            <p className="text-2xl font-bold text-slate-800 tracking-tight">Summary</p>
          </div>

          <div className="space-y-4 flex-1">
            <InsightRow 
              label="Total Vehicles Served" 
              value={transactions.length.toString()}
              sub={analyticsScope === "day" ? "Selected day" : "Overall"}
            />
            <InsightRow 
              label={analyticsScope === "day" ? "Selected Day Amount" : "Today's Amount Collected"}
              value={`₱${insights.todayAmount.toLocaleString()}`}
              sub={analyticsScope === "day" ? analyticsDate : "Current day"}
            />
            <InsightRow 
              label="Active Parking Days" 
              value={insights.uniqueDaysCount.toString()}
              sub="Days with check-ins"
            />
            <InsightRow 
              label="Avg Vehicles / Day" 
              value={insights.avgPerDay}
              sub="Across active days"
            />
          </div>

          <div className="mt-6 p-5 bg-[#1E7F5C]/5 border border-[#1E7F5C]/10">
            <p className="text-[10px] font-bold text-[#1E7F5C] uppercase tracking-[0.2em] mb-2">Observation</p>
            <p className="text-xs font-medium text-slate-600 leading-relaxed">
              {insights.peakHour.name} shows the highest traffic. Consider additional signage or staffing during this window.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function StatCard({ label, value, trend, trendUp, neutral, icon, color }: any) {
  return (
    <motion.div className="bg-white p-8 relative overflow-hidden group hover:bg-slate-50/50 transition-colors">
      <div className="flex justify-between items-start mb-6">
        <div 
          className="w-12 h-12 flex items-center justify-center border border-slate-100"
          style={{ backgroundColor: `${color}10`, color }}
        >
          {icon}
        </div>
        <div className={`flex items-center gap-1 px-3 py-1 text-[10px] font-bold tracking-wider ${
          neutral ? 'bg-slate-100 text-slate-500' :
          trendUp ? 'bg-[#1E7F5C]/10 text-[#1E7F5C]' : 'bg-red-50 text-red-500'
        }`}>
          {!neutral && (trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />)}
          {trend}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] mb-1">{label}</p>
        <p className="text-3xl font-bold text-slate-800 tracking-tight">{value}</p>
      </div>
    </motion.div>
  );
}

function VehicleBar({ icon, label, count, total, color }: any) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="group">
      <div className="flex justify-between items-end mb-3 px-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center" style={{ backgroundColor: `${color}10`, color }}>
            {icon}
          </div>
          <div>
            <span className="block font-bold text-slate-800 text-sm uppercase tracking-tight leading-none mb-1">{label}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{pct.toFixed(0)}% share</span>
          </div>
        </div>
        <span className="font-bold text-slate-800 text-xl">{count}</span>
      </div>
      <div className="h-3 w-full bg-slate-50 overflow-hidden border border-slate-200">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.5, ease: "circOut" }}
          className="h-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function PeriodBadge({ icon, label, count, color }: any) {
  return (
    <div className="flex flex-col items-center gap-2 p-3 bg-slate-50 border border-slate-100">
      <div className="flex items-center justify-center" style={{ color }}>
        {icon}
      </div>
      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      <span className="text-lg font-black text-slate-800">{count}</span>
    </div>
  );
}

function InsightRow({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100">
      <div>
        <p className="text-xs font-bold text-slate-600">{label}</p>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{sub}</p>
      </div>
      <p className="font-black text-slate-800 text-lg">{value}</p>
    </div>
  );
}

// ── Tooltips ────────────────────────────────────────────────────────

function StackedTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0);
    const displayLabel = typeof label === "string" ? label.replace("|", " · ") : label;
    return (
      <div className="bg-slate-900 p-4 shadow-xl border border-slate-800">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{displayLabel}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2" style={{ backgroundColor: p.fill }} />
            <span className="text-[10px] font-bold text-slate-400 uppercase">{p.dataKey}</span>
            <span className="text-xs font-black text-white ml-auto">{p.value}</span>
          </div>
        ))}
        <div className="border-t border-slate-700 mt-2 pt-2 flex justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Total</span>
          <span className="text-sm font-black text-white">{total}</span>
        </div>
      </div>
    );
  }
  return null;
}

function AmountTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 p-4 shadow-xl border border-slate-800">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{label}</p>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 bg-[#1E7F5C]" />
          <span className="text-[10px] font-bold text-slate-400 uppercase">Amount Collected</span>
          <span className="text-xs font-black text-white ml-auto">₱{payload[0]?.value?.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-[#F4B740]" />
          <span className="text-[10px] font-bold text-slate-400 uppercase">Vehicles</span>
          <span className="text-xs font-black text-white ml-auto">{payload[1]?.value}</span>
        </div>
      </div>
    );
  }
  return null;
}

// ── Custom Tick Component ──────────────────────────────────────────

function WeeklyTick({ x, y, payload }: any) {
  const parts = (payload.value as string).split("|");
  const monthLine = parts[0] || "";
  const weekLine = parts[1] || "";
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} textAnchor="middle" fill="#64748b" fontWeight={700} fontSize={10}>
        <tspan x={0} dy={14}>{monthLine}</tspan>
        <tspan x={0} dy={13} fill="#94a3b8" fontWeight={600} fontSize={9}>{weekLine}</tspan>
      </text>
    </g>
  );
}
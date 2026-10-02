import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  DollarSign,
  Package,
  Receipt,
  Percent,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  BarChart3,
  Layers,
} from "lucide-react";
import { formatCurrency } from "../utils/formatters";
import { PnLMetrics } from "../types";

interface DashboardAnalyticsSectionProps {
  onNavigateToAnalytics: () => void;
}

export const DashboardAnalyticsSection: React.FC<DashboardAnalyticsSectionProps> = ({
  onNavigateToAnalytics,
}) => {
  const [period, setPeriod] = useState<"today" | "this_week" | "7days" | "this_month" | "last_month" | "custom">("7days");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [pnl, setPnl] = useState<PnLMetrics>({
    total_sales: 0,
    cogs: 0,
    gross_profit: 0,
    expenses: 0,
    net_profit: 0,
    profit_margin: 0,
    gross_margin: 0,
    total_orders: 0,
    total_units_sold: 0,
    avg_order_value: 0,
  });

  const fetchAnalytics = async (p = period, s = startDate, e = endDate) => {
    setLoading(true);
    try {
      let url = `/api/analytics?period=${p}`;
      if (p === "custom" && s && e) {
        url += `&start_date=${encodeURIComponent(s)}&end_date=${encodeURIComponent(e)}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.success && data.pnl) {
        setPnl(data.pnl);
      }
    } catch (err) {
      console.warn("Analytics fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (period !== "custom" || (startDate && endDate)) {
      fetchAnalytics(period, startDate, endDate);
    }
  }, [period, startDate, endDate]);

  const cogsPercentage = pnl.total_sales > 0 ? Math.min(100, Math.round((pnl.cogs / pnl.total_sales) * 100)) : 0;
  const expPercentage = pnl.total_sales > 0 ? Math.min(100, Math.round((pnl.expenses / pnl.total_sales) * 100)) : 0;
  const netMargin = pnl.profit_margin;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
      {/* Header with Title & Date Filters (Requirement 5 & 6) */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                Business Analytics &amp; Profit/Loss
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                P&amp;L Live
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Real-time revenue, COGS, gross margin, operating expenses, and net profit
            </p>
          </div>
        </div>

        {/* Date Filter Bar (Requirement 1 & 6) */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 text-xs">
          {(["today", "this_week", "7days", "this_month", "last_month", "custom"] as const).map((pKey) => (
            <button
              key={pKey}
              onClick={() => setPeriod(pKey)}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                period === pKey
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              {pKey === "today" && "Today"}
              {pKey === "this_week" && "This Week"}
              {pKey === "7days" && "7 Days"}
              {pKey === "this_month" && "This Month"}
              {pKey === "last_month" && "Last Month"}
              {pKey === "custom" && "Custom"}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Inputs if custom selected */}
      {period === "custom" && (
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-2 animate-in fade-in">
          <span className="text-xs text-slate-500 font-medium">Select Date Range:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white"
          />
          <button
            onClick={() => fetchAnalytics(period, startDate, endDate)}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Apply
          </button>
        </div>
      )}

      {/* 6 Key Analytics Cards (Requirement 5) */}
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* 1. Revenue */}
          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Revenue
              </span>
              <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-lg sm:text-xl font-bold text-slate-900 font-mono tracking-tight">
                {formatCurrency(pnl.total_sales)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {pnl.total_orders} sales recorded
              </div>
            </div>
          </div>

          {/* 2. COGS */}
          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                COGS
              </span>
              <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center">
                <Package className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-lg sm:text-xl font-bold text-slate-800 font-mono tracking-tight">
                {formatCurrency(pnl.cogs)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {cogsPercentage}% of revenue
              </div>
            </div>
          </div>

          {/* 3. Gross Profit */}
          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                Gross Profit
              </span>
              <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-lg sm:text-xl font-bold text-emerald-600 font-mono tracking-tight">
                {formatCurrency(pnl.gross_profit)}
              </div>
              <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
                {pnl.gross_margin}% gross margin
              </div>
            </div>
          </div>

          {/* 4. Operating Expenses */}
          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">
                Expenses
              </span>
              <div className="w-6 h-6 rounded-md bg-rose-100 text-rose-700 flex items-center justify-center">
                <Receipt className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-lg sm:text-xl font-bold text-rose-600 font-mono tracking-tight">
                {formatCurrency(pnl.expenses)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {expPercentage}% of revenue
              </div>
            </div>
          </div>

          {/* 5. Net Profit */}
          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Net Profit
              </span>
              <div
                className={`w-6 h-6 rounded-md flex items-center justify-center ${
                  pnl.net_profit >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                }`}
              >
                {pnl.net_profit >= 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
              </div>
            </div>
            <div className="mt-2">
              <div
                className={`text-lg sm:text-xl font-bold font-mono tracking-tight ${
                  pnl.net_profit >= 0 ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {formatCurrency(pnl.net_profit)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Gross &minus; Operating
              </div>
            </div>
          </div>

          {/* 6. Profit Margin % */}
          <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-200/80 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">
                Profit Margin
              </span>
              <div className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center">
                <Percent className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-lg sm:text-xl font-bold text-blue-900 font-mono tracking-tight">
                {netMargin}%
              </div>
              <div className="text-[10px] text-blue-700 font-medium mt-0.5">
                Net return rate
              </div>
            </div>
          </div>
        </div>

        {/* Visual Revenue Breakdown Progress Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2 mb-2">
            <span className="font-semibold text-slate-700">Income Breakdown (Revenue &rarr; Net Profit):</span>
            <div className="flex items-center gap-4 text-[11px] text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>COGS ({cogsPercentage}%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span>Expenses ({expPercentage}%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Net Margin ({Math.max(0, netMargin)}%)</span>
              </div>
            </div>
          </div>

          {/* Stacked Progress Bar */}
          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${cogsPercentage}%` }}
              className="bg-amber-500 h-full transition-all duration-300"
              title={`COGS: ${formatCurrency(pnl.cogs)} (${cogsPercentage}%)`}
            />
            <div
              style={{ width: `${expPercentage}%` }}
              className="bg-rose-500 h-full transition-all duration-300"
              title={`Expenses: ${formatCurrency(pnl.expenses)} (${expPercentage}%)`}
            />
            <div
              style={{ width: `${Math.max(0, netMargin)}%` }}
              className="bg-emerald-500 h-full transition-all duration-300"
              title={`Net Profit: ${formatCurrency(pnl.net_profit)} (${netMargin}%)`}
            />
          </div>
        </div>

        {/* Footer Jump to Full Analytics */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Accurate calculations based on verified SQLite sales, procurement, and expense records</span>
          </div>

          <button
            onClick={onNavigateToAnalytics}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer group"
          >
            <span>Open Detailed Analytics &amp; Product Profitability</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};

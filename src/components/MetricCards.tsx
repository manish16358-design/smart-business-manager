import React from "react";
import {
  DollarSign,
  Receipt,
  TrendingUp,
  Package,
  AlertTriangle,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Boxes,
  AlertOctagon,
} from "lucide-react";
import { DashboardMetrics } from "../types";
import { formatCurrency } from "../utils/formatters";

interface MetricCardsProps {
  metrics: DashboardMetrics;
  onNavigateTab?: (tab: any) => void;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ metrics, onNavigateTab }) => {
  const profitMarginPercent =
    metrics.total_sales > 0
      ? Math.round((metrics.total_profit / metrics.total_sales) * 100)
      : 0;

  const totalStockItems = metrics.total_stock_items ?? 0;
  const outOfStockCount = metrics.out_of_stock_count ?? 0;
  const lowStockCount = metrics.low_stock_count ?? 0;

  return (
    <div className="space-y-4">
      {/* Today's Metrics Bar - Highlights Today's Performance */}
      <div className="bg-gradient-to-r from-blue-900 to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Today's Performance
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            Real-time daily activity (Sales &minus; Expenses = Net Profit)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3">
          {/* Today's Sales */}
          <div className="bg-white/5 hover:bg-white/10 p-3.5 rounded-xl border border-white/10 transition-colors">
            <div className="text-xs font-medium text-slate-300">Today's Sales</div>
            <div className="text-xl sm:text-2xl font-bold text-white mt-1">
              {formatCurrency(metrics.today_sales)}
            </div>
            <div className="text-[11px] text-blue-300 mt-0.5 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Current business day</span>
            </div>
          </div>

          {/* Today's Expenses */}
          <div className="bg-white/5 hover:bg-white/10 p-3.5 rounded-xl border border-white/10 transition-colors">
            <div className="text-xs font-medium text-slate-300">Today's Expenses</div>
            <div className="text-xl sm:text-2xl font-bold text-rose-300 mt-1">
              {formatCurrency(metrics.today_expenses)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
              <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
              <span>Operating outflows</span>
            </div>
          </div>

          {/* Today's Profit */}
          <div className="bg-white/5 hover:bg-white/10 p-3.5 rounded-xl border border-white/10 transition-colors">
            <div className="text-xs font-medium text-slate-300">Today's Net Profit</div>
            <div
              className={`text-xl sm:text-2xl font-bold mt-1 ${
                metrics.today_profit >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {formatCurrency(metrics.today_profit)}
            </div>
            <div className="text-[11px] text-emerald-300/80 mt-0.5">
              Net margin today
            </div>
          </div>
        </div>
      </div>

      {/* Requirement 8: 4 Dedicated Inventory & Stock Management Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Products */}
        <div
          onClick={() => onNavigateTab?.("inventory")}
          className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs hover:border-indigo-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Products
            </span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {metrics.total_products}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5 pt-1.5 border-t border-slate-100">
              <span>Catalog SKUs</span>
              <span className="text-indigo-600 font-medium group-hover:underline hidden sm:inline">Manage &rarr;</span>
            </div>
          </div>
        </div>

        {/* Card 2: Total Stock Items */}
        <div
          onClick={() => onNavigateTab?.("inventory")}
          className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs hover:border-blue-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Stock Items
            </span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {totalStockItems} <span className="text-xs font-normal text-slate-500">units</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5 pt-1.5 border-t border-slate-100">
              <span>Available in warehouse</span>
              <span className="text-blue-600 font-medium group-hover:underline hidden sm:inline">Stock &rarr;</span>
            </div>
          </div>
        </div>

        {/* Card 3: Low Stock Products */}
        <div
          onClick={() => onNavigateTab?.("inventory")}
          className={`p-4 sm:p-5 rounded-xl border shadow-2xs transition-all cursor-pointer group flex flex-col justify-between ${
            lowStockCount > 0
              ? "bg-amber-50/60 border-amber-200 hover:border-amber-300"
              : "bg-white border-slate-200 hover:border-amber-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-amber-800 uppercase tracking-wider">
              Low Stock Alert
            </span>
            <div
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-colors ${
                lowStockCount > 0
                  ? "bg-amber-500 text-white"
                  : "bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white"
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-xl sm:text-2xl font-bold tracking-tight ${
                  lowStockCount > 0 ? "text-amber-700" : "text-slate-900"
                }`}
              >
                {lowStockCount}
              </span>
              <span className="text-[11px] text-amber-700 font-medium">
                {lowStockCount === 1 ? "needs reorder" : "need reorder"}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5 pt-1.5 border-t border-amber-200/60">
              <span className="text-amber-700 font-medium">&le; Min Level</span>
              <span className="text-amber-700 font-semibold group-hover:underline hidden sm:inline">Restock &rarr;</span>
            </div>
          </div>
        </div>

        {/* Card 4: Out of Stock Products */}
        <div
          onClick={() => onNavigateTab?.("inventory")}
          className={`p-4 sm:p-5 rounded-xl border shadow-2xs transition-all cursor-pointer group flex flex-col justify-between ${
            outOfStockCount > 0
              ? "bg-rose-50/70 border-rose-200 hover:border-rose-300"
              : "bg-white border-slate-200 hover:border-rose-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-rose-800 uppercase tracking-wider">
              Out of Stock
            </span>
            <div
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-colors ${
                outOfStockCount > 0
                  ? "bg-rose-500 text-white"
                  : "bg-rose-50 text-rose-600 group-hover:bg-rose-500 group-hover:text-white"
              }`}
            >
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-xl sm:text-2xl font-bold tracking-tight ${
                  outOfStockCount > 0 ? "text-rose-700" : "text-slate-900"
                }`}
              >
                {outOfStockCount}
              </span>
              <span className="text-[11px] text-rose-700 font-medium">
                {outOfStockCount === 1 ? "item 0 stock" : "items 0 stock"}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5 pt-1.5 border-t border-rose-200/60">
              <span className="text-rose-700 font-medium">Cannot sell</span>
              <span className="text-rose-700 font-semibold group-hover:underline hidden sm:inline">Fix &rarr;</span>
            </div>
          </div>
        </div>
      </div>

      {/* Financial & HR Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales Card */}
        <div
          onClick={() => onNavigateTab?.("sales")}
          className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs hover:border-blue-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Sales
            </span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {formatCurrency(metrics.total_sales)}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
              <span>Today: {formatCurrency(metrics.today_sales)}</span>
              <span className="text-blue-600 font-medium group-hover:underline">Sales &rarr;</span>
            </div>
          </div>
        </div>

        {/* Total Expenses Card */}
        <div
          onClick={() => onNavigateTab?.("expenses")}
          className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs hover:border-rose-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Expenses
            </span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-colors">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {formatCurrency(metrics.total_expenses)}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
              <span>Today: {formatCurrency(metrics.today_expenses)}</span>
              <span className="text-rose-600 font-medium group-hover:underline">Expenses &rarr;</span>
            </div>
          </div>
        </div>

        {/* Total Profit Card */}
        <div
          onClick={() => onNavigateTab?.("reports")}
          className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs hover:border-emerald-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Net Profit
            </span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div
              className={`text-xl sm:text-2xl font-bold tracking-tight ${
                metrics.total_profit >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {formatCurrency(metrics.total_profit)}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
              <span>Margin: {profitMarginPercent}%</span>
              <span className="text-emerald-600 font-medium group-hover:underline">Reports &rarr;</span>
            </div>
          </div>
        </div>

        {/* Staff & Payroll Card */}
        <div
          onClick={() => onNavigateTab?.("employees")}
          className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs hover:border-purple-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Staff &amp; Payroll
            </span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {metrics.total_employees} <span className="text-xs font-medium text-slate-500">Staff</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {metrics.active_employees ?? metrics.total_employees} Active
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
              <span className="font-semibold text-slate-700">
                {formatCurrency(metrics.monthly_payroll || 0)}<span className="font-normal text-slate-400">/mo</span>
              </span>
              <span className="text-purple-600 font-semibold group-hover:underline">Directory &rarr;</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

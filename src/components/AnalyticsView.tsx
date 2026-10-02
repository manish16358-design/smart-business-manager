import React, { useState, useEffect, useMemo } from "react";
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
  RefreshCw,
  Search,
  Filter,
  Users,
  Layers,
  FileText,
  BarChart3,
  PieChart,
  ShoppingBag,
  Clock,
  ChevronDown,
  ChevronUp,
  HelpCircle,
} from "lucide-react";
import { formatCurrency, formatDate } from "../utils/formatters";
import {
  BusinessAnalyticsResponse,
  PnLMetrics,
  ProductProfitabilityItem,
  SalesAnalyticsData,
  ExpenseAnalyticsData,
} from "../types";

interface AnalyticsViewProps {
  onNavigateToSales?: () => void;
  onNavigateToExpenses?: () => void;
  onNavigateToInventory?: () => void;
}

type AnalyticsSubTab = "pnl" | "products" | "sales" | "expenses";

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  onNavigateToSales,
  onNavigateToExpenses,
  onNavigateToInventory,
}) => {
  // Date Filter State (Requirement 1 & 6)
  const [period, setPeriod] = useState<"today" | "this_week" | "7days" | "this_month" | "last_month" | "custom">("7days");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activeTab, setActiveTab] = useState<AnalyticsSubTab>("pnl");
  const [loading, setLoading] = useState(false);

  // Search & Sorting for Product Profitability
  const [productSearch, setProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("all");
  const [productSortBy, setProductSortBy] = useState<"revenue_desc" | "profit_desc" | "margin_desc" | "units_desc" | "stock_asc">("revenue_desc");

  // Analytics API Data State
  const [analyticsData, setAnalyticsData] = useState<BusinessAnalyticsResponse | null>(null);

  const fetchAnalytics = async (p = period, s = startDate, e = endDate) => {
    setLoading(true);
    try {
      let url = `/api/analytics?period=${p}`;
      if (p === "custom" && s && e) {
        url += `&start_date=${encodeURIComponent(s)}&end_date=${encodeURIComponent(e)}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.success) {
        setAnalyticsData(data);
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

  const pnl: PnLMetrics = analyticsData?.pnl || {
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
  };

  const productList: ProductProfitabilityItem[] = analyticsData?.product_profitability || [];
  const salesAnalytics: SalesAnalyticsData = analyticsData?.sales_analytics || {
    daily_sales_trend: [],
    top_selling_products: [],
    highest_revenue_products: [],
    sales_by_date: [],
    sales_by_customer: [],
    summary_cards: {
      total_orders: 0,
      total_units_sold: 0,
      paid_revenue: 0,
      pending_revenue: 0,
      avg_order_value: 0,
    },
  };

  const expenseAnalytics: ExpenseAnalyticsData = analyticsData?.expense_analytics || {
    expense_categories: [],
    total_expenses: 0,
    expense_trend: [],
    highest_expense_categories: [],
  };

  // Unique product categories
  const productCategories = useMemo(() => {
    const cats = new Set<string>();
    productList.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [productList]);

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    return productList.filter((p) => {
      if (productSearch.trim()) {
        const query = productSearch.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesSku = (p.sku || "").toLowerCase().includes(query);
        if (!matchesName && !matchesSku) return false;
      }
      if (productCategoryFilter !== "all" && p.category !== productCategoryFilter) {
        return false;
      }
      return true;
    }).sort((a, b) => {
      if (productSortBy === "revenue_desc") return b.selling_revenue - a.selling_revenue;
      if (productSortBy === "profit_desc") return b.gross_profit - a.gross_profit;
      if (productSortBy === "margin_desc") return b.profit_margin - a.profit_margin;
      if (productSortBy === "units_desc") return b.units_sold - a.units_sold;
      if (productSortBy === "stock_asc") return a.stock_remaining - b.stock_remaining;
      return 0;
    });
  }, [productList, productSearch, productCategoryFilter, productSortBy]);

  // Calculations for waterfall
  const cogsPct = pnl.total_sales > 0 ? Math.min(100, Math.round((pnl.cogs / pnl.total_sales) * 100)) : 0;
  const expPct = pnl.total_sales > 0 ? Math.min(100, Math.round((pnl.expenses / pnl.total_sales) * 100)) : 0;
  const netMarginPct = pnl.profit_margin;

  return (
    <div className="space-y-6">
      {/* 1. Header with Period Selector & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Business Analytics &amp; Profit/Loss
              </h1>
              <p className="text-xs text-slate-500">
                P&amp;L income statements, product margin analytics, sales volume, and operating cost trends
              </p>
            </div>
          </div>
        </div>

        {/* Date Filter & Refresh Button */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1 p-1 bg-white rounded-xl border border-slate-200 shadow-2xs text-xs">
            {(["today", "this_week", "7days", "this_month", "last_month", "custom"] as const).map((pKey) => (
              <button
                key={pKey}
                onClick={() => setPeriod(pKey)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  period === pKey
                    ? "bg-blue-600 text-white shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {pKey === "today" && "Today"}
                {pKey === "this_week" && "This Week"}
                {pKey === "7days" && "7 Days"}
                {pKey === "this_month" && "This Month"}
                {pKey === "last_month" && "Last Month"}
                {pKey === "custom" && "Custom Range"}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchAnalytics(period, startDate, endDate)}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
            title="Refresh Analytics Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Custom Date Selector Row */}
      {period === "custom" && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center gap-3 animate-in fade-in">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Custom Date Range:</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
            />
          </div>
          <button
            onClick={() => fetchAnalytics(period, startDate, endDate)}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            Apply Custom Filter
          </button>
        </div>
      )}

      {/* 2. Top Summary P&L Metric Cards (Requirement 1 & 5) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Card 1: Total Sales / Revenue */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Revenue
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono tracking-tight">
              {formatCurrency(pnl.total_sales)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>{pnl.total_orders} orders</span>
              <span>{pnl.total_units_sold} units</span>
            </div>
          </div>
        </div>

        {/* Card 2: Cost of Goods Sold (COGS) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              COGS (Cost)
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-bold text-slate-800 font-mono tracking-tight">
              {formatCurrency(pnl.cogs)}
            </div>
            <div className="text-[11px] text-amber-700 font-medium mt-1">
              {cogsPct}% of total sales
            </div>
          </div>
        </div>

        {/* Card 3: Gross Profit */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              Gross Profit
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-bold text-emerald-600 font-mono tracking-tight">
              {formatCurrency(pnl.gross_profit)}
            </div>
            <div className="text-[11px] text-emerald-700 font-semibold mt-1">
              {pnl.gross_margin}% Gross Margin
            </div>
          </div>
        </div>

        {/* Card 4: Operating Expenses */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">
              Expenses
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-bold text-rose-600 font-mono tracking-tight">
              {formatCurrency(pnl.expenses)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {expPct}% of sales revenue
            </div>
          </div>
        </div>

        {/* Card 5: Net Profit */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Net Profit
            </span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                pnl.net_profit >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
              }`}
            >
              {pnl.net_profit >= 0 ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : (
                <ArrowDownRight className="w-4 h-4" />
              )}
            </div>
          </div>
          <div className="mt-3">
            <div
              className={`text-xl sm:text-2xl font-bold font-mono tracking-tight ${
                pnl.net_profit >= 0 ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {formatCurrency(pnl.net_profit)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Gross &minus; Operating Costs
            </div>
          </div>
        </div>

        {/* Card 6: Profit Margin % */}
        <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">
              Profit Margin
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-bold text-blue-900 font-mono tracking-tight">
              {netMarginPct}%
            </div>
            <div className="text-[11px] text-blue-700 font-semibold mt-1">
              Net return rate
            </div>
          </div>
        </div>
      </div>

      {/* 3. Section Navigation Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveTab("pnl")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "pnl"
                ? "bg-blue-600 text-white shadow-2xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>P&amp;L Statement</span>
          </button>

          <button
            onClick={() => setActiveTab("products")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "products"
                ? "bg-blue-600 text-white shadow-2xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Product Profitability ({productList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("sales")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "sales"
                ? "bg-blue-600 text-white shadow-2xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Sales Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab("expenses")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "expenses"
                ? "bg-blue-600 text-white shadow-2xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Expense Analytics</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 px-2 hidden sm:block">
          Active Period: <span className="font-semibold text-slate-800 uppercase">{period.replace("_", " ")}</span>
        </div>
      </div>

      {/* ================= TAB 1: PROFIT & LOSS STATEMENT (Requirement 1) ================= */}
      {activeTab === "pnl" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Income Waterfall Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Income Statement Waterfall</h3>
                <p className="text-slate-500 text-xs">Proportional view of where incoming sales revenue goes</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-3 h-3 rounded-md bg-amber-500 inline-block" /> COGS ({cogsPct}%)
                </span>
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-3 h-3 rounded-md bg-rose-500 inline-block" /> Expenses ({expPct}%)
                </span>
                <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                  <span className="w-3 h-3 rounded-md bg-emerald-500 inline-block" /> Net Profit ({Math.max(0, netMarginPct)}%)
                </span>
              </div>
            </div>

            <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
              <div
                style={{ width: `${cogsPct}%` }}
                className="bg-amber-500 h-full transition-all duration-300"
                title={`COGS: ${formatCurrency(pnl.cogs)} (${cogsPct}%)`}
              />
              <div
                style={{ width: `${expPct}%` }}
                className="bg-rose-500 h-full transition-all duration-300"
                title={`Operating Expenses: ${formatCurrency(pnl.expenses)} (${expPct}%)`}
              />
              <div
                style={{ width: `${Math.max(0, netMarginPct)}%` }}
                className="bg-emerald-500 h-full transition-all duration-300"
                title={`Net Profit: ${formatCurrency(pnl.net_profit)} (${netMarginPct}%)`}
              />
            </div>
          </div>

          {/* Formal Income Statement Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">Formal Profit &amp; Loss Statement</h3>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {analyticsData?.start_date && analyticsData?.end_date
                  ? `${analyticsData.start_date} to ${analyticsData.end_date}`
                  : "Period Summary"}
              </span>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {/* Row 1: Gross Sales */}
              <div className="p-4 flex items-center justify-between hover:bg-slate-50/50">
                <div>
                  <span className="font-bold text-slate-900 text-sm">Gross Sales Revenue</span>
                  <p className="text-[11px] text-slate-500">Total invoiced value of sold goods &amp; products</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-900 font-mono text-sm">{formatCurrency(pnl.total_sales)}</span>
                  <span className="block text-[11px] text-slate-400">100.0%</span>
                </div>
              </div>

              {/* Row 2: COGS */}
              <div className="p-4 flex items-center justify-between bg-amber-50/20 hover:bg-amber-50/40">
                <div className="pl-4 border-l-2 border-amber-400">
                  <span className="font-semibold text-slate-800">Less: Cost of Goods Sold (COGS)</span>
                  <p className="text-[11px] text-slate-500">Purchase cost of inventoried items fulfilled in orders</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-amber-700 font-mono text-sm">&minus; {formatCurrency(pnl.cogs)}</span>
                  <span className="block text-[11px] text-amber-700 font-medium">{cogsPct}%</span>
                </div>
              </div>

              {/* Row 3: Gross Profit */}
              <div className="p-4 flex items-center justify-between bg-emerald-50/40">
                <div>
                  <span className="font-bold text-emerald-800 text-sm">Equals: Gross Operating Profit</span>
                  <p className="text-[11px] text-emerald-700">Earnings after direct procurement and wholesale costs</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-emerald-700 font-mono text-base">{formatCurrency(pnl.gross_profit)}</span>
                  <span className="block text-[11px] text-emerald-800 font-bold">{pnl.gross_margin}% Gross Margin</span>
                </div>
              </div>

              {/* Row 4: Operating Expenses Breakdown */}
              <div className="p-4 space-y-2 bg-slate-50/30">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Less: Operating Expenses</span>
                  <span className="font-bold text-rose-600 font-mono text-sm">&minus; {formatCurrency(pnl.expenses)}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 pl-4">
                  {expenseAnalytics.expense_categories.map((cat) => (
                    <div key={cat.category} className="p-2 rounded-lg bg-white border border-slate-200/80 flex items-center justify-between">
                      <span className="text-slate-600 text-[11px] truncate">{cat.category}</span>
                      <span className="font-mono font-medium text-slate-900 text-[11px]">{formatCurrency(cat.amount)}</span>
                    </div>
                  ))}
                  {expenseAnalytics.expense_categories.length === 0 && (
                    <div className="text-[11px] text-slate-400">No operating expenses recorded in this period.</div>
                  )}
                </div>
              </div>

              {/* Row 5: Net Profit */}
              <div className={`p-4 flex items-center justify-between ${pnl.net_profit >= 0 ? "bg-emerald-50/80" : "bg-rose-50/80"}`}>
                <div>
                  <span className="font-bold text-slate-900 text-base">Equals: Net Operating Profit</span>
                  <p className="text-[11px] text-slate-600">Final business bottom line after all costs and operations</p>
                </div>
                <div className="text-right">
                  <span
                    className={`font-bold font-mono text-lg ${
                      pnl.net_profit >= 0 ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {formatCurrency(pnl.net_profit)}
                  </span>
                  <span className="block text-xs font-bold text-slate-800">
                    {netMarginPct}% Net Profit Margin
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: PRODUCT PROFITABILITY (Requirement 2) ================= */}
      {activeTab === "products" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Controls: Search, Category Filter, Sorting */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search products by name or SKU..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={productCategoryFilter}
                onChange={(e) => setProductCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories ({productCategories.length})</option>
                {productCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={productSortBy}
                onChange={(e) => setProductSortBy(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="revenue_desc">Highest Selling Revenue</option>
                <option value="profit_desc">Highest Gross Profit</option>
                <option value="margin_desc">Highest Margin %</option>
                <option value="units_desc">Most Units Sold</option>
                <option value="stock_asc">Lowest Stock Remaining</option>
              </select>
            </div>
          </div>

          {/* Product Profitability Table (Requirement 2) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Product Margin &amp; Profitability Analysis</h3>
                <p className="text-xs text-slate-500">Every product's units sold, revenue, purchase cost, gross profit, and margin</p>
              </div>
              <span className="text-xs text-slate-500">
                Showing {filteredProducts.length} of {productList.length} products
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">Category / SKU</th>
                    <th className="py-3 px-4 text-center">Units Sold</th>
                    <th className="py-3 px-4 text-right">Selling Revenue</th>
                    <th className="py-3 px-4 text-right">Purchase Cost (COGS)</th>
                    <th className="py-3 px-4 text-right">Gross Profit</th>
                    <th className="py-3 px-4 text-center">Profit Margin %</th>
                    <th className="py-3 px-4 text-center">Stock Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((p) => {
                    const isProfitable = p.gross_profit > 0;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Name */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span>{p.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Unit Price: {formatCurrency(p.unit_price)} &bull; Cost: {formatCurrency(p.unit_cost)}
                          </div>
                        </td>

                        {/* Category & SKU */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-medium">
                            {p.category}
                          </span>
                          {p.sku && (
                            <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                              {p.sku}
                            </span>
                          )}
                        </td>

                        {/* Units Sold */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full font-bold font-mono ${
                            p.units_sold > 0 ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"
                          }`}>
                            {p.units_sold} units
                          </span>
                        </td>

                        {/* Selling Revenue */}
                        <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-semibold text-slate-900">
                          {formatCurrency(p.selling_revenue)}
                        </td>

                        {/* Purchase Cost (COGS) */}
                        <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-slate-600">
                          {formatCurrency(p.purchase_cost)}
                        </td>

                        {/* Gross Profit */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <span className={`font-mono font-bold ${isProfitable ? "text-emerald-600" : "text-slate-500"}`}>
                            {formatCurrency(p.gross_profit)}
                          </span>
                        </td>

                        {/* Profit Margin % */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.profit_margin >= 40
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : p.profit_margin > 0
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-slate-100 text-slate-500"
                          }`}>
                            {p.profit_margin}%
                          </span>
                        </td>

                        {/* Stock Remaining */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-md font-mono text-xs font-semibold ${
                            p.stock_remaining <= 0
                              ? "bg-rose-100 text-rose-800"
                              : p.stock_remaining <= 5
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-800"
                          }`}>
                            {p.stock_remaining} left
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: SALES ANALYTICS (Requirement 3) ================= */}
      {activeTab === "sales" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Total Orders
              </span>
              <div className="text-2xl font-bold text-slate-900 font-mono mt-1">
                {salesAnalytics.summary_cards.total_orders}
              </div>
              <span className="text-[11px] text-slate-400">Transactions processed</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Average Order Value
              </span>
              <div className="text-2xl font-bold text-blue-600 font-mono mt-1">
                {formatCurrency(salesAnalytics.summary_cards.avg_order_value)}
              </div>
              <span className="text-[11px] text-slate-400">Revenue per transaction</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Paid Revenue
              </span>
              <div className="text-2xl font-bold text-emerald-600 font-mono mt-1">
                {formatCurrency(salesAnalytics.summary_cards.paid_revenue)}
              </div>
              <span className="text-[11px] text-emerald-700">Settled receipts</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Pending Receivables
              </span>
              <div className="text-2xl font-bold text-amber-600 font-mono mt-1">
                {formatCurrency(salesAnalytics.summary_cards.pending_revenue)}
              </div>
              <span className="text-[11px] text-amber-700">Credit / Due balance</span>
            </div>
          </div>

          {/* Daily Sales Trend Timeline */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Daily Sales &amp; Margin Trend</h3>
                <p className="text-xs text-slate-500">Day-by-day revenue vs COGS and net profitability</p>
              </div>
            </div>

            <div className="space-y-3">
              {salesAnalytics.daily_sales_trend.map((day) => {
                const maxVal = Math.max(1, ...salesAnalytics.daily_sales_trend.map((d) => d.sales));
                const barWidth = Math.min(100, Math.round((day.sales / maxVal) * 100));

                return (
                  <div key={day.date} className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{day.label}</span>
                        <span className="text-slate-400">({day.orders} {day.orders === 1 ? "order" : "orders"})</span>
                      </div>
                      <div className="flex items-center gap-4 font-mono">
                        <span className="font-semibold text-slate-900">Sales: {formatCurrency(day.sales)}</span>
                        <span className="text-slate-500">COGS: {formatCurrency(day.cogs)}</span>
                        <span className={day.net_profit >= 0 ? "text-emerald-700 font-bold" : "text-rose-700 font-bold"}>
                          Profit: {formatCurrency(day.net_profit)}
                        </span>
                      </div>
                    </div>

                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden flex">
                      <div
                        style={{ width: `${barWidth}%` }}
                        className="bg-blue-600 h-full rounded-full transition-all duration-300"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2-Column Split: Top Selling & Highest Revenue Products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top-Selling Products */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                <span>Top-Selling Products (by Units Sold)</span>
              </h3>
              <div className="divide-y divide-slate-100 text-xs">
                {salesAnalytics.top_selling_products.map((p, idx) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="font-semibold text-slate-900">{p.name}</span>
                        <span className="text-[11px] text-slate-400 block">{p.category}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-blue-700 font-mono">{p.units_sold} units</span>
                      <span className="block text-[11px] text-slate-500">{formatCurrency(p.revenue)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Highest-Revenue Products */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>Highest-Revenue Products (by Sales Value)</span>
              </h3>
              <div className="divide-y divide-slate-100 text-xs">
                {salesAnalytics.highest_revenue_products.map((p, idx) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="font-semibold text-slate-900">{p.name}</span>
                        <span className="text-[11px] text-slate-400 block">{p.category}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-emerald-700 font-mono">{formatCurrency(p.revenue)}</span>
                      <span className="block text-[11px] text-slate-500">{p.units_sold} units sold</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sales by Customer Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">Sales by Customer Contribution</h3>
              </div>
              <span className="text-xs text-slate-500">
                {salesAnalytics.sales_by_customer.length} contributing clients
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-4 text-center">Orders Count</th>
                    <th className="py-3 px-4 text-right">Total Revenue</th>
                    <th className="py-3 px-4 text-center">Sales Contribution %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salesAnalytics.sales_by_customer.map((c) => (
                    <tr key={c.name} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{c.name}</div>
                        {c.phone && <div className="text-[11px] text-slate-400">{c.phone}</div>}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-medium">
                        {c.orders_count}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(c.total_spent)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-2">
                          <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                            <div
                              style={{ width: `${Math.min(100, c.percentage)}%` }}
                              className="bg-blue-600 h-full rounded-full"
                            />
                          </div>
                          <span className="font-bold text-slate-700 text-[11px]">{c.percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 4: EXPENSE ANALYTICS (Requirement 4) ================= */}
      {activeTab === "expenses" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Expense Total Banner */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Total Operating Expenses in Period
              </span>
              <div className="text-3xl font-bold text-rose-600 font-mono mt-1">
                {formatCurrency(expenseAnalytics.total_expenses)}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Deducted from gross profit to determine true business net earnings
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold">
                {expenseAnalytics.expense_categories.length} active cost categories
              </span>
            </div>
          </div>

          {/* Expense Categories Breakdown Table & Bars */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-rose-600" />
                <h3 className="font-bold text-slate-900 text-sm">Expense Categories &amp; Outflow Distribution</h3>
              </div>
              <span className="text-xs text-slate-500">Sorted by highest expenditure</span>
            </div>

            <div className="p-5 space-y-4">
              {expenseAnalytics.expense_categories.map((cat) => (
                <div key={cat.category} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{cat.category}</span>
                      <span className="text-slate-400">({cat.count} {cat.count === 1 ? "entry" : "entries"})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-900 font-mono">{formatCurrency(cat.amount)}</span>
                      <span className="text-rose-700 font-semibold w-12 text-right">{cat.percentage}%</span>
                    </div>
                  </div>

                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.min(100, cat.percentage)}%` }}
                      className="bg-rose-500 h-full rounded-full transition-all duration-300"
                    />
                  </div>
                </div>
              ))}

              {expenseAnalytics.expense_categories.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No expenses found for the selected period.
                </div>
              )}
            </div>
          </div>

          {/* Highest Expense Categories Quick Cards */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Receipt className="w-4 h-4 text-rose-600" />
              <span>Highest Operating Expense Items</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {expenseAnalytics.highest_expense_categories.map((cat, idx) => (
                <div key={cat.category} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">{cat.category}</span>
                    <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold flex items-center justify-center">
                      #{idx + 1}
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className="text-lg font-bold font-mono text-slate-900">
                      {formatCurrency(cat.amount)}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Represents {cat.percentage}% of all expenses
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

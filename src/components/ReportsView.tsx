import React, { useState } from "react";
import { DashboardMetrics, SaleItem, ExpenseItem, ProductItem } from "../types";
import {
  FileBarChart,
  Download,
  TrendingUp,
  DollarSign,
  Receipt,
  Percent,
  ArrowUpRight,
  Sparkles,
  LayoutGrid,
  FileSpreadsheet,
} from "lucide-react";
import { formatCurrency } from "../utils/formatters";
import { RevenueForecast } from "./RevenueForecast";
import { ReportsExport } from "./ReportsExport";

interface ReportsViewProps {
  metrics: DashboardMetrics;
  sales: SaleItem[];
  expenses: ExpenseItem[];
  products?: ProductItem[];
}

type ReportSectionTab = "all" | "export" | "forecast" | "pnl";

export const ReportsView: React.FC<ReportsViewProps> = ({
  metrics,
  sales,
  expenses,
  products = [],
}) => {
  const [activeReportTab, setActiveReportTab] = useState<ReportSectionTab>("all");

  const marginPercent =
    metrics.total_sales > 0
      ? ((metrics.total_profit / metrics.total_sales) * 100).toFixed(1)
      : "0.0";

  // Group sales by product
  const productSalesMap: Record<string, { qty: number; revenue: number }> = {};
  sales.forEach((s) => {
    if (!productSalesMap[s.product_name]) {
      productSalesMap[s.product_name] = { qty: 0, revenue: 0 };
    }
    productSalesMap[s.product_name].qty += s.quantity;
    productSalesMap[s.product_name].revenue += s.total_amount;
  });

  const topProducts = Object.entries(productSalesMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Group expenses by category
  const expenseCategoryMap: Record<string, number> = {};
  expenses.forEach((e) => {
    expenseCategoryMap[e.category] = (expenseCategoryMap[e.category] || 0) + e.amount;
  });

  const handleExportCSV = () => {
    const csvRows = [
      ["Type", "Identifier", "Description/Item", "Amount", "Date"],
      ...sales.map((s) => ["Sale", s.invoice_no || `INV-${s.id}`, s.product_name, s.total_amount, s.sale_date]),
      ...expenses.map((e) => ["Expense", `EXP-${e.id}`, e.description, e.amount, e.expense_date]),
    ];
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map((r) => r.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `smart_business_report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Reports Navigation Bar & View Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
            <FileBarChart className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Financial &amp; Sales Reports</h2>
            <p className="text-xs text-slate-500">
              Profit &amp; loss analysis, sales performance, and predictive revenue forecasts
            </p>
          </div>
        </div>

        {/* Sub-section tab buttons */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80 text-xs">
          <button
            onClick={() => setActiveReportTab("all")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeReportTab === "all"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>All Reports</span>
          </button>
          <button
            onClick={() => setActiveReportTab("export")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeReportTab === "export"
                ? "bg-white text-emerald-800 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Reports Export</span>
            <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">
              New
            </span>
          </button>
          <button
            onClick={() => setActiveReportTab("forecast")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeReportTab === "forecast"
                ? "bg-white text-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
            <span>Revenue Forecast</span>
          </button>
          <button
            onClick={() => setActiveReportTab("pnl")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeReportTab === "pnl"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Receipt className="w-3.5 h-3.5 text-emerald-600" />
            <span>Profit &amp; Loss</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: BUSINESS REPORTS EXPORT (Requirement 1, 2, 3, 4, 5, 6, 7, 8, 9) */}
      {(activeReportTab === "all" || activeReportTab === "export") && (
        <section aria-label="Business Reports Export">
          {activeReportTab === "all" && (
            <div className="pt-1 pb-1 flex items-center gap-3">
              <div className="h-px bg-slate-200 flex-1" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Business Reports Export (CSV)
              </span>
              <div className="h-px bg-slate-200 flex-1" />
            </div>
          )}
          <ReportsExport
            sales={sales}
            expenses={expenses}
            products={products}
            metrics={metrics}
          />
        </section>
      )}

      {/* SECTION 2: REVENUE FORECAST (Requirement 1, 2, 3, 4, 5, 6, 9, 10) */}
      {(activeReportTab === "all" || activeReportTab === "forecast") && (
        <section aria-label="Revenue Forecast">
          {activeReportTab === "all" && (
            <div className="pt-2 flex items-center gap-3">
              <div className="h-px bg-slate-200 flex-1" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Revenue Forecast &amp; Predictive Model
              </span>
              <div className="h-px bg-slate-200 flex-1" />
            </div>
          )}
          <RevenueForecast sales={sales} />
        </section>
      )}

      {/* SECTION 2: PROFIT & LOSS FINANCIAL REPORT */}
      {(activeReportTab === "all" || activeReportTab === "pnl") && (
        <div className="space-y-6">
          {/* Section Divider Header if showing All */}
          {activeReportTab === "all" && (
            <div className="pt-2 flex items-center gap-3">
              <div className="h-px bg-slate-200 flex-1" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Profit &amp; Loss Analysis
              </span>
              <div className="h-px bg-slate-200 flex-1" />
            </div>
          )}

          {/* Report Summary Header */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <FileBarChart className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Profit &amp; Loss Financial Report</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time business margin analysis, revenue distribution, and top-selling lines
              </p>
            </div>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors shadow-2xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export Summary (CSV)</span>
            </button>
          </div>

          {/* Financial Metrics Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Gross Revenue
              </div>
              <div className="text-2xl font-bold text-blue-600 mt-1">
                {formatCurrency(metrics.total_sales)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Total customer billing</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Operating Expenses
              </div>
              <div className="text-2xl font-bold text-rose-600 mt-1">
                {formatCurrency(metrics.total_expenses)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Operating outgoings</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Net Business Profit
              </div>
              <div
                className={`text-2xl font-bold mt-1 ${
                  metrics.total_profit >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {formatCurrency(metrics.total_profit)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Revenue minus expenses</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Profit Margin
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {marginPercent}%
              </div>
              <div className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1 font-medium">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Healthy baseline</span>
              </div>
            </div>
          </div>

          {/* Two-Column Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Selling Products */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 mb-3 pb-2 border-b border-slate-100">
                Top Selling Products by Revenue
              </h3>
              <div className="space-y-3">
                {topProducts.map((item, idx) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">{item.name}</div>
                        <div className="text-[11px] text-slate-500">{item.qty} units sold</div>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-emerald-600">
                      {formatCurrency(item.revenue)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Expenses by Category */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 mb-3 pb-2 border-b border-slate-100">
                Expenses Breakdown by Category
              </h3>
              <div className="space-y-3">
                {Object.entries(expenseCategoryMap).map(([category, amount]) => {
                  const sharePercent =
                    metrics.total_expenses > 0
                      ? Math.round((amount / metrics.total_expenses) * 100)
                      : 0;

                  return (
                    <div key={category} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-800">{category}</span>
                        <span className="font-bold text-rose-600">
                          {formatCurrency(amount)} ({sharePercent}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-rose-500 h-full rounded-full"
                          style={{ width: `${sharePercent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


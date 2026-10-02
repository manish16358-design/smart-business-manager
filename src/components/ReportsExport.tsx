import React, { useState, useMemo } from "react";
import { SaleItem, ExpenseItem, ProductItem, DashboardMetrics } from "../types";
import { formatCurrency, formatDate } from "../utils/formatters";
import {
  generateSalesReportCsv,
  generateExpenseReportCsv,
  generateProfitLossReportCsv,
  generateInventoryReportCsv,
  generateRevenueForecastCsv,
  downloadCsv,
  DateFilterRange,
} from "../utils/csvExport";
import {
  Download,
  Calendar,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  TrendingUp,
  Package,
  Receipt,
  RotateCcw,
  Sparkles,
  Info,
  Eye,
  Filter,
} from "lucide-react";

export type ExportReportType = "sales" | "expenses" | "pnl" | "inventory" | "forecast";

interface ReportsExportProps {
  sales: SaleItem[];
  expenses: ExpenseItem[];
  products: ProductItem[];
  metrics: DashboardMetrics;
}

type DatePreset =
  | "all"
  | "today"
  | "last_7_days"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom";

export const ReportsExport: React.FC<ReportsExportProps> = ({
  sales,
  expenses,
  products,
  metrics,
}) => {
  const [selectedReportType, setSelectedReportType] = useState<ExportReportType>("sales");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [lastExportedInfo, setLastExportedInfo] = useState<{
    reportName: string;
    filename: string;
    count: number;
    time: string;
  } | null>(null);

  // Helper to compute date strings for presets
  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    if (preset === "all") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "today") {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "last_7_days") {
      const past7 = new Date();
      past7.setDate(today.getDate() - 7);
      setStartDate(past7.toISOString().split("T")[0]);
      setEndDate(todayStr);
    } else if (preset === "this_month") {
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      setStartDate(`${year}-${month}-01`);
      setEndDate(todayStr);
    } else if (preset === "last_month") {
      const firstOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDayOfLastMonth = new Date(firstOfThisMonth.getTime() - 1);
      const firstDayOfLastMonth = new Date(
        lastDayOfLastMonth.getFullYear(),
        lastDayOfLastMonth.getMonth(),
        1
      );
      setStartDate(firstDayOfLastMonth.toISOString().split("T")[0]);
      setEndDate(lastDayOfLastMonth.toISOString().split("T")[0]);
    } else if (preset === "this_year") {
      const year = today.getFullYear();
      setStartDate(`${year}-01-01`);
      setEndDate(todayStr);
    }
  };

  const handleCustomDateChange = (start: string, end: string) => {
    setDatePreset("custom");
    setStartDate(start);
    setEndDate(end);
  };

  const currentRange: DateFilterRange = useMemo(
    () => ({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
    [startDate, endDate]
  );

  // Generate data preview and counts for currently selected report type
  const reportData = useMemo(() => {
    switch (selectedReportType) {
      case "sales": {
        const result = generateSalesReportCsv(sales, currentRange);
        return {
          title: "Sales Report",
          filename: result.filename,
          rows: result.rows,
          count: result.recordCount,
          description:
            "Complete sales invoices, items purchased, customer names, taxes, discounts, and payment methods.",
          headers: (result.rows[6] || []) as string[],
          previewRows: result.rows.slice(7, 12),
        };
      }
      case "expenses": {
        const result = generateExpenseReportCsv(expenses, currentRange);
        return {
          title: "Expense Report",
          filename: result.filename,
          rows: result.rows,
          count: result.recordCount,
          description:
            "Operational spending breakdown, categories, payment methods, and expenditure logs.",
          headers: (result.rows[6] || []) as string[],
          previewRows: result.rows.slice(7, 12),
        };
      }
      case "pnl": {
        const result = generateProfitLossReportCsv(sales, expenses, currentRange);
        return {
          title: "Profit & Loss Report",
          filename: result.filename,
          rows: result.rows,
          count: result.recordCount,
          description:
            "Executive P&L statement, daily performance breakdown, top product revenue, and expense allocations.",
          headers: ["Category / Metric", "Value / Gross Revenue", "Notes / Breakdown"],
          previewRows: [
            ["Gross Sales Revenue", formatCurrency(result.rows[5]?.[1]), "Total sales recorded"],
            ["Total Operating Expenses", formatCurrency(result.rows[6]?.[1]), "Operational costs"],
            ["Net Business Profit", formatCurrency(result.rows[7]?.[1]), "Revenue minus expenses"],
            ["Profit Margin", String(result.rows[8]?.[1]), "Operating margin ratio"],
          ],
        };
      }
      case "inventory": {
        const result = generateInventoryReportCsv(products, currentRange);
        return {
          title: "Inventory Report",
          filename: result.filename,
          rows: result.rows,
          count: result.recordCount,
          description:
            "Product catalog stock levels, cost and retail valuation, min stock thresholds, and stock status.",
          headers: (result.rows[10] || []) as string[],
          previewRows: result.rows.slice(11, 16),
        };
      }
      case "forecast": {
        const result = generateRevenueForecastCsv(sales, currentRange);
        return {
          title: "Revenue Forecast Summary",
          filename: result.filename,
          rows: result.rows,
          count: result.recordCount,
          description:
            "Historical monthly revenue actuals, predictive growth rate, and 3-month forward revenue projections.",
          headers: (result.rows[11] || []) as string[],
          previewRows: result.rows.slice(12, 17),
        };
      }
    }
  }, [selectedReportType, sales, expenses, products, metrics, currentRange]);

  // Handle Export Click
  const handleExport = () => {
    if (reportData.count === 0 && selectedReportType !== "pnl" && selectedReportType !== "forecast") {
      return;
    }

    downloadCsv(reportData.filename, reportData.rows);

    setLastExportedInfo({
      reportName: reportData.title,
      filename: reportData.filename,
      count: reportData.count,
      time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    });
  };

  // Quick stats for report badge counters
  const salesCountInRange = useMemo(() => {
    return sales.filter((s) => {
      if (!currentRange.startDate && !currentRange.endDate) return true;
      if (!s.sale_date) return false;
      const d = s.sale_date.split("T")[0];
      if (currentRange.startDate && d < currentRange.startDate) return false;
      if (currentRange.endDate && d > currentRange.endDate) return false;
      return true;
    }).length;
  }, [sales, currentRange]);

  const expensesCountInRange = useMemo(() => {
    return expenses.filter((e) => {
      if (!currentRange.startDate && !currentRange.endDate) return true;
      if (!e.expense_date) return false;
      const d = e.expense_date.split("T")[0];
      if (currentRange.startDate && d < currentRange.startDate) return false;
      if (currentRange.endDate && d > currentRange.endDate) return false;
      return true;
    }).length;
  }, [expenses, currentRange]);

  const reportTypeCards: {
    id: ExportReportType;
    name: string;
    icon: React.ReactNode;
    badge: string;
    color: string;
    activeBorder: string;
  }[] = [
    {
      id: "sales",
      name: "Sales Report",
      icon: <DollarSign className="w-4 h-4 text-blue-600" />,
      badge: `${salesCountInRange} Sales`,
      color: "bg-blue-50 text-blue-700",
      activeBorder: "border-blue-600 ring-2 ring-blue-500/20",
    },
    {
      id: "expenses",
      name: "Expense Report",
      icon: <Receipt className="w-4 h-4 text-rose-600" />,
      badge: `${expensesCountInRange} Expenses`,
      color: "bg-rose-50 text-rose-700",
      activeBorder: "border-rose-600 ring-2 ring-rose-500/20",
    },
    {
      id: "pnl",
      name: "Profit & Loss",
      icon: <FileText className="w-4 h-4 text-emerald-600" />,
      badge: "Financial P&L",
      color: "bg-emerald-50 text-emerald-700",
      activeBorder: "border-emerald-600 ring-2 ring-emerald-500/20",
    },
    {
      id: "inventory",
      name: "Inventory Report",
      icon: <Package className="w-4 h-4 text-amber-600" />,
      badge: `${products.length} Items`,
      color: "bg-amber-50 text-amber-700",
      activeBorder: "border-amber-600 ring-2 ring-amber-500/20",
    },
    {
      id: "forecast",
      name: "Revenue Forecast",
      icon: <TrendingUp className="w-4 h-4 text-purple-600" />,
      badge: "Projection Model",
      color: "bg-purple-50 text-purple-700",
      activeBorder: "border-purple-600 ring-2 ring-purple-500/20",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Business Reports Export</h3>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full uppercase tracking-wide">
                  CSV Export
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Export verified business records, transactions, inventory valuations, and financial summaries to standard CSV spreadsheets.
              </p>
            </div>
          </div>

          {/* Quick status pill */}
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Real-time database sync</span>
          </div>
        </div>
      </div>

      {/* Success Notification Banner (Requirement 6) */}
      {lastExportedInfo && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-xs flex items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-900">
                {lastExportedInfo.reportName} Exported Successfully!
              </div>
              <p className="text-xs text-emerald-700 mt-0.5">
                Downloaded <span className="font-semibold">{lastExportedInfo.filename}</span> (
                {lastExportedInfo.count} records processed) at {lastExportedInfo.time}.
              </p>
            </div>
          </div>
          <button
            onClick={() => setLastExportedInfo(null)}
            className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold px-2 py-1 rounded-md hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Controls Card: Date Range & Preset Filter (Requirement 4) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
            <Filter className="w-4 h-4 text-blue-600" />
            <span>Filter Criteria &amp; Date Range</span>
          </div>
          {(startDate || endDate || datePreset !== "all") && (
            <button
              onClick={() => handlePresetChange("all")}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset to All Time</span>
            </button>
          )}
        </div>

        {/* Date Presets Row */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Quick Time Presets:
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "all", label: "All Time" },
              { id: "today", label: "Today" },
              { id: "last_7_days", label: "Last 7 Days" },
              { id: "this_month", label: "This Month" },
              { id: "last_month", label: "Last Month" },
              { id: "this_year", label: "This Year" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handlePresetChange(p.id as DatePreset)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  datePreset === p.id
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "bg-slate-100 hover:bg-slate-200/80 text-slate-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>From Date (Start)</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleCustomDateChange(e.target.value, endDate)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>To Date (End)</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => handleCustomDateChange(startDate, e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50/50"
            />
          </div>
        </div>

        {/* Active Filter Summary Strip */}
        <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2 pt-1">
          <span className="font-semibold text-slate-700">Active Range:</span>
          <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md font-medium">
            {startDate || endDate
              ? `${startDate ? formatDate(startDate) : "Beginning"} — ${endDate ? formatDate(endDate) : "Latest"}`
              : "All Available Records (No Date Filter)"}
          </span>
        </div>
      </div>

      {/* Select Report Type Cards (Requirement 3 & 4) */}
      <div className="space-y-3">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
          Select Report Type To Export:
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {reportTypeCards.map((card) => {
            const isSelected = selectedReportType === card.id;
            return (
              <button
                key={card.id}
                onClick={() => setSelectedReportType(card.id)}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative bg-white ${
                  isSelected ? card.activeBorder : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="p-2 bg-slate-50 rounded-xl">{card.icon}</div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${card.color}`}>
                    {card.badge}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-900">{card.name}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">CSV Spreadsheet</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Report Details & Export Action Panel */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-base font-bold text-slate-900">{reportData.title}</h4>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-md">
                {reportData.count} records
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">{reportData.description}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              disabled={reportData.count === 0 && selectedReportType !== "pnl" && selectedReportType !== "forecast"}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                reportData.count === 0 && selectedReportType !== "pnl" && selectedReportType !== "forecast"
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-slate-900 hover:bg-slate-800 text-white hover:shadow-md"
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Export {reportData.title} (CSV)</span>
            </button>
          </div>
        </div>

        {/* Empty State Warning (Requirement 7) */}
        {reportData.count === 0 && selectedReportType !== "pnl" && selectedReportType !== "forecast" ? (
          <div className="p-6 bg-amber-50/70 border border-amber-200 rounded-2xl text-center space-y-2">
            <div className="w-10 h-10 mx-auto rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h5 className="text-sm font-bold text-amber-900">
              No Records Found for the Selected Date Range
            </h5>
            <p className="text-xs text-amber-700 max-w-md mx-auto">
              There are no {reportData.title.toLowerCase()} entries recorded within this period. Please choose a broader date range (or select "All Time") to export records.
            </p>
            <div className="pt-2">
              <button
                onClick={() => handlePresetChange("all")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Show All Historical Records</span>
              </button>
            </div>
          </div>
        ) : (
          /* Live CSV Preview Table (Requirement 5) */
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <div className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                <span>Live Data Preview (First Few Records)</span>
              </div>
              <span className="text-[11px] text-slate-400 font-normal">
                Target file: {reportData.filename}
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      {reportData.headers.slice(0, 6).map((h, idx) => (
                        <th key={idx} className="px-3 py-2.5 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {reportData.previewRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50/60 transition-colors">
                        {row.slice(0, 6).map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className="px-3 py-2 text-slate-800 whitespace-nowrap font-medium"
                          >
                            {cell !== undefined && cell !== null ? String(cell) : "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-2.5 bg-slate-50/80 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
                <span>
                  Showing preview of {Math.min(5, reportData.previewRows.length)} rows out of{" "}
                  {reportData.count} total records.
                </span>
                <span className="font-medium text-blue-600">
                  Full dataset included upon download.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

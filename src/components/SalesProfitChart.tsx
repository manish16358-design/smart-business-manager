import React, { useState } from "react";
import { ChartDayData } from "../types";
import { formatCurrency, formatCurrencyCompact } from "../utils/formatters";
import { TrendingUp, BarChart3, Info } from "lucide-react";

interface SalesProfitChartProps {
  data: ChartDayData[];
}

export const SalesProfitChart: React.FC<SalesProfitChartProps> = ({ data }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const safeData = Array.isArray(data) && data.length > 0 ? data : [];
  
  // Calculate max values for bar scaling
  const maxSales = Math.max(...safeData.map((d) => Number(d.sales || d.total || 0)), 100);
  const totalPeriodSales = safeData.reduce((acc, curr) => acc + Number(curr.sales || curr.total || 0), 0);
  const totalPeriodProfit = safeData.reduce((acc, curr) => acc + Number(curr.profit || 0), 0);

  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              Sales &amp; Profit Performance (7 Days)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Daily comparison of revenue vs. net profit
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-blue-600 inline-block"></span>
            <span className="text-slate-600 font-medium">Sales Revenue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block"></span>
            <span className="text-slate-600 font-medium">Net Profit</span>
          </div>
        </div>
      </div>

      {/* Chart Visual Stage */}
      <div className="pt-2">
        <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-52 pb-2">
          {safeData.map((item, idx) => {
            const saleVal = Number(item.sales || item.total || 0);
            const profitVal = Number(item.profit || 0);
            const expenseVal = Number(item.expenses || 0);

            const saleHeightPercent = Math.max(6, Math.min(95, Math.round((saleVal / maxSales) * 85)));
            const profitHeightPercent =
              profitVal > 0 ? Math.max(6, Math.min(95, Math.round((profitVal / maxSales) * 85))) : 4;

            const isHovered = hoveredIndex === idx;

            return (
              <div
                key={item.date || idx}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="relative flex flex-col items-center justify-end h-full group cursor-pointer"
              >
                {/* Floating tooltip */}
                {isHovered && (
                  <div className="absolute -top-16 z-20 bg-slate-900 text-white text-[11px] py-1.5 px-2.5 rounded-lg shadow-lg pointer-events-none whitespace-nowrap animate-in fade-in duration-150">
                    <div className="font-semibold text-slate-200">{item.label}</div>
                    <div className="text-blue-300">Sales: {formatCurrency(saleVal)}</div>
                    <div className="text-emerald-300">Profit: {formatCurrency(profitVal)}</div>
                    <div className="text-rose-300">Expenses: {formatCurrency(expenseVal)}</div>
                  </div>
                )}

                {/* Top value indicator */}
                <div className="text-[10px] sm:text-[11px] font-semibold text-slate-600 mb-1.5 text-center group-hover:text-blue-600 transition-colors">
                  {formatCurrencyCompact(saleVal)}
                </div>

                {/* Dual bar container */}
                <div className="w-full max-w-[48px] bg-slate-100 rounded-t-lg h-36 flex items-end justify-center gap-1 p-1 overflow-hidden">
                  {/* Sales Bar */}
                  <div
                    style={{ height: `${saleHeightPercent}%` }}
                    className="w-1/2 bg-blue-600 hover:bg-blue-500 rounded-t-xs transition-all duration-300"
                    title={`Sales: ${formatCurrency(saleVal)}`}
                  />
                  {/* Profit Bar */}
                  <div
                    style={{ height: `${profitHeightPercent}%` }}
                    className={`w-1/2 rounded-t-xs transition-all duration-300 ${
                      profitVal >= 0
                        ? "bg-emerald-500 hover:bg-emerald-400"
                        : "bg-rose-400 hover:bg-rose-500"
                    }`}
                    title={`Profit: ${formatCurrency(profitVal)}`}
                  />
                </div>

                {/* Day label */}
                <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-2 text-center whitespace-nowrap">
                  {item.label.split(" ")[0]} {item.label.split(" ")[1]}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chart Summary Footer */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100 bg-slate-50/60 -mx-5 -mb-5 px-5 py-3 rounded-b-2xl">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          <span>Past 7 days volume</span>
        </div>
        <div className="flex items-center gap-4">
          <span>
            Total Revenue:{" "}
            <strong className="text-slate-800">{formatCurrency(totalPeriodSales)}</strong>
          </span>
          <span>
            Net Period Profit:{" "}
            <strong className="text-emerald-700">{formatCurrency(totalPeriodProfit)}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};

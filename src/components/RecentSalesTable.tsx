import React from "react";
import { SaleItem } from "../types";
import { formatCurrency } from "../utils/formatters";
import { ShoppingCart, ExternalLink } from "lucide-react";

interface RecentSalesTableProps {
  sales: SaleItem[];
  onViewAll?: () => void;
}

export const RecentSalesTable: React.FC<RecentSalesTableProps> = ({ sales, onViewAll }) => {
  const safeSales = Array.isArray(sales) ? sales.slice(0, 5) : [];

  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Sales</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Latest client transactions &amp; orders
            </p>
          </div>
          {onViewAll && (
            <button
              onClick={onViewAll}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {safeSales.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                  <th className="pb-2.5 font-semibold">Customer</th>
                  <th className="pb-2.5 font-semibold">Product</th>
                  <th className="pb-2.5 font-semibold text-center">Qty</th>
                  <th className="pb-2.5 font-semibold text-right">Total</th>
                  <th className="pb-2.5 font-semibold text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {safeSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 font-semibold text-slate-900">
                      <div>{sale.customer_name}</div>
                      {sale.invoice_no && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          {sale.invoice_no}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 text-slate-600">{sale.product_name}</td>
                    <td className="py-2.5 text-slate-600 text-center">{sale.quantity}</td>
                    <td className="py-2.5 font-semibold text-emerald-600 text-right font-mono">
                      {formatCurrency(sale.total_amount)}
                    </td>
                    <td className="py-2.5 text-slate-400 font-mono text-[11px] text-right">
                      {sale.sale_date}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800">No sales recorded yet</p>
            <p className="text-xs text-slate-400 max-w-xs mt-1">
              Sales entered through the Sales ledger will automatically appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

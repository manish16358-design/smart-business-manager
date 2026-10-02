import React from "react";
import { ProductItem } from "../types";
import { AlertTriangle, CheckCircle2, ArrowRight, Plus } from "lucide-react";

interface LowStockAlertsProps {
  products: ProductItem[];
  onViewInventory?: () => void;
  onRestock?: (product: ProductItem) => void;
}

export const LowStockAlerts: React.FC<LowStockAlertsProps> = ({
  products,
  onViewInventory,
  onRestock,
}) => {
  const lowStockItems = Array.isArray(products)
    ? products.filter((p) => p.stock_quantity <= p.min_stock_level)
    : [];

  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Low Stock Alerts</h2>
              {lowStockItems.length > 0 && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">
                  {lowStockItems.length} Urgent
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Items at or below minimum threshold
            </p>
          </div>
          {onViewInventory && (
            <button
              onClick={onViewInventory}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
            >
              <span>Inventory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {lowStockItems.length > 0 ? (
          <div className="space-y-2.5">
            {lowStockItems.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-xl flex items-center justify-between gap-3 transition-colors border ${
                  item.stock_quantity <= 0
                    ? "bg-rose-50/60 border-rose-200 hover:border-rose-300"
                    : "bg-amber-50/50 border-amber-200 hover:border-amber-300"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {item.name}
                    </span>
                    {item.stock_quantity <= 0 ? (
                      <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-extrabold text-[9px] border border-rose-200">
                        Out of Stock
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-extrabold text-[9px] border border-amber-200">
                        Low Stock
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Category: <span className="font-medium text-slate-700">{item.category}</span> &bull; Min Level: <span className="font-semibold text-slate-800">{item.min_stock_level}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 text-white font-bold text-xs rounded-lg shadow-2xs font-mono ${
                      item.stock_quantity <= 0 ? "bg-rose-600" : "bg-amber-500"
                    }`}
                  >
                    {item.stock_quantity <= 0 ? "0 left" : `${item.stock_quantity} left`}
                  </span>
                  {onRestock && (
                    <button
                      onClick={() => onRestock(item)}
                      className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                      title="Add inventory"
                    >
                      <Plus className="w-3 h-3 text-slate-600" />
                      <span>Restock</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-10 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800">Inventory Levels Healthy</p>
            <p className="text-xs text-slate-400 max-w-xs mt-1">
              All catalog products have sufficient stock above their minimum threshold.
            </p>
          </div>
        )}
      </div>

      {lowStockItems.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Supplier reorder recommended</span>
          <span className="font-semibold text-amber-700">Auto-tracked via SQLite</span>
        </div>
      )}
    </div>
  );
};

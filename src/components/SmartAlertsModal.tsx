import React from "react";
import {
  X,
  Bell,
  CheckCheck,
  AlertCircle,
  AlertTriangle,
  Flame,
  TrendingDown,
  Package,
  Sliders,
  Sparkles,
  Trash2,
  Check,
  RotateCcw,
} from "lucide-react";
import { SmartAlertItem } from "../types";

interface SmartAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: SmartAlertItem[];
  unreadCount: number;
  onMarkRead: (id: number) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onDismissAlert: (id: number) => Promise<void>;
  onOpenSettings: () => void;
  onQuickRestock: (productId?: number, productName?: string, suggestedQty?: number) => void;
}

export const SmartAlertsModal: React.FC<SmartAlertsModalProps> = ({
  isOpen,
  onClose,
  alerts,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onDismissAlert,
  onOpenSettings,
  onQuickRestock,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shadow-2xs">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Notifications & Smart Alerts</h3>
                {unreadCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700">
                    {unreadCount} unread
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700">
                    All caught up
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">Live inventory shortages, velocity alerts & sales trends</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenSettings}
              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
              title="Alert Preferences"
            >
              <Sliders className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Subheader action bar */}
        {alerts.length > 0 && (
          <div className="px-5 py-2.5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">{alerts.length} total active alerts</span>
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all as read</span>
              </button>
            )}
          </div>
        )}

        {/* Alert List */}
        <div className="overflow-y-auto divide-y divide-slate-100 p-2 sm:p-3 flex-1">
          {alerts.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2 shadow-2xs">
                <Check className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-800">No Active Alerts</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                All inventory stock quantities and sales velocity indicators are healthy.
              </p>
            </div>
          ) : (
            alerts.map((a) => {
              const isUnread = !a.is_read;
              return (
                <div
                  key={a.id}
                  className={`p-3.5 rounded-xl transition-all mb-1 border ${
                    a.priority === "CRITICAL"
                      ? "border-red-200 bg-red-50/40"
                      : isUnread
                      ? "border-slate-200 bg-slate-50/60"
                      : "border-slate-100 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className="mt-0.5 shrink-0">
                        {a.alert_type === "out_of_stock" && <AlertCircle className="w-4 h-4 text-red-600" />}
                        {a.alert_type === "low_stock" && <AlertTriangle className="w-4 h-4 text-amber-600" />}
                        {a.alert_type === "high_demand" && <Flame className="w-4 h-4 text-orange-600" />}
                        {a.alert_type === "slow_moving" && <TrendingDown className="w-4 h-4 text-blue-600" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-900">{a.title}</span>
                          {a.priority === "CRITICAL" && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-red-600 text-white uppercase">
                              Critical
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-1 whitespace-pre-line leading-relaxed">
                          {a.message}
                        </p>
                        {a.action_recommendation && (
                          <div className="mt-2 text-[11px] font-medium text-amber-900 bg-amber-50/90 border border-amber-200/80 rounded-lg p-2 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>{a.action_recommendation}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <button
                        onClick={() => onDismissAlert(a.id)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded-md transition-colors cursor-pointer"
                        title="Dismiss"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onMarkRead(a.id)}
                        className="p-1 text-slate-400 hover:text-emerald-600 rounded-md transition-colors cursor-pointer"
                        title={isUnread ? "Mark as read" : "Mark as unread"}
                      >
                        {isUnread ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Bottom restock button if applicable */}
                  {(a.alert_type === "low_stock" || a.alert_type === "out_of_stock" || a.alert_type === "high_demand") && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-medium">
                        Current: <strong className="text-slate-800">{a.current_stock}</strong> / Min: {a.threshold}
                      </span>
                      <button
                        onClick={() => {
                          onClose();
                          onQuickRestock(a.product_id, a.product_name, a.suggested_reorder_qty);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                      >
                        <Package className="w-3 h-3" />
                        <span>Quick Restock</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
          <button
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Customize thresholds</span>
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

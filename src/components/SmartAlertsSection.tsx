import React, { useState } from "react";
import {
  AlertTriangle,
  Flame,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  Sliders,
  CheckCheck,
  Package,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Search,
  Check,
  Trash2,
  Calendar,
  Layers,
  Info,
} from "lucide-react";
import { SmartAlertItem, AlertCategory, AlertPriority } from "../types";

interface SmartAlertsSectionProps {
  alerts: SmartAlertItem[];
  unreadCount: number;
  onMarkRead: (id: number) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onDismissAlert: (id: number) => Promise<void>;
  onOpenSettings: () => void;
  onQuickRestock: (productId?: number, productName?: string, suggestedQty?: number) => void;
  onRefreshAlerts?: () => void;
}

export const SmartAlertsSection: React.FC<SmartAlertsSectionProps> = ({
  alerts,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onDismissAlert,
  onOpenSettings,
  onQuickRestock,
  onRefreshAlerts,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<"all" | "critical" | "attention" | "insight" | "unread">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Group counts
  const criticalCount = alerts.filter((a) => a.category === "critical" || a.priority === "CRITICAL").length;
  const attentionCount = alerts.filter((a) => a.category === "attention" && a.priority !== "CRITICAL").length;
  const insightCount = alerts.filter((a) => a.category === "insight").length;

  // Filtered list
  const filteredAlerts = alerts.filter((item) => {
    // Category / read filter
    if (selectedFilter === "critical" && item.category !== "critical" && item.priority !== "CRITICAL") return false;
    if (selectedFilter === "attention" && (item.category !== "attention" || item.priority === "CRITICAL")) return false;
    if (selectedFilter === "insight" && item.category !== "insight") return false;
    if (selectedFilter === "unread" && item.is_read) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.product_name.toLowerCase().includes(q);
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchMsg = item.message.toLowerCase().includes(q);
      const matchAction = item.action_recommendation.toLowerCase().includes(q);
      if (!matchName && !matchTitle && !matchMsg && !matchAction) return false;
    }

    return true;
  });

  const handleToggleRead = async (alert: SmartAlertItem) => {
    setActionLoadingId(alert.id);
    try {
      await onMarkRead(alert.id);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDismiss = async (alertId: number) => {
    setActionLoadingId(alertId);
    try {
      await onDismissAlert(alertId);
    } finally {
      setActionLoadingId(null);
    }
  };

  const getAlertBadgeDetails = (alert: SmartAlertItem) => {
    switch (alert.alert_type) {
      case "out_of_stock":
        return {
          icon: <AlertCircle className="w-4 h-4 text-red-600" />,
          bg: "bg-red-50 border-red-200 text-red-800",
          tagBg: "bg-red-100 text-red-700",
          label: "Out of Stock",
          borderAccent: "border-l-4 border-l-red-600",
        };
      case "low_stock":
        return {
          icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
          bg: "bg-amber-50 border-amber-200 text-amber-800",
          tagBg: "bg-amber-100 text-amber-800",
          label: alert.priority === "CRITICAL" ? "Very Low Stock" : "Low Stock",
          borderAccent: alert.priority === "CRITICAL" ? "border-l-4 border-l-red-500" : "border-l-4 border-l-amber-500",
        };
      case "high_demand":
        return {
          icon: <Flame className="w-4 h-4 text-orange-600" />,
          bg: "bg-orange-50 border-orange-200 text-orange-800",
          tagBg: "bg-orange-100 text-orange-800",
          label: "High Demand Surge",
          borderAccent: "border-l-4 border-l-orange-500",
        };
      case "slow_moving":
        return {
          icon: <TrendingDown className="w-4 h-4 text-blue-600" />,
          bg: "bg-blue-50 border-blue-200 text-blue-800",
          tagBg: "bg-blue-100 text-blue-800",
          label: "Slow Moving",
          borderAccent: "border-l-4 border-l-blue-500",
        };
      default:
        return {
          icon: <Info className="w-4 h-4 text-slate-600" />,
          bg: "bg-slate-50 border-slate-200 text-slate-800",
          tagBg: "bg-slate-100 text-slate-700",
          label: "Inventory Alert",
          borderAccent: "border-l-4 border-l-slate-400",
        };
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Top Banner & Controls */}
      <div className="p-5 border-b border-slate-100 bg-linear-to-r from-slate-50 via-white to-slate-50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shadow-2xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">Smart Alerts Center</h3>
                {unreadCount > 0 ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 animate-pulse">
                    {unreadCount} unread
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                    All caught up
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Automated real-time stock surveillance, demand surges & sales velocity intelligence
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                title="Mark all notifications as read"
              >
                <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Mark All Read</span>
              </button>
            )}

            {onRefreshAlerts && (
              <button
                onClick={onRefreshAlerts}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                title="Refresh smart alerts"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={onOpenSettings}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors cursor-pointer"
              title="Configure alert thresholds & periods"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Preferences</span>
            </button>
          </div>
        </div>

        {/* Group KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <button
            onClick={() => setSelectedFilter("all")}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              selectedFilter === "all"
                ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="text-[11px] font-medium opacity-80">Total Alerts</div>
            <div className="text-lg font-bold mt-0.5">{alerts.length}</div>
          </button>

          <button
            onClick={() => setSelectedFilter("critical")}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              selectedFilter === "critical"
                ? "bg-red-600 text-white border-red-600 shadow-2xs"
                : "bg-red-50/60 text-red-900 border-red-200 hover:border-red-300"
            }`}
          >
            <div className="text-[11px] font-medium flex items-center justify-between">
              <span>Critical</span>
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
            </div>
            <div className="text-lg font-bold mt-0.5 text-red-700">{criticalCount}</div>
          </button>

          <button
            onClick={() => setSelectedFilter("attention")}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              selectedFilter === "attention"
                ? "bg-amber-600 text-white border-amber-600 shadow-2xs"
                : "bg-amber-50/60 text-amber-900 border-amber-200 hover:border-amber-300"
            }`}
          >
            <div className="text-[11px] font-medium flex items-center justify-between">
              <span>Attention</span>
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            </div>
            <div className="text-lg font-bold mt-0.5 text-amber-700">{attentionCount}</div>
          </button>

          <button
            onClick={() => setSelectedFilter("insight")}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              selectedFilter === "insight"
                ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                : "bg-blue-50/60 text-blue-900 border-blue-200 hover:border-blue-300"
            }`}
          >
            <div className="text-[11px] font-medium flex items-center justify-between">
              <span>Insights</span>
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            </div>
            <div className="text-lg font-bold mt-0.5 text-blue-700">{insightCount}</div>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-5 py-3 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedFilter("all")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0 ${
              selectedFilter === "all" ? "bg-slate-100 text-slate-900 font-bold" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            All ({alerts.length})
          </button>
          <button
            onClick={() => setSelectedFilter("critical")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0 ${
              selectedFilter === "critical" ? "bg-red-100 text-red-800 font-bold" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            🔴 Critical ({criticalCount})
          </button>
          <button
            onClick={() => setSelectedFilter("attention")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0 ${
              selectedFilter === "attention" ? "bg-amber-100 text-amber-800 font-bold" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            🟠 Attention ({attentionCount})
          </button>
          <button
            onClick={() => setSelectedFilter("insight")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0 ${
              selectedFilter === "insight" ? "bg-blue-100 text-blue-800 font-bold" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            🔵 Insights ({insightCount})
          </button>
          {unreadCount > 0 && (
            <button
              onClick={() => setSelectedFilter("unread")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0 ${
                selectedFilter === "unread" ? "bg-purple-100 text-purple-800 font-bold" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Unread ({unreadCount})
            </button>
          )}
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search alerts or products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-slate-50/50"
          />
        </div>
      </div>

      {/* Alert Cards List */}
      <div className="divide-y divide-slate-100 max-h-[580px] overflow-y-auto">
        {filteredAlerts.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
              <Check className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">No Alerts Found</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `No alerts matching "${searchQuery}". Try clearing your search query.`
                : selectedFilter !== "all"
                ? `No active alerts currently in the "${selectedFilter}" category.`
                : "All product stock levels, sales velocity, and inventory health metrics are in good standing."}
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const badge = getAlertBadgeDetails(alert);
            const isUnread = !alert.is_read;

            return (
              <div
                key={alert.id}
                className={`p-4 sm:p-5 transition-all hover:bg-slate-50/70 flex flex-col md:flex-row md:items-start justify-between gap-4 ${badge.borderAccent} ${
                  isUnread ? "bg-slate-50/40" : "bg-white"
                }`}
              >
                {/* Left side: Alert info & stats */}
                <div className="space-y-2.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${badge.tagBg}`}>
                      {badge.icon}
                      {badge.label}
                    </span>

                    {alert.priority === "CRITICAL" && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-red-600 text-white">
                        Critical
                      </span>
                    )}

                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-blue-600" title="Unread alert"></span>
                    )}

                    {alert.period_info && (
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {alert.period_info}
                      </span>
                    )}
                  </div>

                  {/* Title & Product */}
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>{alert.title}</span>
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 whitespace-pre-line leading-relaxed">
                      {alert.message}
                    </p>
                  </div>

                  {/* Stock & Sales Metrics Grid */}
                  <div className="flex items-center gap-4 flex-wrap text-xs pt-1">
                    <div className="px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700">
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Current Stock</span>
                      <span className={`font-bold ${alert.current_stock <= 0 ? "text-red-600 font-extrabold" : alert.current_stock <= alert.threshold ? "text-amber-700 font-bold" : "text-slate-800"}`}>
                        {alert.current_stock} units
                      </span>
                      <span className="text-[10px] text-slate-400 ml-1">/ min {alert.threshold}</span>
                    </div>

                    {alert.recent_units_sold !== undefined && (
                      <div className="px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700">
                        <span className="text-[10px] text-slate-500 uppercase block font-semibold">Sales Activity</span>
                        <span className="font-bold text-slate-800">{alert.recent_units_sold} sold</span>
                        {alert.previous_units_sold > 0 && (
                          <span className="text-[10px] text-slate-500 ml-1">(prev {alert.previous_units_sold})</span>
                        )}
                      </div>
                    )}

                    {alert.trend_percentage !== 0 && (
                      <div className="px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700 flex flex-col">
                        <span className="text-[10px] text-slate-500 uppercase block font-semibold">Trend Change</span>
                        <span
                          className={`font-bold inline-flex items-center gap-0.5 ${
                            alert.trend_percentage > 0 ? "text-emerald-700" : "text-rose-600"
                          }`}
                        >
                          {alert.trend_percentage > 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {alert.trend_percentage > 0 ? `+${alert.trend_percentage}%` : `${alert.trend_percentage}%`}
                        </span>
                      </div>
                    )}

                    {alert.suggested_reorder_qty > 0 && (
                      <div className="px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg text-blue-900">
                        <span className="text-[10px] text-blue-600 uppercase block font-semibold">Suggested Reorder</span>
                        <span className="font-bold text-blue-700">+{alert.suggested_reorder_qty} units</span>
                      </div>
                    )}
                  </div>

                  {/* Recommendation banner */}
                  {alert.action_recommendation && (
                    <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-2.5 flex items-start gap-2 text-xs text-amber-900">
                      <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Recommended Action: </span>
                        <span>{alert.action_recommendation}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right side: Action Buttons */}
                <div className="flex md:flex-col items-center justify-end gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                  {(alert.alert_type === "low_stock" || alert.alert_type === "out_of_stock" || alert.alert_type === "high_demand") && (
                    <button
                      onClick={() => onQuickRestock(alert.product_id, alert.product_name, alert.suggested_reorder_qty)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>Quick Restock</span>
                    </button>
                  )}

                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={actionLoadingId === alert.id}
                      onClick={() => handleToggleRead(alert)}
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 cursor-pointer disabled:opacity-50"
                      title={isUnread ? "Mark as read" : "Mark as unread"}
                    >
                      {isUnread ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <RotateCcw className="w-3.5 h-3.5 text-slate-400" />}
                    </button>

                    <button
                      disabled={actionLoadingId === alert.id}
                      onClick={() => handleDismiss(alert.id)}
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-slate-200 cursor-pointer disabled:opacity-50"
                      title="Dismiss alert"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

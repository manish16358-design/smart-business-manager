import React, { useState } from "react";
import { X, Sliders, ShieldCheck, Save, RefreshCw } from "lucide-react";
import { AlertSettingsConfig } from "../types";

interface AlertSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AlertSettingsConfig;
  onSaveSettings: (newSettings: AlertSettingsConfig) => Promise<void>;
}

export const AlertSettingsModal: React.FC<AlertSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [formData, setFormData] = useState<AlertSettingsConfig>({ ...settings });
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveSettings(formData);
      onClose();
    } catch (err) {
      console.error("Failed to save alert settings:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setFormData({
      analysis_period_days: 7,
      high_demand_threshold_pct: 40.0,
      slow_moving_threshold_pct: -40.0,
      min_sales_for_trend: 1,
      enable_stock_alerts: true,
      enable_sales_trend_alerts: true,
      critical_stock_ratio: 0.5,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-2xs">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Smart Alert Preferences</h2>
              <p className="text-xs text-slate-500">Configure sensitivity, comparison windows and triggers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Analysis Comparison Window */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Sales Trend Comparison Period
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[7, 14, 30].map((days) => (
                <button
                  type="button"
                  key={days}
                  onClick={() => setFormData({ ...formData, analysis_period_days: days })}
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all text-center cursor-pointer ${
                    formData.analysis_period_days === days
                      ? "border-blue-600 bg-blue-50 text-blue-700 shadow-2xs"
                      : "border-slate-200 hover:border-slate-300 text-slate-600 bg-white"
                  }`}
                >
                  Last {days} Days
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Compares the last {formData.analysis_period_days} days of sales with the prior {formData.analysis_period_days} days.
            </p>
          </div>

          {/* Toggle Modules */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-800 text-xs block">Inventory Stock Alerts</span>
                <span className="text-[11px] text-slate-500">Monitor out-of-stock and low-stock conditions</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enable_stock_alerts}
                  onChange={(e) => setFormData({ ...formData, enable_stock_alerts: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="border-t border-slate-200/80 pt-3 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-800 text-xs block">Sales Trend & Velocity Alerts</span>
                <span className="text-[11px] text-slate-500">Detect high-demand surges and slow-moving items</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enable_sales_trend_alerts}
                  onChange={(e) => setFormData({ ...formData, enable_sales_trend_alerts: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {/* High Demand Sensitivity */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">
                High-Demand Surge Threshold
              </label>
              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                +{formData.high_demand_threshold_pct}%
              </span>
            </div>
            <input
              type="range"
              min="20"
              max="100"
              step="5"
              value={formData.high_demand_threshold_pct}
              onChange={(e) => setFormData({ ...formData, high_demand_threshold_pct: parseFloat(e.target.value) })}
              className="w-full accent-amber-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Triggers a 🔥 High Demand alert when sales grow by at least +{formData.high_demand_threshold_pct}%.
            </p>
          </div>

          {/* Slow Moving Sensitivity */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">
                Slow-Moving Decline Threshold
              </label>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                {formData.slow_moving_threshold_pct}%
              </span>
            </div>
            <input
              type="range"
              min="-80"
              max="-20"
              step="5"
              value={formData.slow_moving_threshold_pct}
              onChange={(e) => setFormData({ ...formData, slow_moving_threshold_pct: parseFloat(e.target.value) })}
              className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Triggers a 📉 Slow Moving alert when sales drop by {formData.slow_moving_threshold_pct}% or more.
            </p>
          </div>

          {/* Critical Stock Level Ratio */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">
                Critical Stock Ratio (Very Low Stock)
              </label>
              <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                {Math.round(formData.critical_stock_ratio * 100)}% of Min Level
              </span>
            </div>
            <input
              type="range"
              min="0.2"
              max="0.8"
              step="0.05"
              value={formData.critical_stock_ratio}
              onChange={(e) => setFormData({ ...formData, critical_stock_ratio: parseFloat(e.target.value) })}
              className="w-full accent-red-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Marked as Critical when stock drops to or below {Math.round(formData.critical_stock_ratio * 100)}% of minimum threshold.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors font-medium cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset Defaults
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? "Saving..." : "Save Preferences"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

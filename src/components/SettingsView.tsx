import React, { useState } from "react";
import { Settings, Database, Shield, Save, CheckCircle, RefreshCw } from "lucide-react";

interface SettingsViewProps {
  onSyncSQLite?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onSyncSQLite }) => {
  const [bizName, setBizName] = useState("Smart Commerce Enterprises");
  const [currency, setCurrency] = useState("USD ($)");
  const [taxRate, setTaxRate] = useState("8.5");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Settings Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-bold text-slate-900">Application &amp; Business Settings</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure business information, default currency, stock alerts, and SQLite database connection
          </p>
        </div>

        {isSaved && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold animate-in fade-in duration-200">
            <CheckCircle className="w-4 h-4" />
            <span>Settings saved successfully</span>
          </div>
        )}
      </div>

      {/* Business Details Form */}
      <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
        <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
          General Business Information
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Business Legal Name</label>
            <input
              type="text"
              value={bizName}
              onChange={(e) => setBizName(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Base Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
            >
              <option value="USD ($)">USD - US Dollar ($)</option>
              <option value="EUR (€)">EUR - Euro (€)</option>
              <option value="GBP (£)">GBP - British Pound (£)</option>
              <option value="INR (₹)">INR - Indian Rupee (₹)</option>
              <option value="CAD ($)">CAD - Canadian Dollar ($)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Default Sales Tax Rate (%)</label>
            <input
              type="number"
              step="0.1"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Global Min Low-Stock Threshold</label>
            <input
              type="number"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-2xs cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Preferences</span>
          </button>
        </div>
      </form>

      {/* Database Integration Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">SQLite Database Integration</h3>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Active Connection
          </span>
        </div>

        <p className="text-xs text-slate-600">
          The application backend connects directly to <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 font-mono">smart_business_manager/business.db</code>.
          User credentials, sales records, products, and employee tables are synchronized with SQLite.
        </p>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Database Engine:</span>
            <span className="font-mono font-semibold text-slate-800">SQLite 3 / Python 3.12</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Database File:</span>
            <span className="font-mono font-semibold text-slate-800">smart_business_manager/business.db</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Password Hashing:</span>
            <span className="font-mono font-semibold text-slate-800">pbkdf2:sha256 (Werkzeug compatible)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Default Auth Account:</span>
            <span className="font-mono font-semibold text-slate-800">admin / admin123</span>
          </div>
        </div>

        {onSyncSQLite && (
          <div className="pt-2 flex justify-end">
            <button
              onClick={onSyncSQLite}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Verify &amp; Refresh Database Sync</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

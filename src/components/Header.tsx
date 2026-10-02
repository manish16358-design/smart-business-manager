import React from "react";
import { Menu, LogOut, ShieldCheck, Database, Calendar, Bell, Mic, Sparkles } from "lucide-react";
import { SidebarTab } from "../types";
import { GlobalSearch } from "./GlobalSearch";

interface HeaderProps {
  username: string;
  activeTab: SidebarTab;
  onOpenMobileSidebar: () => void;
  onLogout: () => void;
  sqliteConnected?: boolean;
  unreadAlertsCount?: number;
  onOpenAlerts?: () => void;
  onNavigateTab: (tab: SidebarTab) => void;
  onOpenVoiceAssistant?: () => void;
  onSelectSearchResult?: (type: "product" | "customer" | "sale" | "purchase" | "expense", item: any) => void;
}

export const Header: React.FC<HeaderProps> = ({
  username,
  activeTab,
  onOpenMobileSidebar,
  onLogout,
  sqliteConnected = true,
  unreadAlertsCount = 0,
  onOpenAlerts,
  onNavigateTab,
  onOpenVoiceAssistant,
  onSelectSearchResult,
}) => {
  const tabTitles: Record<SidebarTab, { title: string; subtitle: string }> = {
    dashboard: {
      title: "Business Dashboard",
      subtitle: "Overview of your daily metrics, sales, expenses and inventory",
    },
    employees: {
      title: "Employees Directory",
      subtitle: "Manage your team members, roles, and departmental staff",
    },
    sales: {
      title: "Sales & Invoicing",
      subtitle: "Record transactions, review customer invoices, and payment statuses",
    },
    expenses: {
      title: "Business Expenses",
      subtitle: "Track operating costs, rent, utilities, inventory, and supplier bills",
    },
    customers: {
      title: "Customer Management",
      subtitle: "Track client profiles, GSTIN details, order history, and pending balances",
    },
    suppliers: {
      title: "Supplier & Vendor Management",
      subtitle: "Manage vendors, procurement contracts, purchase history, and product intake",
    },
    purchases: {
      title: "Purchase Management",
      subtitle: "Record vendor procurement, track inventory stock intake, and review purchase history",
    },
    inventory: {
      title: "Inventory & Products",
      subtitle: "Product catalog, stock levels, reorder alerts, and retail pricing",
    },
    analytics: {
      title: "Business Analytics & Profit/Loss",
      subtitle: "Comprehensive P&L statements, product profitability, sales trends, and cost management",
    },
    reports: {
      title: "Financial & Sales Reports",
      subtitle: "Analyze revenue performance, margins, and profit breakdowns",
    },
    "ai-assistant": {
      title: "AI Business Assistant",
      subtitle: "Intelligent analytics, real-time database queries & operations advisor powered by Gemini",
    },
    settings: {
      title: "Business Settings",
      subtitle: "Configure business profile, currency preferences, and database synchronization",
    },
  };

  const currentTabInfo = tabTitles[activeTab] || tabTitles.dashboard;
  const todayFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <header className="sticky top-0 z-30 min-h-16 bg-white border-b border-slate-200 px-3 sm:px-6 py-2 flex flex-col md:flex-row items-center justify-between gap-2 sm:gap-4">
      {/* Left side: Hamburger + View title */}
      <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileSidebar}
            className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Open Navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
              {currentTabInfo.title}
            </h1>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              {currentTabInfo.subtitle}
            </p>
          </div>
        </div>

        {/* Mobile-only Voice Mic button */}
        <button
          type="button"
          onClick={onOpenVoiceAssistant}
          className="md:hidden p-2 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-xs cursor-pointer flex items-center gap-1 text-xs font-bold"
          title="Voice Assistant"
        >
          <Mic className="w-4 h-4" />
          <span>Voice</span>
        </button>
      </div>

      {/* Middle: GLOBAL SEARCH BAR (Requirement 1) */}
      <div className="w-full md:flex-1 max-w-md lg:max-w-lg">
        <GlobalSearch
          onNavigateTab={onNavigateTab}
          onSelectItem={onSelectSearchResult}
        />
      </div>

      {/* Right side: Voice Assistant, Alerts Bell, Database status, Date, User profile & Logout */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 w-full md:w-auto justify-end">
        {/* Desktop Voice Assistant Quick Launcher (Phase 5 Voice Assistant) */}
        <button
          type="button"
          onClick={onOpenVoiceAssistant}
          id="header-voice-assistant-btn"
          className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 font-bold text-xs shadow-2xs transition-all cursor-pointer hover:scale-102"
          title="Open Voice Business Assistant (Voice Commands & Inquiries)"
        >
          <Mic className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
          <span>Voice AI</span>
        </button>

        {/* Date chip */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-600">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{todayFormatted}</span>
        </div>

        {/* Database readiness badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] font-medium text-emerald-700">
          <Database className="w-3.5 h-3.5 text-emerald-600" />
          <span>SQLite Ready</span>
        </div>

        {/* Notification Bell Badge (Requirement 7) */}
        <button
          onClick={onOpenAlerts}
          id="header-notification-btn"
          className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
          title={`Smart Alerts & Notifications (${unreadAlertsCount} unread)`}
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadAlertsCount > 0 ? (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-extrabold shadow-2xs animate-pulse">
              {unreadAlertsCount > 99 ? "99+" : unreadAlertsCount}
            </span>
          ) : (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-slate-300"></span>
          )}
        </button>

        {/* User badge */}
        <div className="flex items-center gap-2 pl-2 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-full">
          <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-2xs">
            {username.charAt(0).toUpperCase()}
          </div>
          <span className="text-xs font-semibold text-slate-700 capitalize">
            {username}
          </span>
        </div>

        {/* Logout button */}
        <button
          onClick={onLogout}
          id="header-logout-btn"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-lg transition-colors cursor-pointer"
          title="Logout of Smart Business Manager"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
};

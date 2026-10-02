import React from "react";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Truck,
  ShoppingBag,
  DollarSign,
  Receipt,
  Package,
  FileBarChart,
  TrendingUp,
  Sparkles,
  Settings,
  LogOut,
  Building2,
  X,
} from "lucide-react";
import { SidebarTab } from "../types";

interface SidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onLogout: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  lowStockCount: number;
  unreadAlertsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  onLogout,
  mobileOpen,
  onCloseMobile,
  lowStockCount,
  unreadAlertsCount = 0,
}) => {
  const menuItems: { id: SidebarTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: <LayoutDashboard className="w-4 h-4" />,
      badge: unreadAlertsCount > 0 ? unreadAlertsCount : undefined,
    },
    {
      id: "employees",
      label: "Employees",
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: "customers",
      label: "Customers",
      icon: <UserCheck className="w-4 h-4" />,
    },
    {
      id: "suppliers",
      label: "Suppliers",
      icon: <Truck className="w-4 h-4" />,
    },
    {
      id: "purchases",
      label: "Purchases",
      icon: <ShoppingBag className="w-4 h-4" />,
    },
    {
      id: "sales",
      label: "Sales",
      icon: <DollarSign className="w-4 h-4" />,
    },
    {
      id: "expenses",
      label: "Expenses",
      icon: <Receipt className="w-4 h-4" />,
    },
    {
      id: "inventory",
      label: "Inventory",
      icon: <Package className="w-4 h-4" />,
      badge: lowStockCount > 0 ? lowStockCount : undefined,
    },
    {
      id: "analytics",
      label: "Analytics & P&L",
      icon: <TrendingUp className="w-4 h-4" />,
    },
    {
      id: "ai-assistant",
      label: "AI Assistant",
      icon: <Sparkles className="w-4 h-4 text-purple-400" />,
    },
    {
      id: "reports",
      label: "Reports",
      icon: <FileBarChart className="w-4 h-4" />,
    },
    {
      id: "settings",
      label: "Settings",
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  const handleSelect = (tab: SidebarTab) => {
    onTabChange(tab);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 text-slate-200 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-white text-sm tracking-tight">Smart Manager</div>
              <div className="text-[11px] text-slate-400">Business Control Hub</div>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
            aria-label="Close Sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Main Menu
          </div>
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`sidebar-${item.id}`}
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? "bg-blue-600 text-white shadow-xs font-semibold"
                    : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive ? "text-white" : "text-slate-400"}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      isActive ? "bg-white text-blue-600" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer with logout */}
        <div className="p-3 border-t border-slate-800">
          <button
            id="sidebar-logout"
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-red-400" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};

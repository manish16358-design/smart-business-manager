import React, { useState, useMemo } from "react";
import { ExpenseItem, ExpenseCategory } from "../types";
import { formatCurrency } from "../utils/formatters";
import {
  Receipt,
  Plus,
  Search,
  X,
  Edit3,
  Trash2,
  Calendar,
  Filter,
  BarChart3,
  PieChart,
  Building2,
  Users,
  Zap,
  Wifi,
  Truck,
  Package,
  Wrench,
  Megaphone,
  Tag,
  CreditCard,
  Smartphone,
  Banknote,
  Landmark,
  FileText,
  AlertTriangle,
  ArrowDownRight,
  TrendingDown,
  Clock,
  ChevronRight,
  ArrowUpDown,
  RotateCcw
} from "lucide-react";

interface ExpensesViewProps {
  expenses: ExpenseItem[];
  onAddExpense: (expense: Omit<ExpenseItem, "id">) => Promise<boolean> | void;
  onUpdateExpense?: (expense: ExpenseItem) => Promise<boolean> | void;
  onDeleteExpense?: (id: number) => Promise<boolean> | void;
  isLoading?: boolean;
}

export const EXPENSE_CATEGORIES: {
  label: ExpenseCategory;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
}[] = [
  {
    label: "Rent",
    description: "Office, showroom & warehouse lease",
    icon: Building2,
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200"
  },
  {
    label: "Salary",
    description: "Staff payroll, wages & advances",
    icon: Users,
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200"
  },
  {
    label: "Electricity",
    description: "Commercial power & utility charges",
    icon: Zap,
    color: "text-yellow-700",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200"
  },
  {
    label: "Internet",
    description: "Broadband, fiber & telecom bills",
    icon: Wifi,
    color: "text-cyan-700",
    bgColor: "bg-cyan-50",
    borderColor: "border-cyan-200"
  },
  {
    label: "Transport",
    description: "Freight, courier, delivery & fuel",
    icon: Truck,
    color: "text-indigo-700",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-200"
  },
  {
    label: "Stock Purchase",
    description: "Wholesale goods & supplier inventory",
    icon: Package,
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200"
  },
  {
    label: "Maintenance",
    description: "Repairs, AC servicing & cleaning",
    icon: Wrench,
    color: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200"
  },
  {
    label: "Marketing",
    description: "Ads, banners, social media & print",
    icon: Megaphone,
    color: "text-rose-700",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200"
  },
  {
    label: "Other",
    description: "Miscellaneous business expenses",
    icon: Tag,
    color: "text-slate-700",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200"
  }
];

export const PAYMENT_METHODS = ["Cash", "UPI", "Card", "Net Banking", "Cheque"] as const;

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  expenses,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense
}) => {
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("all");
  const [dateFilterPreset, setDateFilterPreset] = useState<string>("all");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [sortBy, setSortBy] = useState<"latest" | "oldest" | "highest" | "lowest" | "category">("latest");

  // Chart view toggle: "category" | "daily"
  const [chartView, setChartView] = useState<"category" | "daily">("category");

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<ExpenseItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add / Edit Form State
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState<ExpenseCategory>("Rent");
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [formPaymentMethod, setFormPaymentMethod] = useState<string>("UPI");
  const [formNotes, setFormNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Today & Month strings
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const currentMonthStr = useMemo(() => todayStr.slice(0, 7), [todayStr]); // YYYY-MM
  const currentMonthName = useMemo(() => {
    return new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  }, []);

  // Summary Metrics calculations
  const totalExpenses = useMemo(() => {
    return expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  }, [expenses]);

  const monthlyExpenses = useMemo(() => {
    return expenses
      .filter((e) => e.expense_date && e.expense_date.startsWith(currentMonthStr))
      .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  }, [expenses, currentMonthStr]);

  const todayExpenses = useMemo(() => {
    return expenses
      .filter((e) => e.expense_date === todayStr)
      .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  }, [expenses, todayStr]);

  const todayExpensesCount = useMemo(() => {
    return expenses.filter((e) => e.expense_date === todayStr).length;
  }, [expenses, todayStr]);

  // Category breakdown for summary card and chart
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    expenses.forEach((e) => {
      const cat = e.category || "Other";
      const amt = Number(e.amount) || 0;
      if (!map[cat]) {
        map[cat] = { total: 0, count: 0 };
      }
      map[cat].total += amt;
      map[cat].count += 1;
    });

    return Object.entries(map)
      .map(([category, data]) => ({
        category,
        amount: data.total,
        count: data.count,
        percent: totalExpenses > 0 ? (data.total / totalExpenses) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, totalExpenses]);

  const topCategory = categoryBreakdown[0] || null;

  // 7-day daily trend for summary chart
  const dailyTrend = useMemo(() => {
    const days: { date: string; label: string; amount: number; count: number }[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = d.toISOString().split("T")[0];
      const lbl = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
      const dayExp = expenses.filter((e) => e.expense_date === iso);
      const dayTotal = dayExp.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
      days.push({
        date: iso,
        label: lbl,
        amount: dayTotal,
        count: dayExp.length
      });
    }
    return days;
  }, [expenses]);

  const maxDailyAmount = useMemo(() => {
    return Math.max(...dailyTrend.map((d) => d.amount), 1);
  }, [dailyTrend]);

  // Filtered Expenses logic
  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

    // Last month calculation
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthPrefix = lastMonthDate.toISOString().slice(0, 7);

    return expenses.filter((exp) => {
      // 1. Search Query
      const q = searchTerm.toLowerCase().trim();
      const title = (exp.title || exp.description || "").toLowerCase();
      const cat = (exp.category || "").toLowerCase();
      const notes = (exp.notes || "").toLowerCase();
      const method = (exp.payment_method || "").toLowerCase();
      const idStr = `exp-${exp.id}`;

      const matchesSearch =
        !q ||
        title.includes(q) ||
        cat.includes(q) ||
        notes.includes(q) ||
        method.includes(q) ||
        idStr.includes(q);

      // 2. Category Filter
      const matchesCategory =
        selectedCategory === "all" || exp.category === selectedCategory;

      // 3. Payment Method Filter
      const matchesPaymentMethod =
        selectedPaymentMethod === "all" ||
        (exp.payment_method || "UPI").toLowerCase() === selectedPaymentMethod.toLowerCase();

      // 4. Date Filter Presets
      const expDate = exp.expense_date || "";
      let matchesDate = true;
      if (dateFilterPreset === "today") {
        matchesDate = expDate === todayStr;
      } else if (dateFilterPreset === "yesterday") {
        matchesDate = expDate === yesterdayStr;
      } else if (dateFilterPreset === "7days") {
        matchesDate = expDate >= sevenDaysAgoStr && expDate <= todayStr;
      } else if (dateFilterPreset === "this_month") {
        matchesDate = expDate.startsWith(currentMonthStr);
      } else if (dateFilterPreset === "last_month") {
        matchesDate = expDate.startsWith(lastMonthPrefix);
      } else if (dateFilterPreset === "custom") {
        if (customStartDate && expDate < customStartDate) matchesDate = false;
        if (customEndDate && expDate > customEndDate) matchesDate = false;
      }

      return matchesSearch && matchesCategory && matchesPaymentMethod && matchesDate;
    }).sort((a, b) => {
      if (sortBy === "latest") {
        return new Date(b.expense_date || "").getTime() - new Date(a.expense_date || "").getTime() || b.id - a.id;
      }
      if (sortBy === "oldest") {
        return new Date(a.expense_date || "").getTime() - new Date(b.expense_date || "").getTime() || a.id - b.id;
      }
      if (sortBy === "highest") {
        return (Number(b.amount) || 0) - (Number(a.amount) || 0);
      }
      if (sortBy === "lowest") {
        return (Number(a.amount) || 0) - (Number(b.amount) || 0);
      }
      if (sortBy === "category") {
        return (a.category || "").localeCompare(b.category || "");
      }
      return 0;
    });
  }, [
    expenses,
    searchTerm,
    selectedCategory,
    selectedPaymentMethod,
    dateFilterPreset,
    customStartDate,
    customEndDate,
    sortBy,
    todayStr,
    currentMonthStr
  ]);

  const filteredTotal = useMemo(() => {
    return filteredExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  }, [filteredExpenses]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setFormTitle("");
    setFormCategory("Rent");
    setFormAmount("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormPaymentMethod("UPI");
    setFormNotes("");
    setFormError(null);
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (exp: ExpenseItem) => {
    setEditingExpense(exp);
    setFormTitle(exp.title || exp.description || "");
    setFormCategory(
      (EXPENSE_CATEGORIES.some((c) => c.label === exp.category)
        ? exp.category
        : "Other") as ExpenseCategory
    );
    setFormAmount(exp.amount ? exp.amount.toString() : "");
    setFormDate(exp.expense_date || new Date().toISOString().split("T")[0]);
    setFormPaymentMethod(exp.payment_method || "UPI");
    setFormNotes(exp.notes || "");
    setFormError(null);
  };

  // Submit Add Expense
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formTitle.trim()) {
      setFormError("Expense Title is required.");
      return;
    }

    const amt = parseFloat(formAmount);
    if (isNaN(amt) || amt <= 0) {
      setFormError("Please enter a valid amount greater than ₹0.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddExpense({
        title: formTitle.trim(),
        category: formCategory,
        amount: amt,
        expense_date: formDate,
        payment_method: formPaymentMethod,
        notes: formNotes.trim(),
        description: formTitle.trim()
      });
      setIsAddModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || "Failed to save expense.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit Expense
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    setFormError(null);

    if (!formTitle.trim()) {
      setFormError("Expense Title is required.");
      return;
    }

    const amt = parseFloat(formAmount);
    if (isNaN(amt) || amt <= 0) {
      setFormError("Please enter a valid amount greater than ₹0.");
      return;
    }

    if (!onUpdateExpense) {
      setFormError("Update functionality is not available.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onUpdateExpense({
        ...editingExpense,
        title: formTitle.trim(),
        category: formCategory,
        amount: amt,
        expense_date: formDate,
        payment_method: formPaymentMethod,
        notes: formNotes.trim(),
        description: formTitle.trim()
      });
      setEditingExpense(null);
    } catch (err: any) {
      setFormError(err.message || "Failed to update expense.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Execute Delete
  const handleConfirmDelete = async () => {
    if (!deletingExpense || !onDeleteExpense) return;
    setIsSubmitting(true);
    try {
      await onDeleteExpense(deletingExpense.id);
      setDeletingExpense(null);
    } catch (err: any) {
      console.warn("Error deleting expense:", err);
      setDeletingExpense(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to get category metadata
  const getCategoryMeta = (categoryName: string) => {
    const meta = EXPENSE_CATEGORIES.find(
      (c) => c.label.toLowerCase() === (categoryName || "").toLowerCase()
    );
    if (meta) return meta;
    return {
      label: (categoryName || "Other") as ExpenseCategory,
      description: "Business expense",
      icon: Tag,
      color: "text-slate-700",
      bgColor: "bg-slate-100",
      borderColor: "border-slate-200"
    };
  };

  // Helper for payment method icons
  const renderPaymentBadge = (method?: string) => {
    const m = (method || "UPI").toLowerCase();
    if (m === "upi") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          <Smartphone className="w-3 h-3" />
          UPI
        </span>
      );
    }
    if (m === "cash") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Banknote className="w-3 h-3" />
          Cash
        </span>
      );
    }
    if (m === "card") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <CreditCard className="w-3 h-3" />
          Card
        </span>
      );
    }
    if (m.includes("net") || m.includes("bank")) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
          <Landmark className="w-3 h-3" />
          Net Banking
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
        <FileText className="w-3 h-3" />
        {method || "Other"}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP SUMMARY CARDS (Requirement 4, 10, 11, 13) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Expenses Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Expenses
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
              {formatCurrency(totalExpenses)}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
              <span>{expenses.length} total receipts logged</span>
              <span className="text-rose-600 font-semibold font-mono">All Time</span>
            </div>
          </div>
        </div>

        {/* This Month's Expenses Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              This Month's Outflows
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-amber-600 tracking-tight font-mono">
              {formatCurrency(monthlyExpenses)}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
              <span>Current billing period</span>
              <span className="text-amber-700 font-medium">{currentMonthName}</span>
            </div>
          </div>
        </div>

        {/* Today's Expenses Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Today's Expenses
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-blue-600 tracking-tight font-mono">
              {formatCurrency(todayExpenses)}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
              <span>{todayExpensesCount} {todayExpensesCount === 1 ? "entry" : "entries"} recorded</span>
              <span className="text-blue-600 font-medium">Today</span>
            </div>
          </div>
        </div>

        {/* Top Spending Category Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Top Expense Category
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-slate-900 truncate">
              {topCategory ? topCategory.category : "None"}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
              <span className="font-mono font-semibold text-slate-700">
                {topCategory ? formatCurrency(topCategory.amount) : "₹0"}
              </span>
              <span className="text-purple-600 font-semibold">
                {topCategory ? `${topCategory.percent.toFixed(1)}% of total` : "0%"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SIMPLE EXPENSE SUMMARY CHART (Requirement 11, 12, 13) */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              {chartView === "category" ? (
                <PieChart className="w-4 h-4" />
              ) : (
                <BarChart3 className="w-4 h-4" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {chartView === "category" ? "Expense Breakdown by Category" : "7-Day Daily Expense Trend"}
              </h3>
              <p className="text-[11px] text-slate-500">
                {chartView === "category"
                  ? "Real-time distribution across business cost categories"
                  : "Daily operational outflows over the past 7 business days"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto text-xs font-semibold">
            <button
              onClick={() => setChartView("category")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                chartView === "category"
                  ? "bg-white text-rose-600 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <PieChart className="w-3.5 h-3.5" />
              <span>Category Breakdown</span>
            </button>
            <button
              onClick={() => setChartView("daily")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                chartView === "daily"
                  ? "bg-white text-rose-600 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Daily Trend (7 Days)</span>
            </button>
          </div>
        </div>

        {/* View A: Category Breakdown */}
        {chartView === "category" && (
          <div>
            {categoryBreakdown.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No expense data logged yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 pt-2">
                {categoryBreakdown.map((item) => {
                  const meta = getCategoryMeta(item.category);
                  const Icon = meta.icon;
                  return (
                    <div key={item.category} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`p-1.5 rounded-md ${meta.bgColor} ${meta.color}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </span>
                          <span className="font-semibold text-slate-800">{item.category}</span>
                          <span className="text-[10px] text-slate-400">({item.count})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">
                            {formatCurrency(item.amount)}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500 w-10 text-right">
                            {item.percent.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-rose-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, item.percent)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* View B: 7-Day Daily Trend */}
        {chartView === "daily" && (
          <div className="pt-2">
            <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-44 pt-4 border-b border-slate-100 pb-2">
              {dailyTrend.map((day) => {
                const heightPercent = maxDailyAmount > 0 ? (day.amount / maxDailyAmount) * 100 : 0;
                const isToday = day.date === todayStr;
                return (
                  <div key={day.date} className="flex flex-col items-center justify-end h-full group relative">
                    {/* Tooltip on hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-slate-900 text-white text-[10px] px-2 py-1 rounded-md pointer-events-none whitespace-nowrap z-10 shadow-lg font-mono">
                      {formatCurrency(day.amount)} ({day.count} {day.count === 1 ? "exp" : "exps"})
                    </div>

                    <div className="w-full max-w-[36px] bg-slate-100 rounded-t-lg relative flex items-end justify-center h-28 overflow-hidden">
                      <div
                        className={`w-full rounded-t-md transition-all duration-500 ${
                          isToday
                            ? "bg-gradient-to-t from-rose-600 to-rose-400 shadow-sm"
                            : "bg-gradient-to-t from-rose-400 to-rose-300 group-hover:from-rose-500 group-hover:to-rose-400"
                        }`}
                        style={{ height: `${Math.max(6, heightPercent)}%` }}
                      />
                    </div>

                    <div className="mt-2 text-center">
                      <div className={`text-[10px] font-semibold truncate ${isToday ? "text-rose-600" : "text-slate-600"}`}>
                        {day.label}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                        {day.amount > 0 ? `₹${Math.round(day.amount)}` : "—"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2">
              <span>Hover bars for exact daily expense breakdown</span>
              <span className="font-semibold text-slate-600">
                7-Day Total: {formatCurrency(dailyTrend.reduce((acc, d) => acc + d.amount, 0))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3. CONTROLS, SEARCH, FILTERS & ADD BUTTON (Requirement 1, 3, 6) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-rose-600" />
              <h2 className="text-base font-bold text-slate-900">Expenses Log &amp; Outflows</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Record, audit, and track operational overheads with instant database persistence
            </p>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all shadow-sm hover:shadow-md cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Expense</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search title, category, notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:bg-white"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:bg-white"
            >
              <option value="all">All Categories ({expenses.length})</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat.label} value={cat.label}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Preset Filter */}
          <div>
            <select
              value={dateFilterPreset}
              onChange={(e) => setDateFilterPreset(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:bg-white"
            >
              <option value="all">All Dates</option>
              <option value="today">Today Only</option>
              <option value="yesterday">Yesterday</option>
              <option value="7days">Past 7 Days</option>
              <option value="this_month">This Month ({currentMonthName})</option>
              <option value="last_month">Last Month</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <select
              value={selectedPaymentMethod}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:bg-white"
            >
              <option value="all">All Payment Methods</option>
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm} value={pm}>
                  {pm}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:bg-white font-medium"
            >
              <option value="latest">Sort: Latest First</option>
              <option value="oldest">Sort: Oldest First</option>
              <option value="highest">Sort: Highest Amount</option>
              <option value="lowest">Sort: Lowest Amount</option>
              <option value="category">Sort: Category (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Reset Filter Action when any filter is active */}
        {(searchTerm || selectedCategory !== "all" || selectedPaymentMethod !== "all" || dateFilterPreset !== "all" || sortBy !== "latest") && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-500">
              Showing {filteredExpenses.length} filtered expense(s)
            </span>
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedCategory("all");
                setSelectedPaymentMethod("all");
                setDateFilterPreset("all");
                setCustomStartDate("");
                setCustomEndDate("");
                setSortBy("latest");
              }}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          </div>
        )}

        {/* Optional Custom Date Range Inputs */}
        {dateFilterPreset === "custom" && (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <span className="font-semibold text-slate-700">Custom Date Range:</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
            </div>
            {(customStartDate || customEndDate) && (
              <button
                onClick={() => {
                  setCustomStartDate("");
                  setCustomEndDate("");
                }}
                className="text-[11px] text-rose-600 hover:underline cursor-pointer"
              >
                Clear Dates
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4. EXPENSE HISTORY TABLE (Requirement 5, 7, 13, 14) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Table Header Summary */}
        <div className="p-4 sm:px-6 bg-slate-50/70 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="text-slate-600">
            Showing <strong className="text-slate-900">{filteredExpenses.length}</strong> of{" "}
            <strong className="text-slate-900">{expenses.length}</strong> recorded expenses
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <span>Filtered Total:</span>
            <span className="font-mono font-bold text-rose-600 text-sm">
              {formatCurrency(filteredTotal)}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                <th className="py-3 px-4 sm:px-6">Expense Title &amp; ID</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4">Notes / Remarks</th>
                <th className="py-3 px-4 text-right">Date</th>
                <th className="py-3 px-4 text-right">Amount (₹)</th>
                <th className="py-3 px-4 sm:px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Receipt className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-medium text-slate-600">No expenses found</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {searchTerm || selectedCategory !== "all" || dateFilterPreset !== "all"
                        ? "Try clearing filters to view all recorded expenses."
                        : "Click 'Add New Expense' above to log your first business expense."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => {
                  const meta = getCategoryMeta(exp.category);
                  const Icon = meta.icon;
                  const displayTitle = exp.title || exp.description || "Expense Item";

                  return (
                    <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Title & ID */}
                      <td className="py-3.5 px-4 sm:px-6 font-semibold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-lg ${meta.bgColor} ${meta.color} shrink-0`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{displayTitle}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              EXP-{exp.id.toString().padStart(4, "0")}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${meta.bgColor} ${meta.color} ${meta.borderColor}`}
                        >
                          <Icon className="w-3 h-3" />
                          {exp.category}
                        </span>
                      </td>

                      {/* Payment Method */}
                      <td className="py-3.5 px-4">
                        {renderPaymentBadge(exp.payment_method)}
                      </td>

                      {/* Notes */}
                      <td className="py-3.5 px-4 max-w-xs truncate text-slate-500 text-[11px]">
                        {exp.notes ? (
                          <span title={exp.notes} className="truncate block">
                            {exp.notes}
                          </span>
                        ) : (
                          <span className="text-slate-300 italic">—</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-right font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {exp.expense_date}
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 text-right font-bold text-rose-600 font-mono text-sm whitespace-nowrap">
                        {formatCurrency(exp.amount)}
                      </td>

                      {/* Actions: Edit & Delete (Requirement 7, 8) */}
                      <td className="py-3.5 px-4 sm:px-6 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditModal(exp)}
                            title="Edit Expense"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingExpense(exp)}
                            title="Delete Expense"
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. ADD NEW EXPENSE MODAL (Requirement 1, 2, 3, 9) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add New Expense</h3>
                  <p className="text-[11px] text-slate-500">Record a business expenditure</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4 pt-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Expense Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Commercial Office Rent / High-Speed Internet"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                />
              </div>

              {/* Category & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as ExpenseCategory)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden bg-white"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.label} value={c.label}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              {/* Date & Payment Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden bg-white"
                  >
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm} value={pm}>
                        {pm}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes / Reference (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Invoice #8824 paid to Airtel Xstream via UPI"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. EDIT EXPENSE MODAL (Requirement 7, 9) */}
      {editingExpense && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Edit Expense</h3>
                  <p className="text-[11px] text-slate-500">
                    Modify expense EXP-{editingExpense.id.toString().padStart(4, "0")}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingExpense(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4 pt-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Expense Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                />
              </div>

              {/* Category & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as ExpenseCategory)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden bg-white"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.label} value={c.label}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              {/* Date & Payment Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden bg-white"
                  >
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm} value={pm}>
                        {pm}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes / Reference
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setEditingExpense(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Updating..." : "Update Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. DELETE CONFIRMATION MODAL (Requirement 8) */}
      {deletingExpense && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 bg-rose-100 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Confirm Deletion</h3>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Are you sure you want to permanently delete this expense? This action will remove the record from your database and adjust total outflows.
            </p>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 mb-5 space-y-1.5 text-xs">
              <div className="font-bold text-slate-900">
                {deletingExpense.title || deletingExpense.description}
              </div>
              <div className="flex items-center justify-between text-slate-500 text-[11px]">
                <span>Category: {deletingExpense.category}</span>
                <span className="font-mono">{deletingExpense.expense_date}</span>
              </div>
              <div className="text-rose-600 font-mono font-bold text-sm pt-1 border-t border-slate-200/60">
                {formatCurrency(deletingExpense.amount)}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setDeletingExpense(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Keep Expense
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isSubmitting ? "Deleting..." : "Delete Permanently"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from "react";
import {
  SidebarTab,
  DashboardMetrics,
  SaleItem,
  ExpenseItem,
  ProductItem,
  EmployeeItem,
  ChartDayData,
  CustomerItem,
  SupplierItem,
  PurchaseItem,
  StockMovementItem,
  SmartAlertItem,
  AlertSettingsConfig,
} from "../types";
import { formatCurrency } from "../utils/formatters";
import {
  initialSales,
  initialExpenses,
  initialProducts,
  initialEmployees,
  initialChartData,
} from "../data/sampleData";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MetricCards } from "./MetricCards";
import { SalesProfitChart } from "./SalesProfitChart";
import { RecentSalesTable } from "./RecentSalesTable";
import { LowStockAlerts } from "./LowStockAlerts";
import { EmployeesView } from "./EmployeesView";
import { SalesView } from "./SalesView";
import { ExpensesView } from "./ExpensesView";
import { InventoryView } from "./InventoryView";
import { ReportsView } from "./ReportsView";
import { SettingsView } from "./SettingsView";
import { CustomersView } from "./CustomersView";
import { SuppliersView } from "./SuppliersView";
import { PurchasesView } from "./PurchasesView";
import { DashboardAnalyticsSection } from "./DashboardAnalyticsSection";
import { AnalyticsView } from "./AnalyticsView";
import { AIAssistantView } from "./AIAssistantView";
import { SmartAlertsSection } from "./SmartAlertsSection";
import { SmartAlertsModal } from "./SmartAlertsModal";
import { AlertSettingsModal } from "./AlertSettingsModal";
import { VoiceAssistantModal } from "./VoiceAssistantModal";
import { PlusCircle, ShoppingBag, Receipt, PackagePlus, UserCheck, Truck, TrendingUp, Sparkles, Bot } from "lucide-react";

interface DashboardPageProps {
  username: string;
  onLogout: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ username, onLogout }) => {
  const [activeTab, setActiveTab] = useState<SidebarTab>("dashboard");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Business data state
  const [sales, setSales] = useState<SaleItem[]>(initialSales);
  const [expenses, setExpenses] = useState<ExpenseItem[]>(initialExpenses);
  const [products, setProducts] = useState<ProductItem[]>(initialProducts);
  const [employees, setEmployees] = useState<EmployeeItem[]>(initialEmployees);
  const [customers, setCustomers] = useState<CustomerItem[]>(() => {
    try {
      const cached = localStorage.getItem("sbm_customers_cache");
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  });
  const [suppliers, setSuppliers] = useState<SupplierItem[]>(() => {
    try {
      const cached = localStorage.getItem("sbm_suppliers_cache");
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  });
  const [purchases, setPurchases] = useState<PurchaseItem[]>(() => {
    try {
      const cached = localStorage.getItem("sbm_purchases_cache");
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  });
  const [stockMovements, setStockMovements] = useState<StockMovementItem[]>([]);
  const [chartData, setChartData] = useState<ChartDayData[]>(initialChartData);
  const [sqliteConnected, setSqliteConnected] = useState(true);
  const [todayOrdersCount, setTodayOrdersCount] = useState<number | undefined>(undefined);
  const [todaySalesBackend, setTodaySalesBackend] = useState<number | undefined>(undefined);

  // Smart Inventory & Sales Alert System State (Requirement 1-12)
  const [alerts, setAlerts] = useState<SmartAlertItem[]>([]);
  const [unreadAlertsCount, setUnreadAlertsCount] = useState<number>(0);
  const [alertSettings, setAlertSettings] = useState<AlertSettingsConfig>({
    analysis_period_days: 7,
    high_demand_threshold_pct: 40.0,
    slow_moving_threshold_pct: -40.0,
    min_sales_for_trend: 1,
    enable_stock_alerts: true,
    enable_sales_trend_alerts: true,
    critical_stock_ratio: 0.5,
  });
  const [productAlertTags, setProductAlertTags] = useState<Record<number, string[]>>({});
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState(false);
  const [isAlertSettingsOpen, setIsAlertSettingsOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Sync with SQLite backend
  const fetchAlerts = () => {
    fetch("/api/alerts")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch smart alerts");
        return res.json();
      })
      .then((data) => {
        if (data && data.success) {
          setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
          setUnreadAlertsCount(typeof data.unread_count === "number" ? data.unread_count : 0);
          if (data.product_alert_tags) {
            setProductAlertTags(data.product_alert_tags);
          }
          if (data.settings) {
            setAlertSettings(data.settings);
          }
        }
      })
      .catch((err) => {
        console.warn("Alerts fetch fallback/notice:", err);
      });
  };

  const handleMarkAlertRead = async (id: number) => {
    try {
      const res = await fetch(`/api/alerts/${id}/read`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setAlerts((prev) =>
          prev.map((a) => (a.id === id ? { ...a, is_read: data.is_read } : a))
        );
        setUnreadAlertsCount((prev) =>
          typeof data.unread_count === "number" ? data.unread_count : Math.max(0, prev - 1)
        );
      }
    } catch (err) {
      console.error("Mark read error:", err);
    }
  };

  const handleMarkAllAlertsRead = async () => {
    try {
      const res = await fetch(`/api/alerts/mark-all-read`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
        setUnreadAlertsCount(0);
        showToast("All notifications marked as read");
      }
    } catch (err) {
      console.error("Mark all read error:", err);
    }
  };

  const handleDismissAlert = async (id: number) => {
    try {
      const res = await fetch(`/api/alerts/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
        setUnreadAlertsCount((prev) =>
          typeof data.unread_count === "number" ? data.unread_count : Math.max(0, prev - 1)
        );
        showToast("Alert dismissed");
      }
    } catch (err) {
      console.error("Dismiss alert error:", err);
    }
  };

  const handleSaveAlertSettings = async (newSettings: AlertSettingsConfig) => {
    try {
      const res = await fetch("/api/alerts/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      });
      const data = await res.json();
      if (data.success) {
        setAlertSettings(newSettings);
        fetchAlerts();
        showToast("Alert preferences updated successfully");
      } else {
        throw new Error(data.error || "Failed to update alert settings");
      }
    } catch (err: any) {
      console.error("Save settings error:", err);
      showToast(err.message || "Failed to save alert settings");
      throw err;
    }
  };

  const handleQuickRestockFromAlert = async (productId?: number, productName?: string, suggestedQty?: number) => {
    let target = products.find((p) => p.id === productId);
    if (!target && productName) {
      target = products.find((p) => p.name.toLowerCase() === productName.toLowerCase());
    }
    if (target) {
      const qty = suggestedQty && suggestedQty > 0 ? suggestedQty : Math.max(5, target.min_stock_level * 2);
      try {
        await handleAdjustStock(
          target.id,
          "add",
          qty,
          `Quick restock via Smart Alert recommendation (+${qty} units)`
        );
        fetchAlerts();
      } catch (err: any) {
        showToast(err.message || "Failed to restock");
      }
    } else {
      setActiveTab("inventory");
      showToast("Product selected. Opening Inventory.");
    }
  };

  // Sync with SQLite backend
  const fetchEmployees = () => {
    fetch("/api/employees")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch employees");
        return res.json();
      })
      .then((data) => {
        if (data && data.success && Array.isArray(data.employees) && data.employees.length > 0) {
          setEmployees(data.employees);
        }
      })
      .catch((err) => {
        console.warn("Using sample employees fallback:", err);
      });
  };

  const fetchSales = () => {
    fetch("/api/sales")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch sales");
        return res.json();
      })
      .then((data) => {
        if (data && data.success && Array.isArray(data.sales)) {
          setSales(data.sales);
        }
      })
      .catch((err) => {
        console.warn("Using local sales fallback:", err);
      });
  };

  const fetchExpenses = () => {
    fetch("/api/expenses")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch expenses");
        return res.json();
      })
      .then((data) => {
        if (data && data.success && Array.isArray(data.expenses)) {
          setExpenses(data.expenses);
        }
      })
      .catch((err) => {
        console.warn("Using local expenses fallback:", err);
      });
  };

  const fetchProducts = () => {
    fetch("/api/products")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch products");
        return res.json();
      })
      .then((data) => {
        if (data && data.success && Array.isArray(data.products)) {
          setProducts(data.products);
        }
      })
      .catch((err) => {
        console.warn("Using local products fallback:", err);
      });
  };

  const fetchStockMovements = () => {
    fetch("/api/stock-movements")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch stock movements");
        return res.json();
      })
      .then((data) => {
        if (data && data.success && Array.isArray(data.movements)) {
          setStockMovements(data.movements);
        }
      })
      .catch((err) => {
        console.warn("Stock movements fetch fallback:", err);
      });
  };

  const fetchCustomers = () => {
    fetch("/api/customers")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch customers");
        return res.json();
      })
      .then((data) => {
        if (data && data.success && Array.isArray(data.customers)) {
          setCustomers(data.customers);
          try {
            localStorage.setItem("sbm_customers_cache", JSON.stringify(data.customers));
          } catch {}
        }
      })
      .catch((err) => {
        console.warn("Customers fetch fallback:", err);
      });
  };

  const fetchSuppliers = () => {
    fetch("/api/suppliers")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch suppliers");
        return res.json();
      })
      .then((data) => {
        if (data && data.success && Array.isArray(data.suppliers)) {
          setSuppliers(data.suppliers);
          try {
            localStorage.setItem("sbm_suppliers_cache", JSON.stringify(data.suppliers));
          } catch {}
        }
      })
      .catch((err) => {
        console.warn("Suppliers fetch fallback:", err);
      });
  };

  const fetchPurchases = () => {
    fetch("/api/purchases")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch purchases");
        return res.json();
      })
      .then((data) => {
        if (data && data.success && Array.isArray(data.purchases)) {
          setPurchases(data.purchases);
          try {
            localStorage.setItem("sbm_purchases_cache", JSON.stringify(data.purchases));
          } catch {}
        }
      })
      .catch((err) => {
        console.warn("Purchases fetch fallback:", err);
      });
  };

  const fetchMetrics = () => {
    fetch("/api/metrics")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch SQLite metrics");
        return res.json();
      })
      .then((data) => {
        setSqliteConnected(true);
        if (data.today_orders !== undefined) {
          setTodayOrdersCount(data.today_orders);
        }
        if (data.today_sales !== undefined) {
          setTodaySalesBackend(data.today_sales);
        }
        if (Array.isArray(data.chart_data) && data.chart_data.length > 0) {
          setChartData(data.chart_data);
        }
      })
      .catch((err) => {
        console.warn("Metrics fetch error:", err);
      });
  };

  useEffect(() => {
    fetchEmployees();
    fetchSales();
    fetchExpenses();
    fetchProducts();
    fetchCustomers();
    fetchSuppliers();
    fetchPurchases();
    fetchStockMovements();
    fetchMetrics();
    fetchAlerts();
  }, []);

  // Today string YYYY-MM-DD
  const todayStr = new Date().toISOString().split("T")[0];

  // Calculate dynamic metrics
  const total_sales = sales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
  const total_expenses = expenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const total_profit = total_sales - total_expenses;
  const total_products = products.length;
  const total_stock_items = products.reduce((acc, p) => acc + (Number(p.stock_quantity) || 0), 0);
  const out_of_stock_count = products.filter((p) => (Number(p.stock_quantity) || 0) <= 0).length;
  const low_stock_products = products.filter(
    (p) => (Number(p.stock_quantity) || 0) > 0 && (Number(p.stock_quantity) || 0) <= p.min_stock_level
  );
  const low_stock_count = low_stock_products.length;
  const total_employees = employees.length;
  const active_employees = employees.filter(
    (e) => (e.status || "").toLowerCase() === "active"
  ).length;
  const inactive_employees = total_employees - active_employees;
  const activeAnnualPayroll = employees
    .filter((e) => (e.status || "").toLowerCase() === "active")
    .reduce((acc, curr) => acc + (Number(curr.salary) || 0), 0);
  const monthly_payroll = Math.round(activeAnnualPayroll / 12);

  const todaySalesList = sales.filter((s) => s.sale_date === todayStr);
  const today_sales =
    todaySalesBackend !== undefined
      ? todaySalesBackend
      : todaySalesList.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);

  const todayExpensesList = expenses.filter((e) => e.expense_date === todayStr);
  const today_expenses = todayExpensesList.reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const today_profit = today_sales - today_expenses;

  const metrics: DashboardMetrics = {
    total_sales,
    total_expenses,
    total_profit,
    total_products,
    total_stock_items,
    low_stock_count,
    out_of_stock_count,
    low_stock_products,
    total_employees,
    active_employees,
    inactive_employees,
    monthly_payroll,
    today_sales,
    today_expenses,
    today_profit,
    recent_sales: sales,
    chart_data: chartData,
  };

  // Handlers for adding data
  const handleAddSale = async (saleData: any): Promise<boolean> => {
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saleData),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to record sale.");
      }

      const createdSale: SaleItem = data.sale;
      // Prepend to current sales list
      setSales((prev) => [createdSale, ...prev]);

      // Automatically refresh inventory and metrics from SQLite
      fetchProducts();
      fetchStockMovements();
      fetchCustomers();
      fetchMetrics();
      fetchAlerts();

      showToast(
        data.message ||
          `Invoice ${createdSale.invoice_no || `INV-${createdSale.id}`} saved! Product inventory updated.`
      );
      return true;
    } catch (err: any) {
      console.error("Sale creation error:", err);
      // Re-throw so NewSaleModal displays the exact stock rejection error!
      showToast(err.message || "Failed to record sale.");
      throw err;
    }
  };

  const handleUpdateSale = async (
    id: number,
    updatedFields: Partial<SaleItem>
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/sales/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedFields),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update sale.");
      }

      const updatedRecord: SaleItem = data.sale;
      setSales((prev) => prev.map((s) => (s.id === id ? { ...s, ...updatedRecord } : s)));
      fetchCustomers();
      fetchMetrics();
      showToast(data.message || "Sale details updated successfully!");
      return true;
    } catch (err: any) {
      console.warn("Offline sale update:", err);
      setSales((prev) => prev.map((s) => (s.id === id ? { ...s, ...updatedFields } : s)));
      showToast("Sale details updated!");
      return true;
    }
  };

  const handleDeleteSale = async (id: number): Promise<boolean> => {
    try {
      const res = await fetch(`/api/sales/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete sale.");
      }

      setSales((prev) => prev.filter((s) => s.id !== id));
      // Re-fetch products as stock was restored in SQLite!
      fetchProducts();
      fetchCustomers();
      fetchMetrics();
      showToast(data.message || "Sale deleted and inventory stock restored successfully!");
      return true;
    } catch (err: any) {
      console.warn("Offline sale delete:", err);
      setSales((prev) => prev.filter((s) => s.id !== id));
      fetchProducts();
      showToast("Sale deleted.");
      return true;
    }
  };

  // Customer Management Handlers (Requirement 4, 8, 9, 10)
  const handleAddCustomer = async (newCustomerData: Partial<CustomerItem>): Promise<boolean> => {
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCustomerData),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to add customer.");
      }
      fetchCustomers();
      showToast(data.message || `Customer "${newCustomerData.name}" registered successfully!`);
      return true;
    } catch (err: any) {
      console.error("Add customer error:", err);
      showToast(err.message || "Failed to register customer.");
      throw err;
    }
  };

  const handleUpdateCustomer = async (id: number, customerData: Partial<CustomerItem>): Promise<boolean> => {
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customerData),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update customer.");
      }
      fetchCustomers();
      showToast(data.message || "Customer details updated successfully!");
      return true;
    } catch (err: any) {
      console.error("Update customer error:", err);
      showToast(err.message || "Failed to update customer.");
      throw err;
    }
  };

  const handleDeleteCustomer = async (id: number): Promise<boolean> => {
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete customer.");
      }
      setCustomers((prev) => {
        const next = prev.filter((c) => c.id !== id);
        try {
          localStorage.setItem("sbm_customers_cache", JSON.stringify(next));
        } catch {}
        return next;
      });
      showToast(data.message || "Customer removed from directory.");
      return true;
    } catch (err: any) {
      console.error("Delete customer error:", err);
      showToast(err.message || "Failed to delete customer.");
      return false;
    }
  };

  const handleRecordCustomerPayment = async (
    customerId: number,
    saleId: number,
    method: string = "UPI"
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/customers/${customerId}/pay-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sale_id: saleId, payment_method: method }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to record payment.");
      }
      fetchSales();
      fetchCustomers();
      fetchMetrics();
      showToast("Payment recorded successfully! Invoice marked as Paid.");
      return true;
    } catch (err: any) {
      console.error("Record payment error:", err);
      showToast(err.message || "Failed to record payment.");
      return false;
    }
  };

  // Supplier & Vendor Management Handlers (Requirement 2 & 8)
  const handleAddSupplier = async (newSupplierData: Partial<SupplierItem>): Promise<boolean> => {
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSupplierData),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to add supplier.");
      }
      fetchSuppliers();
      showToast(data.message || `Supplier "${newSupplierData.company_name}" registered successfully!`);
      return true;
    } catch (err: any) {
      console.error("Add supplier error:", err);
      showToast(err.message || "Failed to register supplier.");
      throw err;
    }
  };

  const handleUpdateSupplier = async (id: number, supplierData: Partial<SupplierItem>): Promise<boolean> => {
    try {
      const res = await fetch(`/api/suppliers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(supplierData),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update supplier.");
      }
      fetchSuppliers();
      showToast(data.message || "Supplier details updated successfully!");
      return true;
    } catch (err: any) {
      console.error("Update supplier error:", err);
      showToast(err.message || "Failed to update supplier.");
      throw err;
    }
  };

  const handleDeleteSupplier = async (id: number): Promise<boolean> => {
    try {
      const res = await fetch(`/api/suppliers/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete supplier.");
      }
      setSuppliers((prev) => {
        const next = prev.filter((s) => s.id !== id);
        try {
          localStorage.setItem("sbm_suppliers_cache", JSON.stringify(next));
        } catch {}
        return next;
      });
      showToast(data.message || "Supplier removed from directory.");
      return true;
    } catch (err: any) {
      console.error("Delete supplier error:", err);
      showToast(err.message || "Failed to delete supplier.");
      return false;
    }
  };

  // Purchase Management Handlers (Requirements 2, 3, 7, 8)
  const handleAddPurchase = async (purchaseData: any): Promise<boolean> => {
    try {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(purchaseData),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to record purchase.");
      }
      // Re-fetch all dependent datasets so inventory, suppliers, stock movements, and metrics update immediately!
      fetchPurchases();
      fetchProducts();
      fetchSuppliers();
      fetchStockMovements();
      fetchMetrics();
      fetchAlerts();
      showToast(data.message || `Purchase order recorded successfully!`);
      return true;
    } catch (err: any) {
      console.error("Add purchase error:", err);
      showToast(err.message || "Failed to record purchase.");
      throw err;
    }
  };

  const handleDeletePurchase = async (id: number): Promise<boolean> => {
    try {
      const res = await fetch(`/api/purchases/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete purchase.");
      }
      fetchPurchases();
      fetchProducts();
      fetchSuppliers();
      fetchStockMovements();
      fetchMetrics();
      showToast(data.message || "Purchase record deleted and stock adjusted.");
      return true;
    } catch (err: any) {
      console.error("Delete purchase error:", err);
      showToast(err.message || "Failed to delete purchase.");
      return false;
    }
  };

  const handleAddExpense = async (newExpense: Omit<ExpenseItem, "id">): Promise<boolean> => {
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newExpense),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to record expense");
      }
      const created: ExpenseItem = data.expense;
      setExpenses((prev) => [created, ...prev]);
      fetchMetrics();
      showToast(data.message || `Expense "${newExpense.title}" recorded successfully!`);
      return true;
    } catch (err: any) {
      console.warn("Offline or fallback expense add:", err);
      const fallbackExpense: ExpenseItem = {
        ...newExpense,
        id: Date.now(),
      };
      setExpenses((prev) => [fallbackExpense, ...prev]);
      showToast(`Expense "${newExpense.title}" saved locally.`);
      return true;
    }
  };

  const handleUpdateExpense = async (updatedExp: ExpenseItem): Promise<boolean> => {
    try {
      const res = await fetch(`/api/expenses/${updatedExp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedExp),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update expense");
      }
      const updated: ExpenseItem = data.expense || updatedExp;
      setExpenses((prev) =>
        prev.map((e) => (e.id === updatedExp.id ? updated : e))
      );
      fetchMetrics();
      showToast(data.message || `Expense "${updatedExp.title}" updated successfully!`);
      return true;
    } catch (err: any) {
      console.warn("Offline or fallback expense update:", err);
      setExpenses((prev) =>
        prev.map((e) => (e.id === updatedExp.id ? updatedExp : e))
      );
      showToast(`Expense "${updatedExp.title}" updated.`);
      return true;
    }
  };

  const handleDeleteExpense = async (id: number): Promise<boolean> => {
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete expense");
      }
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      fetchMetrics();
      showToast(data.message || "Expense deleted successfully.");
      return true;
    } catch (err: any) {
      console.warn("Offline or fallback expense delete:", err);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      showToast("Expense deleted.");
      return true;
    }
  };

  const handleAddProduct = async (newProduct: Omit<ProductItem, "id">): Promise<boolean> => {
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProduct),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to add product");
      }
      fetchProducts();
      fetchStockMovements();
      fetchMetrics();
      showToast(data.message || `Product "${newProduct.name}" added to inventory!`);
      return true;
    } catch (err: any) {
      console.error("Add product error:", err);
      showToast(err.message || "Failed to add product");
      throw err;
    }
  };

  const handleUpdateProduct = async (
    id: number,
    updatedFields: Partial<ProductItem>
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedFields),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update product");
      }
      fetchProducts();
      fetchStockMovements();
      fetchMetrics();
      showToast(data.message || "Product updated successfully!");
      return true;
    } catch (err: any) {
      console.error("Update product error:", err);
      showToast(err.message || "Failed to update product");
      throw err;
    }
  };

  const handleDeleteProduct = async (id: number): Promise<boolean> => {
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete product");
      }
      fetchProducts();
      fetchStockMovements();
      fetchMetrics();
      showToast(data.message || "Product deleted from inventory!");
      return true;
    } catch (err: any) {
      console.error("Delete product error:", err);
      showToast(err.message || "Failed to delete product");
      throw err;
    }
  };

  const handleAdjustStock = async (
    id: number,
    actionType: "add" | "set" | "increase" | "decrease",
    quantity: number,
    notes?: string
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/products/${id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_type: actionType,
          quantity,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to adjust stock");
      }
      fetchProducts();
      fetchStockMovements();
      fetchMetrics();
      fetchAlerts();
      showToast(data.message || "Stock adjusted successfully!");
      return true;
    } catch (err: any) {
      console.error("Adjust stock error:", err);
      showToast(err.message || "Failed to adjust stock");
      throw err;
    }
  };

  const handleRestockProduct = async (product: ProductItem) => {
    const restockQty = Math.max(5, product.min_stock_level * 2);
    try {
      await handleAdjustStock(
        product.id,
        "add",
        restockQty,
        `Quick restock from dashboard alert (+${restockQty} units)`
      );
    } catch {}
  };

  const handleAddEmployee = async (newEmployee: Omit<EmployeeItem, "id">) => {
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEmployee),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to add employee");
      }
      const createdEmp: EmployeeItem = data.employee;
      setEmployees((prev) => [createdEmp, ...prev]);
      showToast(data.message || `Employee "${newEmployee.name}" added to SQLite!`);
    } catch (err: any) {
      console.warn("Offline or fallback employee add:", err);
      const fallbackEmp: EmployeeItem = {
        ...newEmployee,
        id: Date.now(),
      };
      setEmployees((prev) => [fallbackEmp, ...prev]);
      showToast(`Employee "${newEmployee.name}" saved!`);
    }
  };

  const handleUpdateEmployee = async (updatedEmp: EmployeeItem) => {
    try {
      const res = await fetch(`/api/employees/${updatedEmp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedEmp),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update employee");
      }
      const updatedRecord: EmployeeItem = data.employee || updatedEmp;
      setEmployees((prev) =>
        prev.map((emp) => (emp.id === updatedEmp.id ? updatedRecord : emp))
      );
      showToast(data.message || `Employee "${updatedEmp.name}" updated successfully!`);
    } catch (err: any) {
      console.warn("Offline or fallback employee update:", err);
      setEmployees((prev) =>
        prev.map((emp) => (emp.id === updatedEmp.id ? updatedEmp : emp))
      );
      showToast(`Employee "${updatedEmp.name}" updated!`);
    }
  };

  const handleDeleteEmployee = async (id: number) => {
    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete employee");
      }
      setEmployees((prev) => prev.filter((emp) => emp.id !== id));
      showToast(data.message || "Employee deleted from database.");
    } catch (err: any) {
      console.warn("Offline or fallback employee delete:", err);
      setEmployees((prev) => prev.filter((emp) => emp.id !== id));
      showToast("Employee deleted.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans antialiased">
      {/* Responsive Left Navigation */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={onLogout}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        lowStockCount={low_stock_count}
        unreadAlertsCount={unreadAlertsCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Sticky Header */}
        <Header
          username={username}
          activeTab={activeTab}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onLogout={onLogout}
          sqliteConnected={sqliteConnected}
          unreadAlertsCount={unreadAlertsCount}
          onOpenAlerts={() => setIsAlertsModalOpen(true)}
          onNavigateTab={setActiveTab}
          onOpenVoiceAssistant={() => setIsVoiceModalOpen(true)}
          onSelectSearchResult={(type) => {
            if (type === "product") setActiveTab("inventory");
            else if (type === "customer") setActiveTab("customers");
            else if (type === "sale") setActiveTab("sales");
            else if (type === "purchase") setActiveTab("purchases");
            else if (type === "expense") setActiveTab("expenses");
          }}
        />

        {/* Dynamic Body Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* TAB 1: MAIN DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Quick Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Quick Actions:
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setActiveTab("sales")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
                    <span>Record Sale</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("expenses")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <Receipt className="w-3.5 h-3.5 text-rose-600" />
                    <span>Log Expense</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("inventory")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <PackagePlus className="w-3.5 h-3.5 text-purple-600" />
                    <span>Add Product</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("purchases")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <Truck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Purchases</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("analytics")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                    <span>Analytics &amp; P&amp;L</span>
                  </button>
                  <button
                    id="dashboard-ai-assistant-btn"
                    onClick={() => setActiveTab("ai-assistant")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>AI Assistant</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("customers")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Customers</span>
                  </button>
                </div>
              </div>

              {/* 1-6 Sections: Total Sales, Total Expenses, Total Profit, Total Products, Low Stock Alerts, Total Employees + Today's */}
              <MetricCards metrics={metrics} onNavigateTab={setActiveTab} />

              {/* AI Business Assistant Advisory Banner */}
              <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 rounded-2xl p-4 sm:p-5 text-white border border-purple-800/40 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center shrink-0 text-purple-300">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-purple-300">AI Business Assistant</span>
                      <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                        Live Database Grounded
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 max-w-xl">
                      Get real-time insights on sales, profit &amp; loss, inventory reorders, and expense anomalies. Ask any business question in simple language.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    id="dashboard-open-ai-assistant"
                    onClick={() => setActiveTab("ai-assistant")}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <Bot className="w-4 h-4" />
                    <span>Open AI Assistant</span>
                  </button>
                </div>
              </div>

              {/* Professional Business Analytics & Profit/Loss Section (Requirement 5) */}
              <DashboardAnalyticsSection onNavigateToAnalytics={() => setActiveTab("analytics")} />

              {/* Smart Dashboard Alert Center (Requirements 1, 2, 3, 4, 5, 6, 8, 9, 10, 12) */}
              <SmartAlertsSection
                alerts={alerts}
                unreadCount={unreadAlertsCount}
                onMarkRead={handleMarkAlertRead}
                onMarkAllRead={handleMarkAllAlertsRead}
                onDismissAlert={handleDismissAlert}
                onOpenSettings={() => setIsAlertSettingsOpen(true)}
                onQuickRestock={handleQuickRestockFromAlert}
                onRefreshAlerts={fetchAlerts}
              />

              {/* Simple Sales/Profit Chart */}
              <SalesProfitChart data={metrics.chart_data} />

              {/* 2-Column Split: Recent Sales Table + Low Stock Alerts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <RecentSalesTable
                  sales={metrics.recent_sales}
                  onViewAll={() => setActiveTab("sales")}
                />
                <LowStockAlerts
                  products={products}
                  onViewInventory={() => setActiveTab("inventory")}
                  onRestock={handleRestockProduct}
                />
              </div>
            </div>
          )}

          {/* TAB 2: EMPLOYEES */}
          {activeTab === "employees" && (
            <div className="animate-in fade-in duration-200">
              <EmployeesView
                employees={employees}
                onAddEmployee={handleAddEmployee}
                onUpdateEmployee={handleUpdateEmployee}
                onDeleteEmployee={handleDeleteEmployee}
                onRefresh={fetchEmployees}
                sqliteConnected={sqliteConnected}
              />
            </div>
          )}

          {/* TAB 3: SALES */}
          {activeTab === "sales" && (
            <div className="animate-in fade-in duration-200">
              <SalesView
                sales={sales}
                products={products}
                customers={customers}
                onAddSale={handleAddSale}
                onUpdateSale={handleUpdateSale}
                onDeleteSale={handleDeleteSale}
                todayOrdersCount={todayOrdersCount}
                todaySalesAmount={today_sales}
              />
            </div>
          )}

          {/* TAB 4: EXPENSES */}
          {activeTab === "expenses" && (
            <div className="animate-in fade-in duration-200">
              <ExpensesView
                expenses={expenses}
                onAddExpense={handleAddExpense}
                onUpdateExpense={handleUpdateExpense}
                onDeleteExpense={handleDeleteExpense}
              />
            </div>
          )}

          {/* TAB: CUSTOMERS (Requirement 1, 4, 8, 9, 10) */}
          {activeTab === "customers" && (
            <div className="animate-in fade-in duration-200">
              <CustomersView
                customers={customers}
                sales={sales}
                onAddCustomer={handleAddCustomer}
                onUpdateCustomer={handleUpdateCustomer}
                onDeleteCustomer={handleDeleteCustomer}
                onRefreshCustomers={fetchCustomers}
                onViewInvoice={(_sale) => {
                  setActiveTab("sales");
                }}
                onRecordPayment={handleRecordCustomerPayment}
              />
            </div>
          )}

          {/* TAB: SUPPLIERS & VENDORS (Requirement 1, 2, 4) */}
          {activeTab === "suppliers" && (
            <div className="animate-in fade-in duration-200">
              <SuppliersView
                suppliers={suppliers}
                onAddSupplier={handleAddSupplier}
                onUpdateSupplier={handleUpdateSupplier}
                onDeleteSupplier={handleDeleteSupplier}
                onRefreshSuppliers={fetchSuppliers}
              />
            </div>
          )}

          {/* TAB: PURCHASE MANAGEMENT (Requirements 1, 2, 3, 4, 5, 8, 9) */}
          {activeTab === "purchases" && (
            <div className="animate-in fade-in duration-200">
              <PurchasesView
                purchases={purchases}
                suppliers={suppliers}
                products={products}
                onAddPurchase={handleAddPurchase}
                onDeletePurchase={handleDeletePurchase}
                onRefreshPurchases={fetchPurchases}
                onRefreshProducts={fetchProducts}
                onRefreshSuppliers={fetchSuppliers}
                onNavigateToSuppliers={() => setActiveTab("suppliers")}
                onNavigateToInventory={() => setActiveTab("inventory")}
              />
            </div>
          )}

          {/* TAB 5: INVENTORY */}
          {activeTab === "inventory" && (
            <div className="animate-in fade-in duration-200">
              <InventoryView
                products={products}
                stockMovements={stockMovements}
                suppliers={suppliers}
                productAlertTags={productAlertTags}
                onAddProduct={handleAddProduct}
                onUpdateProduct={handleUpdateProduct}
                onDeleteProduct={handleDeleteProduct}
                onAdjustStock={handleAdjustStock}
                onRestockProduct={handleRestockProduct}
                onRefreshMovements={fetchStockMovements}
              />
            </div>
          )}

          {/* TAB: BUSINESS ANALYTICS & PROFIT/LOSS (Requirements 1, 2, 3, 4, 6, 7, 8) */}
          {activeTab === "analytics" && (
            <div className="animate-in fade-in duration-200">
              <AnalyticsView
                onNavigateToSales={() => setActiveTab("sales")}
                onNavigateToExpenses={() => setActiveTab("expenses")}
                onNavigateToInventory={() => setActiveTab("inventory")}
              />
            </div>
          )}

          {/* TAB: AI BUSINESS ASSISTANT */}
          {activeTab === "ai-assistant" && (
            <div className="animate-in fade-in duration-200">
              <AIAssistantView onNavigateTab={setActiveTab} />
            </div>
          )}

          {/* TAB 6: REPORTS */}
          {activeTab === "reports" && (
            <div className="animate-in fade-in duration-200">
              <ReportsView
                metrics={metrics}
                sales={sales}
                expenses={expenses}
                products={products}
              />
            </div>
          )}

          {/* TAB 7: SETTINGS */}
          {activeTab === "settings" && (
            <div className="animate-in fade-in duration-200">
              <SettingsView
                onSyncSQLite={() => {
                  fetch("/api/metrics")
                    .then((res) => res.json())
                    .then(() => showToast("SQLite database synchronized successfully!"));
                }}
              />
            </div>
          )}
        </main>
      </div>

      {/* Floating Action Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-slate-800 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Smart Alerts Drawer / Modal (Triggered by Notification Bell - Requirement 7, 8) */}
      <SmartAlertsModal
        isOpen={isAlertsModalOpen}
        onClose={() => setIsAlertsModalOpen(false)}
        alerts={alerts}
        unreadCount={unreadAlertsCount}
        onMarkRead={handleMarkAlertRead}
        onMarkAllRead={handleMarkAllAlertsRead}
        onDismissAlert={handleDismissAlert}
        onOpenSettings={() => setIsAlertSettingsOpen(true)}
        onQuickRestock={handleQuickRestockFromAlert}
      />

      {/* Alert Settings Preferences Modal (Requirement 10) */}
      <AlertSettingsModal
        isOpen={isAlertSettingsOpen}
        onClose={() => setIsAlertSettingsOpen(false)}
        settings={alertSettings}
        onSaveSettings={handleSaveAlertSettings}
      />

      {/* Voice Business Assistant Modal */}
      <VoiceAssistantModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onNavigateTab={setActiveTab}
        onOpenAlerts={() => setIsAlertsModalOpen(true)}
        onRefreshData={() => {
          fetchAlerts();
          showToast("Data refreshed successfully");
        }}
      />
    </div>
  );
};

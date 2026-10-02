export interface User {
  id: number;
  username: string;
}

export interface SaleProductItem {
  id?: number;
  sale_id?: number;
  product_id?: number;
  product_name: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  discount: number; // in ₹ or applied per line
  tax_rate?: number; // e.g. 18 for 18% GST
  total_price: number;
}

export interface SaleRecord {
  id: number;
  invoice_no: string;
  customer_name: string;
  customer_phone?: string;
  items: SaleProductItem[];
  subtotal: number;
  discount: number;
  tax_amount: number;
  total_amount: number;
  payment_method: "Cash" | "UPI" | "Card" | "Credit" | string;
  payment_status: "Paid" | "Pending" | "Partially Paid" | string;
  sale_date: string;
  notes?: string;
  created_at?: string;
}

export interface CustomerItem {
  id: number;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  gst_number?: string;
  notes?: string;
  total_orders?: number;
  total_purchases: number;
  paid_amount?: number;
  pending_amount?: number;
  last_purchase_date?: string;
  created_at?: string;
}

export interface SaleItem {
  id: number;
  invoice_no?: string;
  customer_name: string;
  customer_phone?: string;
  product_name: string;
  quantity: number;
  total_amount: number;
  paid_amount?: number;
  pending_amount?: number;
  due_date?: string;
  sale_date: string;
  payment_method?: string;
  status?: "completed" | "pending" | "refunded" | string;
  items?: SaleProductItem[];
  subtotal?: number;
  discount?: number;
  tax_amount?: number;
  payment_status?: string;
  notes?: string;
}

export type ExpenseCategory =
  | "Rent"
  | "Salary"
  | "Electricity"
  | "Internet"
  | "Transport"
  | "Stock Purchase"
  | "Maintenance"
  | "Marketing"
  | "Other";

export interface ExpenseItem {
  id: number;
  title: string;
  category: ExpenseCategory | string;
  amount: number;
  expense_date: string;
  payment_method?: "Cash" | "UPI" | "Card" | "Net Banking" | "Cheque" | string;
  notes?: string;
  description?: string;
  created_at?: string;
}

export interface ExpenseCategorySummary {
  category: string;
  amount: number;
  count: number;
}

export interface ExpenseDailySummary {
  date: string;
  label: string;
  amount: number;
}

export interface ProductItem {
  id: number;
  name: string;
  category: string;
  sku?: string;
  price: number; // Selling Price / Final Price
  mrp?: number; // Original / MRP Price
  discount_percent?: number; // Discount %
  discount_amount?: number; // Discount in ₹
  discount_type?: "percentage" | "fixed" | string;
  purchase_price?: number; // Purchase / Cost Price
  stock_quantity: number;
  min_stock_level: number;
  max_stock_level?: number;
  stock_value?: number;
  supplier?: string;
  brand?: string;
  status?: "In Stock" | "Low Stock" | "Out of Stock" | "Overstock" | string;
  created_at?: string;
}

export interface GlobalSearchResults {
  products: ProductItem[];
  customers: CustomerItem[];
  suppliers?: SupplierItem[];
  sales: {
    id: number;
    invoice_no: string;
    customer_name: string;
    customer_phone?: string;
    product_name?: string;
    total_amount: number;
    payment_status: string;
    payment_method: string;
    sale_date: string;
  }[];
  purchases: {
    id: number;
    invoice_no: string;
    supplier_name: string;
    product_name: string;
    total_cost: number;
    purchase_date: string;
    payment_status: string;
  }[];
  expenses: {
    id: number;
    title: string;
    category: string;
    amount: number;
    expense_date: string;
    payment_method: string;
    notes?: string;
  }[];
}

export interface StockMovementItem {
  id: number;
  product_id?: number;
  product_name: string;
  movement_type: "Stock Added" | "Sale" | "Adjustment" | "Restock" | "Sale Restored" | string;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reference_id?: string;
  notes?: string;
  created_at: string;
}

export interface EmployeeItem {
  id: number;
  name: string;
  phone: string;
  email: string;
  role: string;
  department: string;
  salary: number;
  joining_date: string;
  status: "Active" | "Inactive" | "active" | "inactive" | "on_leave";
}

export interface ChartDayData {
  date: string;
  label: string;
  sales: number;
  expenses: number;
  profit: number;
  total?: number; // backwards compatibility
}

export interface DashboardMetrics {
  // Lifetime / Totals
  total_sales: number;
  total_revenue?: number;
  total_purchases?: number;
  total_expenses: number;
  total_profit: number;
  pending_payments?: number;
  total_products: number;
  total_customers?: number;
  total_suppliers?: number;
  total_stock_items: number;
  total_inventory_value?: number;
  total_inventory_cost?: number;
  low_stock_count: number;
  out_of_stock_count: number;
  overstock_count?: number;
  suspicious_discounts_count?: number;
  total_employees: number;
  active_employees?: number;
  inactive_employees?: number;
  monthly_payroll?: number;
  
  // Today's specific metrics
  today_sales: number;
  today_expenses: number;
  today_profit: number;
  
  // COGS & Profit Breakdown (Requirement 1, 5, 8)
  total_cogs?: number;
  today_cogs?: number;
  gross_profit?: number;
  gross_margin?: number;
  profit_margin?: number;
  
  // Lists & Charts
  recent_sales: SaleItem[];
  low_stock_products: ProductItem[];
  chart_data: ChartDayData[];
}

export interface BusinessSettings {
  id?: number;
  business_name: string;
  business_logo?: string;
  currency: string;
  currency_symbol: string;
  tax_rate: number;
  low_stock_threshold: number;
  discount_low_max: number;
  discount_med_max: number;
  discount_high_max: number;
  invoice_prefix: string;
  invoice_notes: string;
  notify_low_stock: boolean;
  notify_out_of_stock: boolean;
  notify_suspicious_discount: boolean;
  notify_customer_dues: boolean;
  notify_overdue: boolean;
  updated_at?: string;
}

export interface SupplierItem {
  id: number;
  name: string;
  company_name: string;
  mobile: string;
  email?: string;
  address?: string;
  notes?: string;
  total_purchases: number;
  last_purchase_date?: string;
  created_at?: string;
}

export interface SupplierPurchaseItem {
  id: number;
  supplier_id: number;
  purchase_order_no: string;
  invoice_no?: string;
  product_id?: number;
  product_name: string;
  quantity: number;
  unit_cost: number;
  total_amount: number;
  purchase_date: string;
  payment_status: "Paid" | "Pending" | string;
  payment_method?: string;
  notes?: string;
  created_at?: string;
}

export interface PurchaseItem {
  id: number;
  invoice_no: string;
  purchase_order_no?: string;
  supplier_id: number;
  supplier_name?: string;
  supplier_company?: string;
  supplier_mobile?: string;
  product_id?: number;
  product_name: string;
  product_category?: string;
  product_sku?: string;
  quantity: number;
  unit_cost: number; // purchase price per unit
  total_amount: number;
  purchase_date: string;
  payment_status?: "Paid" | "Pending" | string;
  payment_method?: string;
  notes?: string;
  created_at?: string;
}

export type SidebarTab =
  | "dashboard"
  | "employees"
  | "customers"
  | "suppliers"
  | "purchases"
  | "sales"
  | "expenses"
  | "inventory"
  | "analytics"
  | "reports"
  | "ai-assistant"
  | "settings";

export interface AIChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  category?: "general" | "sales" | "inventory" | "expenses" | "profit" | "suggestions";
  suggestedFollowUps?: string[];
  isLiveAi?: boolean;
}

export interface AIBusinessInsights {
  healthScore: number;
  healthRating: string;
  overview: {
    totalSales: number;
    paidRevenue: number;
    pendingRevenue: number;
    totalCogs: number;
    grossProfit: number;
    totalExpenses: number;
    netProfit: number;
    profitMargin: number;
    totalOrders: number;
    avgOrderValue: number;
    totalCustomers: number;
    totalProducts?: number;
    inventoryValue: number;
    totalEmployees?: number;
  };
  inventoryAlerts: {
    lowStockCount: number;
    outOfStockCount: number;
    criticalItems: {
      id: number;
      name: string;
      category?: string;
      stock: number;
      min_stock: number;
      price: number;
      cost: number;
    }[];
    reorderSuggestedCount: number;
  };
  expenseWatchdog: {
    totalExpenses: number;
    unusualCount: number;
    unusualList: {
      id: number;
      title: string;
      category: string;
      amount: number;
      date: string;
      reason: string;
    }[];
    topCategory: {
      category: string;
      amount: number;
    };
  };
  salesHighlights: {
    totalSales: number;
    topProduct: string;
    topProductRevenue: number;
    pendingReceivables: number;
  };
  recommendations: string[];
  suggestedQuestions: string[];
}

export interface PnLMetrics {
  total_sales: number;
  cogs: number;
  gross_profit: number;
  expenses: number;
  net_profit: number;
  profit_margin: number; // net profit margin %
  gross_margin: number; // gross margin %
  total_orders: number;
  total_units_sold: number;
  avg_order_value: number;
}

export interface ProductProfitabilityItem {
  id: number;
  name: string;
  category: string;
  sku?: string;
  units_sold: number;
  selling_revenue: number;
  purchase_cost: number;
  gross_profit: number;
  profit_margin: number;
  stock_remaining: number;
  unit_price: number;
  unit_cost: number;
}

export interface SalesAnalyticsData {
  daily_sales_trend: {
    date: string;
    label: string;
    sales: number;
    orders: number;
    cogs: number;
    gross_profit: number;
    expenses: number;
    net_profit: number;
  }[];
  top_selling_products: {
    id: number;
    name: string;
    category: string;
    units_sold: number;
    revenue: number;
  }[];
  highest_revenue_products: {
    id: number;
    name: string;
    category: string;
    units_sold: number;
    revenue: number;
  }[];
  sales_by_date: {
    date: string;
    orders: number;
    revenue: number;
  }[];
  sales_by_customer: {
    name: string;
    phone: string;
    orders_count: number;
    total_spent: number;
    percentage: number;
  }[];
  summary_cards: {
    total_orders: number;
    total_units_sold: number;
    paid_revenue: number;
    pending_revenue: number;
    avg_order_value: number;
  };
}

export interface ExpenseAnalyticsData {
  expense_categories: {
    category: string;
    amount: number;
    percentage: number;
    count: number;
  }[];
  total_expenses: number;
  expense_trend: {
    date: string;
    label: string;
    amount: number;
  }[];
  highest_expense_categories: {
    category: string;
    amount: number;
    percentage: number;
  }[];
}

export interface BusinessKpiCards {
  revenue: number;
  net_profit: number;
  profit_margin: number;
  total_orders: number;
  total_customers: number;
  inventory_value: number;
}

export interface CustomerAnalyticsItem {
  name: string;
  phone: string;
  orders_count: number;
  total_spent: number;
  percentage: number;
  avg_order_value: number;
}

export interface CustomerAnalyticsData {
  total_customers: number;
  new_customers: number;
  repeat_customers: number;
  top_customers: CustomerAnalyticsItem[];
  customer_revenue_contribution: {
    name: string;
    total_spent: number;
    percentage: number;
  }[];
}

export interface ProfitTrendItem {
  date: string;
  label: string;
  gross_revenue: number;
  cogs: number;
  expenses: number;
  gross_profit: number;
  net_profit: number;
  profit_margin: number;
}

export interface ProfitAnalyticsData {
  gross_revenue: number;
  total_expenses: number;
  cogs: number;
  net_profit: number;
  profit_margin: number;
  gross_margin: number;
  profit_trend: ProfitTrendItem[];
}

export interface LowStockItem {
  id: number;
  name: string;
  category: string;
  stock_quantity: number;
  min_stock_level: number;
  price: number;
  cost: number;
}

export interface ProductAnalyticsData {
  top_10_selling: ProductProfitabilityItem[];
  low_performing: ProductProfitabilityItem[];
  current_stock_value: number;
  low_stock_products: LowStockItem[];
  highest_revenue: ProductProfitabilityItem[];
}

export interface WeeklySalesTrendItem {
  week_key: string;
  label: string;
  sales: number;
  orders: number;
  net_profit: number;
}

export interface MonthlySalesTrendItem {
  month_key: string;
  label: string;
  sales: number;
  orders: number;
  expenses: number;
  net_profit: number;
}

export interface MonthlyExpenseTrendItem {
  month_key: string;
  label: string;
  amount: number;
  count: number;
}

export interface BusinessAnalyticsResponse {
  success: boolean;
  period: string;
  start_date?: string;
  end_date?: string;
  pnl: PnLMetrics;
  product_profitability: ProductProfitabilityItem[];
  sales_analytics: SalesAnalyticsData;
  expense_analytics: ExpenseAnalyticsData;
  kpi?: BusinessKpiCards;
  sales_growth_pct?: number;
  customer_analytics?: CustomerAnalyticsData;
  profit_analytics?: ProfitAnalyticsData;
  product_analytics?: ProductAnalyticsData;
  inventory_value?: number;
  weekly_sales_trend?: WeeklySalesTrendItem[];
  monthly_sales_trend?: MonthlySalesTrendItem[];
  monthly_expense_trend?: MonthlyExpenseTrendItem[];
  error?: string;
}

export interface ProjectFile {
  name: string;
  path: string;
  language: string;
  content: string;
  description: string;
}

export type AlertType = "out_of_stock" | "low_stock" | "high_demand" | "slow_moving";
export type AlertPriority = "CRITICAL" | "HIGH" | "MEDIUM";
export type AlertCategory = "critical" | "attention" | "insight";

export interface SmartAlertItem {
  id: number;
  alert_key: string;
  alert_type: AlertType;
  priority: AlertPriority;
  category: AlertCategory;
  product_id?: number;
  product_name: string;
  current_stock: number;
  threshold: number;
  recent_units_sold: number;
  previous_units_sold: number;
  sales_velocity: number;
  trend_percentage: number;
  recommended_priority: "High" | "Medium" | "Low";
  suggested_reorder_qty: number;
  title: string;
  message: string;
  action_recommendation: string;
  period_info: string;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
  updated_at?: string;
}

export interface AlertSettingsConfig {
  analysis_period_days: number;
  high_demand_threshold_pct: number;
  slow_moving_threshold_pct: number;
  min_sales_for_trend: number;
  enable_stock_alerts: boolean;
  enable_sales_trend_alerts: boolean;
  critical_stock_ratio: number;
}

export interface AlertsResponse {
  success: boolean;
  alerts: SmartAlertItem[];
  unread_count: number;
  summary: {
    critical_count: number;
    attention_count: number;
    insight_count: number;
    total_active: number;
  };
  product_alert_tags: Record<number, string[]>;
  settings: AlertSettingsConfig;
  error?: string;
}


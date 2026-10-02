import React, { useState, useMemo } from "react";
import { SaleItem, ProductItem, CustomerItem, SaleProductItem } from "../types";
import { formatCurrency, formatDate } from "../utils/formatters";
import { InvoiceModal } from "./InvoiceModal";
import { NewSaleModal } from "./NewSaleModal";
import { EditSaleModal } from "./EditSaleModal";
import {
  DollarSign,
  Plus,
  Search,
  CheckCircle,
  Clock,
  Printer,
  Eye,
  Edit2,
  Trash2,
  FileText,
  Calendar,
  Filter,
  CreditCard,
  ShoppingBag,
  TrendingUp,
  AlertTriangle,
  RotateCcw,
  Building,
  ArrowUpRight,
  Receipt,
} from "lucide-react";

interface SalesViewProps {
  sales: SaleItem[];
  products: ProductItem[];
  customers?: CustomerItem[];
  onAddSale: (saleData: any) => Promise<boolean>;
  onUpdateSale: (id: number, updatedFields: Partial<SaleItem>) => Promise<boolean>;
  onDeleteSale: (id: number) => Promise<boolean>;
  todayOrdersCount?: number;
  todaySalesAmount?: number;
}

export const SalesView: React.FC<SalesViewProps> = ({
  sales,
  products,
  customers = [],
  onAddSale,
  onUpdateSale,
  onDeleteSale,
  todayOrdersCount,
  todaySalesAmount,
}) => {
  // Modal states
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<SaleItem | null>(null);
  const [editingSale, setEditingSale] = useState<SaleItem | null>(null);
  const [deletingSale, setDeletingSale] = useState<SaleItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filters and Sorting state (Requirement 2)
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"latest" | "oldest" | "highest" | "lowest" | "customer">("latest");

  const todayStr = new Date().toISOString().split("T")[0];

  // ================= SUMMARY METRICS =================
  const totalRevenue = useMemo(() => {
    return sales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
  }, [sales]);

  const todaySales = useMemo(() => {
    if (todaySalesAmount !== undefined) return todaySalesAmount;
    return sales
      .filter((s) => s.sale_date === todayStr)
      .reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
  }, [sales, todaySalesAmount, todayStr]);

  const todayOrders = useMemo(() => {
    if (todayOrdersCount !== undefined) return todayOrdersCount;
    return sales.filter((s) => s.sale_date === todayStr).length;
  }, [sales, todayOrdersCount, todayStr]);

  const pendingPayments = useMemo(() => {
    return sales
      .filter((s) => (s.payment_status || "Paid").toLowerCase() !== "paid")
      .reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
  }, [sales]);

  const averageTicket = useMemo(() => {
    return sales.length > 0 ? totalRevenue / sales.length : 0;
  }, [sales, totalRevenue]);

  // ================= FILTERING =================
  const filteredSales = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    return sales.filter((s) => {
      // 1. Text Search
      const matchesSearch =
        !term ||
        s.customer_name?.toLowerCase().includes(term) ||
        s.product_name?.toLowerCase().includes(term) ||
        (s.invoice_no && s.invoice_no.toLowerCase().includes(term)) ||
        (s.customer_phone && s.customer_phone.toLowerCase().includes(term));

      if (!matchesSearch) return false;

      // 2. Status Filter
      if (statusFilter !== "all") {
        const curStatus = (s.payment_status || "Paid").toLowerCase();
        if (curStatus !== statusFilter.toLowerCase()) return false;
      }

      // 3. Payment Method Filter
      if (methodFilter !== "all") {
        const curMethod = (s.payment_method || "Cash").toLowerCase();
        if (curMethod !== methodFilter.toLowerCase()) return false;
      }

      // 4. Date Filter
      if (dateFilter === "today") {
        return s.sale_date === todayStr;
      }
      if (dateFilter === "week") {
        const saleDateObj = new Date(s.sale_date);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return saleDateObj >= sevenDaysAgo;
      }
      if (dateFilter === "month") {
        const saleDateObj = new Date(s.sale_date);
        const now = new Date();
        return (
          saleDateObj.getFullYear() === now.getFullYear() &&
          saleDateObj.getMonth() === now.getMonth()
        );
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === "latest") {
        return new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime() || b.id - a.id;
      }
      if (sortBy === "oldest") {
        return new Date(a.sale_date).getTime() - new Date(b.sale_date).getTime() || a.id - b.id;
      }
      if (sortBy === "highest") {
        return Number(b.total_amount || 0) - Number(a.total_amount || 0);
      }
      if (sortBy === "lowest") {
        return Number(a.total_amount || 0) - Number(b.total_amount || 0);
      }
      if (sortBy === "customer") {
        return (a.customer_name || "").localeCompare(b.customer_name || "");
      }
      return 0;
    });
  }, [sales, searchTerm, dateFilter, statusFilter, methodFilter, sortBy, todayStr]);

  // Next Invoice preview calculation
  const nextInvoiceNumber = useMemo(() => {
    return `INV-2026-${(sales.length + 1).toString().padStart(4, "0")}`;
  }, [sales.length]);

  const handleDeleteConfirm = async () => {
    if (!deletingSale) return;
    setIsDeleting(true);
    try {
      await onDeleteSale(deletingSale.id);
      setDeletingSale(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. SALES DASHBOARD METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Today's Sales
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {formatCurrency(todaySales)}
          </div>
          <div className="text-[11px] text-blue-600 font-medium mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Today: {todayOrders} {todayOrders === 1 ? "Order" : "Orders"}</span>
          </div>
        </div>

        {/* Total Lifetime Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Revenue
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2 font-mono">
            {formatCurrency(totalRevenue)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Across {sales.length} issued invoices
          </div>
        </div>

        {/* Pending Payments */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pending Payments
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-2 font-mono">
            {formatCurrency(pendingPayments)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Awaiting customer clearance
          </div>
        </div>

        {/* Average Order Value */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:border-indigo-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Avg Order Value
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {formatCurrency(averageTicket)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Per customer transaction
          </div>
        </div>
      </div>

      {/* 2. SALES ACTION & FILTER BAR */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">Sales &amp; Billing Invoices</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Create invoices, reduce stock automatically, and manage customer billing history
            </p>
          </div>

          {/* Create New Sale Primary Action */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsNewSaleOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-xs hover:shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Sale / Invoice</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search invoice, customer, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900"
            />
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
            >
              <option value="all">All Dates</option>
              <option value="today">Today Only</option>
              <option value="week">Past 7 Days</option>
              <option value="month">This Month</option>
            </select>
          </div>

          {/* Payment Status Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
            >
              <option value="all">All Payment Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Partially Paid">Partially Paid</option>
            </select>
          </div>

          {/* Payment Method Filter */}
          <div className="flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="w-full text-xs px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
            >
              <option value="all">All Payment Methods</option>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
              <option value="Credit">Credit / Net Terms</option>
            </select>
          </div>
        </div>

        {/* Sort Controls & Reset Filters (Requirement 2) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-semibold flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              <span>Sort Orders:</span>
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="latest">Latest Invoices First</option>
              <option value="oldest">Oldest Invoices First</option>
              <option value="highest">Highest Amount (₹)</option>
              <option value="lowest">Lowest Amount (₹)</option>
              <option value="customer">Customer Name (A-Z)</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-500 font-medium">
              Showing <strong>{filteredSales.length}</strong> of {sales.length} transactions
            </span>
            {(searchTerm || dateFilter !== "all" || statusFilter !== "all" || methodFilter !== "all" || sortBy !== "latest") && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setDateFilter("all");
                  setStatusFilter("all");
                  setMethodFilter("all");
                  setSortBy("latest");
                }}
                className="px-2.5 py-1 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 flex items-center gap-1 cursor-pointer transition-colors"
                title="Reset all filters and sorting"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. SALES HISTORY TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Sales History</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing {filteredSales.length} of {sales.length} transactions
            </p>
          </div>
          {(searchTerm || dateFilter !== "all" || statusFilter !== "all" || methodFilter !== "all") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setDateFilter("all");
                setStatusFilter("all");
                setMethodFilter("all");
              }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {filteredSales.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Items Summary</th>
                  <th className="py-3 px-4 text-center">Qty</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-center">Method</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Date</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredSales.map((sale) => {
                  const isPaid = (sale.payment_status || "Paid").toLowerCase() === "paid";
                  const isPending = (sale.payment_status || "").toLowerCase() === "pending";
                  const itemsCount = sale.items?.length || 1;

                  return (
                    <tr
                      key={sale.id}
                      className="hover:bg-blue-50/30 transition-colors group"
                    >
                      {/* Invoice No */}
                      <td className="py-3.5 px-4 font-mono font-semibold text-blue-600">
                        <button
                          onClick={() => setSelectedInvoice(sale)}
                          className="hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-blue-500" />
                          <span>{sale.invoice_no || `INV-${sale.id}`}</span>
                        </button>
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{sale.customer_name}</div>
                        {sale.customer_phone ? (
                          <div className="text-[11px] text-slate-400 font-mono">
                            {sale.customer_phone}
                          </div>
                        ) : null}
                      </td>

                      {/* Products Summary */}
                      <td className="py-3.5 px-4 text-slate-700 max-w-[200px] truncate">
                        <span title={sale.product_name}>{sale.product_name}</span>
                        {itemsCount > 1 && (
                          <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 rounded-md">
                            {itemsCount} items
                          </span>
                        )}
                      </td>

                      {/* Quantity */}
                      <td className="py-3.5 px-4 text-center text-slate-600 font-medium">
                        {sale.quantity}
                      </td>

                      {/* Total Amount in INR */}
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 font-mono text-sm">
                        {formatCurrency(sale.total_amount)}
                      </td>

                      {/* Payment Method */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-700 rounded-md border border-slate-200">
                          {sale.payment_method || "Cash"}
                        </span>
                      </td>

                      {/* Payment Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full ${
                            isPaid
                              ? "bg-emerald-100 text-emerald-800"
                              : isPending
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {isPaid ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          <span>{sale.payment_status || "Paid"}</span>
                        </span>
                      </td>

                      {/* Sale Date */}
                      <td className="py-3.5 px-4 text-right text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {formatDate(sale.sale_date)}
                      </td>

                      {/* Action Buttons: View, Print, Edit, Delete */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedInvoice(sale)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="View Invoice"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedInvoice(sale);
                              setTimeout(() => window.print(), 300);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Print Invoice"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingSale(sale)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingSale(sale)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Sale (Restores Stock)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <Search className="w-6 h-6" />
            </div>
            <div className="font-bold text-slate-800">No Sales Records Found</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No transactions match your search or filter criteria. Clear filters or create a new sale.
            </p>
            <button
              onClick={() => setIsNewSaleOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Sale</span>
            </button>
          </div>
        )}
      </div>

      {/* 4. MODALS */}
      {/* Create New Sale Modal */}
      <NewSaleModal
        isOpen={isNewSaleOpen}
        onClose={() => setIsNewSaleOpen(false)}
        products={products}
        customers={customers}
        onSaveSale={onAddSale}
        nextInvoiceNumber={nextInvoiceNumber}
      />

      {/* View & Print Invoice Modal */}
      <InvoiceModal
        isOpen={selectedInvoice !== null}
        sale={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
      />

      {/* Edit Sale Modal */}
      <EditSaleModal
        isOpen={editingSale !== null}
        sale={editingSale}
        onClose={() => setEditingSale(null)}
        onUpdateSale={onUpdateSale}
      />

      {/* Delete Confirmation Modal with Inventory Stock Restoration Warning */}
      {deletingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Delete Invoice {deletingSale.invoice_no || `INV-${deletingSale.id}`}?
              </h3>
              <p className="text-xs text-slate-600">
                Are you sure you want to permanently delete this sale for{" "}
                <span className="font-semibold text-slate-800">{deletingSale.customer_name}</span>{" "}
                amounting to{" "}
                <span className="font-bold text-slate-900 font-mono">
                  {formatCurrency(deletingSale.total_amount)}
                </span>
                ?
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2">
              <RotateCcw className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>
                <strong>Inventory Stock Restored:</strong> All items in this invoice will be returned to your product inventory stock automatically.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingSale(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors shadow-2xs cursor-pointer"
              >
                {isDeleting ? "Deleting..." : "Confirm & Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

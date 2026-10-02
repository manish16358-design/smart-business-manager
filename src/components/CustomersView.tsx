import React, { useState, useMemo } from "react";
import { CustomerItem, SaleItem } from "../types";
import { formatCurrency, formatDate } from "../utils/formatters";
import {
  Users,
  UserPlus,
  Search,
  Phone,
  Mail,
  MapPin,
  Building,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Edit2,
  Trash2,
  Receipt,
  Eye,
  X,
  CreditCard,
  IndianRupee,
  Filter,
  ArrowUpDown,
  FileCheck,
  ChevronRight,
  ExternalLink,
  ShoppingBag,
  Calendar,
  Sparkles,
  Info,
} from "lucide-react";

interface CustomersViewProps {
  customers: CustomerItem[];
  sales: SaleItem[];
  onAddCustomer: (customerData: Partial<CustomerItem>) => Promise<boolean>;
  onUpdateCustomer: (id: number, customerData: Partial<CustomerItem>) => Promise<boolean>;
  onDeleteCustomer: (id: number) => Promise<boolean>;
  onRefreshCustomers: () => void;
  onViewInvoice?: (sale: SaleItem) => void;
  onRecordPayment?: (customerId: number, saleId: number, method: string) => Promise<boolean>;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  sales,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  onRefreshCustomers,
  onViewInvoice,
  onRecordPayment,
}) => {
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<"all" | "pending" | "cleared">("all");
  const [sortBy, setSortBy] = useState<"purchases" | "pending" | "orders" | "recent" | "name" | "name_desc">("purchases");

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerItem | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<CustomerItem | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<CustomerItem | null>(null);

  // Form state for Add/Edit
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formGst, setFormGst] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Transaction quick payment state
  const [markingPaidId, setMarkingPaidId] = useState<number | null>(null);

  // ================= DYNAMIC SALES & PURCHASES CALCULATION (Requirement 5 & 6) =================
  // Calculate total purchase amount and last purchase date from real existing sales records
  const customerStatsMap = useMemo(() => {
    const map: Record<
      number,
      {
        totalPurchases: number;
        totalOrders: number;
        lastPurchaseDate: string;
        sales: SaleItem[];
      }
    > = {};

    customers.forEach((c) => {
      const normPhone = (c.phone || "").replace(/\D/g, "");
      const normName = (c.name || "").toLowerCase().trim();

      // Match sales by phone (last 10 digits) or by name
      const matchingSales = sales.filter((s) => {
        const sPhone = (s.customer_phone || "").replace(/\D/g, "");
        const sName = (s.customer_name || "").toLowerCase().trim();

        if (normPhone.length >= 10 && sPhone.length >= 10) {
          if (normPhone.slice(-10) === sPhone.slice(-10)) return true;
        }
        if (normName && sName && normName === sName) return true;
        return false;
      });

      // Sum from real existing sales records (Requirement 6)
      const totalPurchases =
        matchingSales.length > 0
          ? matchingSales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0)
          : Number(c.total_purchases || 0);

      const totalOrders =
        matchingSales.length > 0 ? matchingSales.length : Number(c.total_orders || 0);

      const sortedDates = matchingSales
        .map((s) => (s.sale_date ? s.sale_date.split("T")[0] : ""))
        .filter(Boolean)
        .sort();

      const lastPurchaseDate =
        sortedDates.length > 0
          ? sortedDates[sortedDates.length - 1]
          : c.last_purchase_date || "";

      map[c.id] = {
        totalPurchases,
        totalOrders,
        lastPurchaseDate,
        sales: matchingSales,
      };
    });

    return map;
  }, [customers, sales]);

  // ================= SUMMARY METRICS =================
  const metrics = useMemo(() => {
    const totalCustomers = customers.length;
    let totalPurchases = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let customersWithPending = 0;

    customers.forEach((c) => {
      const stats = customerStatsMap[c.id];
      const p = stats ? stats.totalPurchases : Number(c.total_purchases || 0);
      const paid = Number(c.paid_amount || 0);
      const pend = Number(c.pending_amount || 0);

      totalPurchases += p;
      totalPaid += paid;
      totalPending += pend;

      if (pend > 0.01) {
        customersWithPending += 1;
      }
    });

    return {
      totalCustomers,
      totalPurchases,
      totalPaid,
      totalPending,
      customersWithPending,
    };
  }, [customers, customerStatsMap]);

  // ================= FILTER & SORT (Requirement 2 & 4) =================
  const filteredCustomers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    const filtered = customers.filter((c) => {
      // 1. Search text (Name, Mobile, Email, GST, Address, Notes)
      const matchesSearch =
        !term ||
        c.name.toLowerCase().includes(term) ||
        (c.phone && c.phone.toLowerCase().includes(term)) ||
        (c.email && c.email.toLowerCase().includes(term)) ||
        (c.gst_number && c.gst_number.toLowerCase().includes(term)) ||
        (c.address && c.address.toLowerCase().includes(term)) ||
        (c.notes && c.notes.toLowerCase().includes(term));

      if (!matchesSearch) return false;

      // 2. Balance filter
      const pending = Number(c.pending_amount || 0);
      if (balanceFilter === "pending" && pending <= 0.01) return false;
      if (balanceFilter === "cleared" && pending > 0.01) return false;

      return true;
    });

    // 3. Sorting using dynamically calculated stats
    return [...filtered].sort((a, b) => {
      const aStats = customerStatsMap[a.id];
      const bStats = customerStatsMap[b.id];

      if (sortBy === "purchases") {
        const aVal = aStats ? aStats.totalPurchases : Number(a.total_purchases || 0);
        const bVal = bStats ? bStats.totalPurchases : Number(b.total_purchases || 0);
        return bVal - aVal;
      }
      if (sortBy === "pending") {
        return Number(b.pending_amount || 0) - Number(a.pending_amount || 0);
      }
      if (sortBy === "orders") {
        const aVal = aStats ? aStats.totalOrders : Number(a.total_orders || 0);
        const bVal = bStats ? bStats.totalOrders : Number(b.total_orders || 0);
        return bVal - aVal;
      }
      if (sortBy === "recent") {
        const aDate = aStats ? aStats.lastPurchaseDate : a.last_purchase_date || "";
        const bDate = bStats ? bStats.lastPurchaseDate : b.last_purchase_date || "";
        return bDate.localeCompare(aDate);
      }
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "name_desc") {
        return b.name.localeCompare(a.name);
      }
      return 0;
    });
  }, [customers, searchTerm, balanceFilter, sortBy, customerStatsMap]);

  // Open Edit Modal
  const openEditModal = (customer: CustomerItem) => {
    setEditingCustomer(customer);
    setFormName(customer.name);
    setFormPhone(customer.phone);
    setFormEmail(customer.email || "");
    setFormAddress(customer.address || "");
    setFormGst(customer.gst_number || "");
    setFormNotes(customer.notes || "");
    setFormError(null);
  };

  // Open Add Modal
  const openAddModal = () => {
    setEditingCustomer(null);
    setFormName("");
    setFormPhone("");
    setFormEmail("");
    setFormAddress("");
    setFormGst("");
    setFormNotes("");
    setFormError(null);
    setIsAddModalOpen(true);
  };

  // Save Customer (Add or Edit) with Validation (Requirement 8)
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation (Requirement 8)
    if (!formName.trim()) {
      setFormError("Customer Name is required.");
      return;
    }
    if (formName.trim().length < 2) {
      setFormError("Customer Name must be at least 2 characters.");
      return;
    }
    if (!formPhone.trim()) {
      setFormError("Mobile Number is required.");
      return;
    }
    const digitsOnly = formPhone.trim().replace(/\D/g, "");
    if (digitsOnly.length < 10) {
      setFormError("Please enter a valid mobile number with at least 10 digits (e.g. +91 98765 43210 or 9876543210).");
      return;
    }
    if (formEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail.trim())) {
      setFormError("Please enter a valid email address (e.g. name@example.com).");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<CustomerItem> = {
        name: formName.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim(),
        address: formAddress.trim(),
        gst_number: formGst.trim().toUpperCase(),
        notes: formNotes.trim(),
      };

      let success = false;
      if (editingCustomer) {
        success = await onUpdateCustomer(editingCustomer.id, payload);
      } else {
        success = await onAddCustomer(payload);
      }

      if (success) {
        setIsAddModalOpen(false);
        setEditingCustomer(null);
        // If editing active viewed customer, update modal state
        if (viewingCustomer && editingCustomer && viewingCustomer.id === editingCustomer.id) {
          setViewingCustomer((prev) => (prev ? { ...prev, ...payload } : null));
        }
      }
    } catch (err: any) {
      setFormError(err.message || "An error occurred while saving customer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick action: Mark invoice as paid for a customer
  const handleMarkInvoicePaid = async (saleId: number) => {
    if (!viewingCustomer) return;
    setMarkingPaidId(saleId);
    try {
      if (onRecordPayment) {
        await onRecordPayment(viewingCustomer.id, saleId, "UPI");
      } else {
        const res = await fetch(`/api/customers/${viewingCustomer.id}/pay-invoice`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sale_id: saleId, payment_method: "UPI" }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to mark invoice as paid");
        }
      }
      onRefreshCustomers();
    } catch (err: any) {
      console.warn("Failed to mark invoice as paid:", err.message);
    } finally {
      setMarkingPaidId(null);
    }
  };

  // Delete Customer Handler
  const handleDeleteCustomer = async () => {
    if (!deletingCustomer) return;
    setIsSubmitting(true);
    try {
      const success = await onDeleteCustomer(deletingCustomer.id);
      if (success) {
        if (viewingCustomer && viewingCustomer.id === deletingCustomer.id) {
          setViewingCustomer(null);
        }
        setDeletingCustomer(null);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. HEADER SECTION (Requirement 1 & 2) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Customer Management</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
              {customers.length} Registered
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage customer directory, mobile contacts, purchase history, and sales ledgers.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onRefreshCustomers}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            title="Refresh Customer Records"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all hover:shadow-md cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New Customer</span>
          </button>
        </div>
      </div>

      {/* 2. SUMMARY METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Customers */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Customers
            </span>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {metrics.totalCustomers}
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <span className="font-semibold text-blue-600">Active Directory</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Total Sales Volume from real sales records */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Purchases
            </span>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {formatCurrency(metrics.totalPurchases)}
            </div>
            <div className="text-[11px] text-slate-500">Calculated from sales records</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Total Collected / Paid */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Received (Paid)
            </span>
            <div className="text-2xl font-bold text-emerald-600 font-mono">
              {formatCurrency(metrics.totalPaid)}
            </div>
            <div className="text-[11px] text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Settled payments</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Pending Receivables */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Pending Receivables
            </span>
            <div className="text-2xl font-bold text-amber-600 font-mono">
              {formatCurrency(metrics.totalPending)}
            </div>
            <div className="text-[11px] text-amber-700 flex items-center gap-1">
              {metrics.customersWithPending > 0 ? (
                <>
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span className="font-semibold">{metrics.customersWithPending} customer(s) with dues</span>
                </>
              ) : (
                <span className="text-emerald-600 font-semibold">All accounts settled</span>
              )}
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. SEARCH & FILTER CONTROLS (Requirement 2) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by customer name, mobile number, email, address, or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filters & Sorter */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Balance Filter */}
            <div className="flex items-center gap-1 bg-slate-50 p-1 border border-slate-200 rounded-xl text-xs">
              <button
                onClick={() => setBalanceFilter("all")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  balanceFilter === "all"
                    ? "bg-white text-blue-600 font-bold shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All ({customers.length})
              </button>
              <button
                onClick={() => setBalanceFilter("pending")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  balanceFilter === "pending"
                    ? "bg-white text-amber-700 font-bold shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Pending Dues ({metrics.customersWithPending})
              </button>
              <button
                onClick={() => setBalanceFilter("cleared")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  balanceFilter === "cleared"
                    ? "bg-white text-emerald-700 font-bold shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Zero Dues
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs text-slate-700">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent border-none text-xs text-slate-700 focus:outline-hidden font-medium cursor-pointer"
              >
                <option value="purchases">Sort: Highest Purchases</option>
                <option value="recent">Sort: Last Purchase Date</option>
                <option value="orders">Sort: Most Orders</option>
                <option value="pending">Sort: Highest Pending</option>
                <option value="name">Sort: Name (A-Z)</option>
                <option value="name_desc">Sort: Name (Z-A)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 4. CUSTOMER LIST TABLE (Requirement 4, 6, 9) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Customer Directory</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing {filteredCustomers.length} of {customers.length} registered customers with real purchase totals
            </p>
          </div>
          {(searchTerm || balanceFilter !== "all") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setBalanceFilter("all");
              }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {filteredCustomers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Mobile Number</th>
                  <th className="py-3 px-4 text-right">Total Purchases</th>
                  <th className="py-3 px-4 text-right">Last Purchase Date</th>
                  <th className="py-3 px-4">Address / Email</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredCustomers.map((c) => {
                  const stats = customerStatsMap[c.id];
                  const totalPurchases = stats ? stats.totalPurchases : Number(c.total_purchases || 0);
                  const totalOrders = stats ? stats.totalOrders : Number(c.total_orders || 0);
                  const lastPurchase = stats ? stats.lastPurchaseDate : c.last_purchase_date || "";

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-blue-50/30 transition-colors group"
                    >
                      {/* 1. Customer Name (Requirement 4) */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => setViewingCustomer(c)}
                          className="text-left font-bold text-slate-900 hover:text-blue-600 transition-colors flex items-center gap-2 cursor-pointer"
                        >
                          <span>{c.name}</span>
                          {c.gst_number && (
                            <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-slate-100 text-slate-700 rounded border border-slate-200">
                              GST
                            </span>
                          )}
                        </button>
                        {c.notes ? (
                          <div className="text-[11px] text-slate-400 truncate max-w-[200px] mt-0.5" title={c.notes}>
                            {c.notes}
                          </div>
                        ) : null}
                      </td>

                      {/* 2. Mobile Number (Requirement 4) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-slate-800 text-[11px]">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{c.phone}</span>
                        </div>
                      </td>

                      {/* 3. Total Purchases (Requirement 4 & 6 - Real calculated sales) */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-bold text-slate-900 font-mono text-sm">
                          {formatCurrency(totalPurchases)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {totalOrders > 0 ? `${totalOrders} order(s)` : "No orders"}
                        </div>
                      </td>

                      {/* 4. Last Purchase Date (Requirement 4 & 9 - Graceful when none) */}
                      <td className="py-3.5 px-4 text-right">
                        {lastPurchase ? (
                          <div className="font-mono text-slate-700 text-[11px] whitespace-nowrap">
                            {formatDate(lastPurchase)}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">
                            No purchases yet
                          </span>
                        )}
                      </td>

                      {/* 5. Address / Email */}
                      <td className="py-3.5 px-4 text-slate-600 max-w-[220px]">
                        {c.email && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 truncate mb-0.5">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span title={c.email} className="truncate">{c.email}</span>
                          </div>
                        )}
                        {c.address ? (
                          <div className="flex items-start gap-1 text-[11px] text-slate-500 line-clamp-1" title={c.address}>
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                            <span>{c.address}</span>
                          </div>
                        ) : (
                          !c.email && <span className="text-slate-400 italic text-[11px]">No contact details</span>
                        )}
                      </td>

                      {/* 6. Actions (Requirement 2: View, Edit, Delete) */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* View Customer Details Button */}
                          <button
                            onClick={() => setViewingCustomer(c)}
                            className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="View Customer Details & Purchase History"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Edit Customer */}
                          <button
                            onClick={() => openEditModal(c)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit Customer Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Customer */}
                          <button
                            onClick={() => setDeletingCustomer(c)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Customer"
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
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-slate-700">No Customers Found</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchTerm || balanceFilter !== "all"
                ? "No customer matches your search or active filter. Try resetting filters."
                : "You haven't added any customers yet. Add your first client to start tracking customer purchases and records."}
            </p>
            <div className="pt-2">
              {searchTerm || balanceFilter !== "all" ? (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setBalanceFilter("all");
                  }}
                  className="px-4 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                >
                  Clear Filters
                </button>
              ) : (
                <button
                  onClick={openAddModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Add First Customer</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 5. ADD / EDIT CUSTOMER MODAL (Requirement 2, 3, 8) */}
      {(isAddModalOpen || editingCustomer !== null) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <UserPlus className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">
                    {editingCustomer ? `Edit Customer: ${editingCustomer.name}` : "Add New Customer"}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {editingCustomer
                      ? "Update customer profile and contact details"
                      : "Create a customer profile for billing, sales history, and record tracking"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingCustomer(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveCustomer} className="p-6 space-y-4 overflow-y-auto">
              {formError && (
                <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Customer Name (Requirement 3) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Solutions Pvt Ltd or Rajesh Kumar"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              {/* Mobile Number & Email (Requirement 3 & 8) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 43210"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      className="w-full text-xs pl-8 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address <span className="text-slate-400 text-[10px]">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      placeholder="client@domain.com"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="w-full text-xs pl-8 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Address (Requirement 3) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Address <span className="text-slate-400 text-[10px]">(Optional)</span>
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <textarea
                    rows={2}
                    placeholder="e.g. Suite 402, Trade Tower, Bandra Kurla Complex, Mumbai"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    className="w-full text-xs pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>
              </div>

              {/* Notes (Requirement 3) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes <span className="text-slate-400 text-[10px]">(Optional)</span>
                </label>
                <div className="relative">
                  <FileText className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <textarea
                    rows={2}
                    placeholder="e.g. Regular bulk buyer, 30-day payment terms, preferred contact person..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full text-xs pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>
              </div>

              {/* GSTIN (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  GST Number (GSTIN) <span className="text-slate-400 text-[10px]">(Optional)</span>
                </label>
                <div className="relative">
                  <Building className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    maxLength={15}
                    placeholder="e.g. 27AABCS1429B1Z8"
                    value={formGst}
                    onChange={(e) => setFormGst(e.target.value.toUpperCase())}
                    className="w-full text-xs pl-8 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900 font-mono uppercase"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingCustomer(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-all hover:shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : editingCustomer ? "Save Changes" : "Create Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. COMPLETE CUSTOMER DETAILS & PURCHASE HISTORY MODAL (Requirements 2, 3, 5, 6, 9) */}
      {viewingCustomer && (() => {
        const stats = customerStatsMap[viewingCustomer.id];
        const customerSales = stats ? stats.sales : [];
        const totalPurchases = stats ? stats.totalPurchases : Number(viewingCustomer.total_purchases || 0);
        const totalOrders = stats ? stats.totalOrders : Number(viewingCustomer.total_orders || 0);
        const lastPurchaseDate = stats ? stats.lastPurchaseDate : viewingCustomer.last_purchase_date || "";

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
              {/* Header */}
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
                    {viewingCustomer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-white">{viewingCustomer.name}</h3>
                      {viewingCustomer.gst_number && (
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-800 text-slate-300 rounded border border-slate-700">
                          GST: {viewingCustomer.gst_number}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-3 mt-0.5 font-mono">
                      <span>{viewingCustomer.phone}</span>
                      {viewingCustomer.email && <span>• {viewingCustomer.email}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const c = viewingCustomer;
                      setViewingCustomer(null);
                      openEditModal(c);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewingCustomer(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Customer Metrics Strip (Requirements 4 & 6) */}
              <div className="bg-slate-50 px-6 py-3.5 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total Purchases</span>
                  <div className="font-mono font-bold text-slate-900 text-base mt-0.5">
                    {formatCurrency(totalPurchases)}
                  </div>
                  <div className="text-[10px] text-slate-400">From sales records</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total Invoices</span>
                  <div className="font-mono font-bold text-slate-900 text-base mt-0.5">
                    {totalOrders} {totalOrders === 1 ? "Order" : "Orders"}
                  </div>
                  <div className="text-[10px] text-slate-400">Recorded transactions</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Last Purchase</span>
                  <div className="font-mono font-bold text-slate-900 text-base mt-0.5">
                    {lastPurchaseDate ? formatDate(lastPurchaseDate) : "None"}
                  </div>
                  <div className="text-[10px] text-slate-400">Most recent order</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Account Status</span>
                  <div className="font-mono font-bold text-emerald-600 text-base mt-0.5">
                    {Number(viewingCustomer.pending_amount || 0) > 0 ? (
                      <span className="text-amber-600">Pending Dues</span>
                    ) : (
                      "Active / Cleared"
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400">Billing ledger standing</div>
                </div>
              </div>

              {/* Profile Details (Requirement 3: Name, Mobile, Email, Address, Notes) */}
              <div className="px-6 py-4 bg-white border-b border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Contact &amp; Location
                  </div>
                  <div className="flex items-center gap-2 text-slate-800">
                    <Phone className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="font-mono font-semibold">{viewingCustomer.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-800">
                    <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>{viewingCustomer.email || "No email address provided"}</span>
                  </div>
                  <div className="flex items-start gap-2 text-slate-800">
                    <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>{viewingCustomer.address || "No billing address provided"}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Customer Notes &amp; Terms
                  </div>
                  {viewingCustomer.notes ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 leading-relaxed text-[11px]">
                      {viewingCustomer.notes}
                    </div>
                  ) : (
                    <div className="text-slate-400 italic text-[11px]">
                      No notes recorded for this customer.
                    </div>
                  )}
                </div>
              </div>

              {/* Sales / Purchase History (Requirement 5 & 9) */}
              <div className="p-6 overflow-y-auto flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-blue-600" />
                    <span>Sales &amp; Purchase History</span>
                  </h4>
                  <span className="text-xs text-slate-500 font-mono">
                    {customerSales.length} invoice(s)
                  </span>
                </div>

                {customerSales.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                          <th className="py-2.5 px-4">Invoice #</th>
                          <th className="py-2.5 px-4">Date</th>
                          <th className="py-2.5 px-4">Items / Product</th>
                          <th className="py-2.5 px-4 text-right">Total Amount</th>
                          <th className="py-2.5 px-4 text-center">Payment</th>
                          <th className="py-2.5 px-4 text-center">Status</th>
                          <th className="py-2.5 px-4 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {customerSales.map((tx) => {
                          const isPaid = (tx.payment_status || "Paid").toLowerCase() === "paid";
                          const isPending = (tx.payment_status || "").toLowerCase() === "pending";

                          return (
                            <tr key={tx.id} className="hover:bg-slate-50/60">
                              <td className="py-3 px-4 font-mono font-bold text-blue-600">
                                {tx.invoice_no || `INV-${tx.id}`}
                              </td>
                              <td className="py-3 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                                {formatDate(tx.sale_date)}
                              </td>
                              <td className="py-3 px-4 text-slate-800 max-w-[220px] truncate" title={tx.product_name}>
                                <span>{tx.product_name}</span>
                                {tx.items && tx.items.length > 1 && (
                                  <span className="ml-1.5 px-1.5 py-0.2 text-[10px] bg-slate-100 text-slate-600 rounded">
                                    {tx.items.length} items
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono">
                                {formatCurrency(tx.total_amount)}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-700 rounded border border-slate-200">
                                  {tx.payment_method || "Cash"}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full ${
                                    isPaid
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {isPaid ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                  <span>{tx.payment_status || "Paid"}</span>
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  {isPending && (
                                    <button
                                      onClick={() => handleMarkInvoicePaid(tx.id)}
                                      disabled={markingPaidId === tx.id}
                                      className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                                      title="Mark invoice as Paid"
                                    >
                                      {markingPaidId === tx.id ? "Saving..." : "Mark Paid"}
                                    </button>
                                  )}
                                  {onViewInvoice && (
                                    <button
                                      onClick={() => {
                                        setViewingCustomer(null);
                                        onViewInvoice(tx);
                                      }}
                                      className="p-1 text-slate-500 hover:text-blue-600 rounded transition-colors cursor-pointer"
                                      title="View & Print Full Invoice"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* Graceful Handling of No Purchase History (Requirement 9) */
                  <div className="p-8 text-center space-y-2 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-bold text-slate-800">
                      No Purchase History Found
                    </div>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      No sales records have been recorded for {viewingCustomer.name} yet. When you record a sale for this customer in the Sales section (matching their name or mobile number), their purchase history and total spending will automatically appear here.
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Customer ID: #{viewingCustomer.id}
                </span>
                <button
                  type="button"
                  onClick={() => setViewingCustomer(null)}
                  className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 7. DELETE CONFIRMATION MODAL (Requirement 2) */}
      {deletingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Delete Customer "{deletingCustomer.name}"?
              </h3>
              <p className="text-xs text-slate-600">
                Are you sure you want to delete this customer record?
              </p>
            </div>

            {/* Warning block */}
            {(() => {
              const stats = customerStatsMap[deletingCustomer.id];
              const totalOrders = stats ? stats.totalOrders : Number(deletingCustomer.total_orders || 0);
              const totalPurchases = stats ? stats.totalPurchases : Number(deletingCustomer.total_purchases || 0);

              return (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1 text-slate-700">
                  <div className="flex items-center justify-between font-mono">
                    <span>Total Orders:</span>
                    <span className="font-bold text-slate-900">{totalOrders}</span>
                  </div>
                  <div className="flex items-center justify-between font-mono">
                    <span>Total Purchases:</span>
                    <span className="font-bold text-slate-900">{formatCurrency(totalPurchases)}</span>
                  </div>
                  {Number(deletingCustomer.pending_amount || 0) > 0 && (
                    <div className="flex items-center justify-between font-mono text-amber-700 font-bold">
                      <span>Pending Balance:</span>
                      <span>{formatCurrency(deletingCustomer.pending_amount)}</span>
                    </div>
                  )}
                </div>
              );
            })()}

            <p className="text-[11px] text-slate-500 text-center">
              Note: Past sales invoices will remain preserved in your Sales records for accounting compliance.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCustomer(null)}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCustomer}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? "Deleting..." : "Confirm & Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

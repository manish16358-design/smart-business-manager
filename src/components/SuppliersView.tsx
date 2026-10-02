import React, { useState, useMemo, useEffect } from "react";
import { SupplierItem, SupplierPurchaseItem } from "../types";
import { formatCurrency, formatDate } from "../utils/formatters";
import {
  Truck,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Building2,
  FileText,
  Clock,
  AlertTriangle,
  RotateCcw,
  Edit2,
  Trash2,
  Eye,
  X,
  CreditCard,
  ShoppingBag,
  Package,
  Calendar,
  CheckCircle2,
  ArrowUpDown,
  ExternalLink,
  PlusCircle,
} from "lucide-react";

interface SuppliersViewProps {
  suppliers: SupplierItem[];
  onAddSupplier: (supplierData: Partial<SupplierItem>) => Promise<boolean>;
  onUpdateSupplier: (id: number, supplierData: Partial<SupplierItem>) => Promise<boolean>;
  onDeleteSupplier: (id: number) => Promise<boolean>;
  onRefreshSuppliers: () => void;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  suppliers,
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
  onRefreshSuppliers,
}) => {
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"purchases" | "recent" | "company" | "name">("purchases");

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierItem | null>(null);
  const [deletingSupplier, setDeletingSupplier] = useState<SupplierItem | null>(null);
  const [viewingSupplier, setViewingSupplier] = useState<SupplierItem | null>(null);

  // Form state for Add/Edit
  const [formName, setFormName] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [formMobile, setFormMobile] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Supplier purchases history in details modal
  const [supplierPurchases, setSupplierPurchases] = useState<SupplierPurchaseItem[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(false);

  // Record Purchase modal inside details
  const [isRecordPurchaseOpen, setIsRecordPurchaseOpen] = useState(false);
  const [purchaseProductName, setPurchaseProductName] = useState("");
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [purchaseUnitCost, setPurchaseUnitCost] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [purchasePaymentMethod, setPurchasePaymentMethod] = useState("Net Banking");
  const [purchasePaymentStatus, setPurchasePaymentStatus] = useState("Paid");
  const [purchaseNotes, setPurchaseNotes] = useState("");
  const [purchaseSubmitting, setPurchaseSubmitting] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalSuppliers = suppliers.length;
    let totalPurchases = 0;
    let activeSuppliers = 0;

    suppliers.forEach((s) => {
      const p = Number(s.total_purchases || 0);
      totalPurchases += p;
      if (p > 0) activeSuppliers += 1;
    });

    return {
      totalSuppliers,
      totalPurchases,
      activeSuppliers,
    };
  }, [suppliers]);

  // Filtered and Sorted Suppliers
  const filteredSuppliers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    const filtered = suppliers.filter((s) => {
      if (!term) return true;
      return (
        s.name.toLowerCase().includes(term) ||
        s.company_name.toLowerCase().includes(term) ||
        s.mobile.toLowerCase().includes(term) ||
        (s.email && s.email.toLowerCase().includes(term)) ||
        (s.address && s.address.toLowerCase().includes(term)) ||
        (s.notes && s.notes.toLowerCase().includes(term))
      );
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "purchases") {
        return Number(b.total_purchases || 0) - Number(a.total_purchases || 0);
      }
      if (sortBy === "recent") {
        return (b.last_purchase_date || "").localeCompare(a.last_purchase_date || "");
      }
      if (sortBy === "company") {
        return a.company_name.localeCompare(b.company_name);
      }
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });
  }, [suppliers, searchTerm, sortBy]);

  // Fetch supplier purchase history when viewing a supplier
  const fetchSupplierPurchases = async (id: number) => {
    setLoadingPurchases(true);
    try {
      const res = await fetch(`/api/suppliers/${id}/purchases`);
      const data = await res.json();
      if (data && data.success && Array.isArray(data.purchases)) {
        setSupplierPurchases(data.purchases);
      } else {
        setSupplierPurchases([]);
      }
    } catch (err) {
      console.warn("Failed to fetch supplier purchases:", err);
      setSupplierPurchases([]);
    } finally {
      setLoadingPurchases(false);
    }
  };

  const handleOpenDetails = (supplier: SupplierItem) => {
    setViewingSupplier(supplier);
    setIsRecordPurchaseOpen(false);
    fetchSupplierPurchases(supplier.id);
  };

  // Open Edit Modal
  const openEditModal = (supplier: SupplierItem) => {
    setEditingSupplier(supplier);
    setFormName(supplier.name);
    setFormCompany(supplier.company_name);
    setFormMobile(supplier.mobile);
    setFormEmail(supplier.email || "");
    setFormAddress(supplier.address || "");
    setFormNotes(supplier.notes || "");
    setFormError(null);
  };

  // Open Add Modal
  const openAddModal = () => {
    setEditingSupplier(null);
    setFormName("");
    setFormCompany("");
    setFormMobile("");
    setFormEmail("");
    setFormAddress("");
    setFormNotes("");
    setFormError(null);
    setIsAddModalOpen(true);
  };

  // Save Supplier with Validation (Requirement 11)
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation (Requirement 11)
    if (!formName.trim()) {
      setFormError("Supplier Contact Name is required.");
      return;
    }
    if (formName.trim().length < 2) {
      setFormError("Supplier Name must be at least 2 characters.");
      return;
    }
    if (!formCompany.trim()) {
      setFormError("Company / Vendor Name is required.");
      return;
    }
    if (!formMobile.trim()) {
      setFormError("Mobile Number is required.");
      return;
    }
    const digitsOnly = formMobile.trim().replace(/\D/g, "");
    if (digitsOnly.length < 10) {
      setFormError("Please enter a valid mobile number with at least 10 digits (e.g. +91 98765 43210 or 9876543210).");
      return;
    }
    if (formEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail.trim())) {
      setFormError("Please enter a valid email address (e.g. name@domain.com).");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<SupplierItem> = {
        name: formName.trim(),
        company_name: formCompany.trim(),
        mobile: formMobile.trim(),
        email: formEmail.trim(),
        address: formAddress.trim(),
        notes: formNotes.trim(),
      };

      let success = false;
      if (editingSupplier) {
        success = await onUpdateSupplier(editingSupplier.id, payload);
      } else {
        success = await onAddSupplier(payload);
      }

      if (success) {
        setIsAddModalOpen(false);
        setEditingSupplier(null);
        if (viewingSupplier && editingSupplier && viewingSupplier.id === editingSupplier.id) {
          setViewingSupplier((prev) => (prev ? { ...prev, ...payload } : null));
        }
      }
    } catch (err: any) {
      setFormError(err.message || "An error occurred while saving supplier.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Record a purchase order for active supplier
  const handleRecordPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingSupplier) return;
    setPurchaseError(null);

    if (!purchaseProductName.trim()) {
      setPurchaseError("Product / Item name is required.");
      return;
    }
    const cost = parseFloat(purchaseUnitCost);
    if (isNaN(cost) || cost < 0) {
      setPurchaseError("Unit cost must be a non-negative number.");
      return;
    }
    if (purchaseQuantity < 1) {
      setPurchaseError("Quantity must be at least 1.");
      return;
    }

    setPurchaseSubmitting(true);
    try {
      const res = await fetch(`/api/suppliers/${viewingSupplier.id}/purchases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_name: purchaseProductName.trim(),
          quantity: purchaseQuantity,
          unit_cost: cost,
          purchase_date: purchaseDate,
          payment_method: purchasePaymentMethod,
          payment_status: purchasePaymentStatus,
          notes: purchaseNotes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to record purchase.");
      }

      // Refresh purchases and main supplier list
      setIsRecordPurchaseOpen(false);
      setPurchaseProductName("");
      setPurchaseUnitCost("");
      setPurchaseQuantity(1);
      setPurchaseNotes("");
      fetchSupplierPurchases(viewingSupplier.id);
      onRefreshSuppliers();
    } catch (err: any) {
      setPurchaseError(err.message || "Failed to record purchase.");
    } finally {
      setPurchaseSubmitting(false);
    }
  };

  // Delete Supplier Handler
  const handleDeleteSupplier = async () => {
    if (!deletingSupplier) return;
    setIsSubmitting(true);
    try {
      const success = await onDeleteSupplier(deletingSupplier.id);
      if (success) {
        if (viewingSupplier && viewingSupplier.id === deletingSupplier.id) {
          setViewingSupplier(null);
        }
        setDeletingSupplier(null);
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
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Supplier &amp; Vendor Management</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
              {suppliers.length} Registered
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage vendors, procurement contracts, purchase history, and product intake orders.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onRefreshSuppliers}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            title="Refresh Supplier Records"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all hover:shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Supplier</span>
          </button>
        </div>
      </div>

      {/* 2. SUMMARY METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Suppliers */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Suppliers
            </span>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {metrics.totalSuppliers}
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <span className="font-semibold text-blue-600">Active Vendor Accounts</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Total Purchase / Procurement Volume (Requirement 9) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Procurement Amount
            </span>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {formatCurrency(metrics.totalPurchases)}
            </div>
            <div className="text-[11px] text-slate-500">Calculated from purchase records</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Active Supplying Vendors */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Procurement Vendors
            </span>
            <div className="text-2xl font-bold text-emerald-600 font-mono">
              {metrics.activeSuppliers} / {metrics.totalSuppliers}
            </div>
            <div className="text-[11px] text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Vendors with purchase history</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. SEARCH & SORT TOOLBAR (Requirement 2) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by supplier name, company name, mobile number, address, or notes..."
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

          {/* Sorter */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs text-slate-700">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent border-none text-xs text-slate-700 focus:outline-hidden font-medium cursor-pointer"
              >
                <option value="purchases">Sort: Highest Purchases</option>
                <option value="recent">Sort: Last Purchase Date</option>
                <option value="company">Sort: Company Name (A-Z)</option>
                <option value="name">Sort: Contact Name (A-Z)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 4. SUPPLIER LIST TABLE (Requirement 4, 9, 10, 13) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Supplier Directory</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing {filteredSuppliers.length} of {suppliers.length} registered suppliers and vendors
            </p>
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Search</span>
            </button>
          )}
        </div>

        {filteredSuppliers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-3 px-4">Supplier &amp; Company</th>
                  <th className="py-3 px-4">Mobile Number</th>
                  <th className="py-3 px-4 text-right">Total Purchases</th>
                  <th className="py-3 px-4 text-right">Last Purchase Date</th>
                  <th className="py-3 px-4">Address / Email</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredSuppliers.map((s) => {
                  const totalPurchases = Number(s.total_purchases || 0);

                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-blue-50/30 transition-colors group"
                    >
                      {/* 1. Supplier Name & Company Name (Requirement 4) */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleOpenDetails(s)}
                          className="text-left font-bold text-slate-900 hover:text-blue-600 transition-colors flex items-center gap-2 cursor-pointer"
                        >
                          <span>{s.company_name}</span>
                        </button>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <span>Contact: {s.name}</span>
                        </div>
                        {s.notes ? (
                          <div className="text-[10px] text-slate-400 truncate max-w-[200px] mt-0.5" title={s.notes}>
                            {s.notes}
                          </div>
                        ) : null}
                      </td>

                      {/* 2. Mobile Number (Requirement 4) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-slate-800 text-[11px]">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{s.mobile}</span>
                        </div>
                      </td>

                      {/* 3. Total Purchase Amount (Requirement 4 & 9) */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-bold text-slate-900 font-mono text-sm">
                          {formatCurrency(totalPurchases)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {totalPurchases > 0 ? "Procurement orders" : "No orders yet"}
                        </div>
                      </td>

                      {/* 4. Last Purchase Date (Requirement 4 & 10) */}
                      <td className="py-3.5 px-4 text-right">
                        {s.last_purchase_date ? (
                          <div className="font-mono text-slate-700 text-[11px] whitespace-nowrap">
                            {formatDate(s.last_purchase_date)}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">
                            No purchases yet
                          </span>
                        )}
                      </td>

                      {/* 5. Address / Email */}
                      <td className="py-3.5 px-4 text-slate-600 max-w-[220px]">
                        {s.email && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 truncate mb-0.5">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span title={s.email} className="truncate">{s.email}</span>
                          </div>
                        )}
                        {s.address ? (
                          <div className="flex items-start gap-1 text-[11px] text-slate-500 line-clamp-1" title={s.address}>
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                            <span>{s.address}</span>
                          </div>
                        ) : (
                          !s.email && <span className="text-slate-400 italic text-[11px]">No contact details</span>
                        )}
                      </td>

                      {/* 6. Actions (Requirement 2: View, Edit, Delete) */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* View Details Button */}
                          <button
                            onClick={() => handleOpenDetails(s)}
                            className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="View Supplier Details & Purchase Orders"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Edit Supplier */}
                          <button
                            onClick={() => openEditModal(s)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit Supplier Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Supplier */}
                          <button
                            onClick={() => setDeletingSupplier(s)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Supplier"
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
              <Truck className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-slate-700">No Suppliers Found</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchTerm
                ? "No supplier matches your search query. Try clearing your search term."
                : "No suppliers registered yet. Add your first vendor to begin tracking supplier purchases and stock intake."}
            </p>
            <div className="pt-2">
              {searchTerm ? (
                <button
                  onClick={() => setSearchTerm("")}
                  className="px-4 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                >
                  Clear Search
                </button>
              ) : (
                <button
                  onClick={openAddModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Supplier</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 5. ADD / EDIT SUPPLIER MODAL (Requirement 2, 3, 11) */}
      {(isAddModalOpen || editingSupplier !== null) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <Truck className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">
                    {editingSupplier ? `Edit Supplier: ${editingSupplier.company_name}` : "Add New Supplier / Vendor"}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {editingSupplier
                      ? "Update vendor company and contact information"
                      : "Create a vendor profile for inventory intake and purchase orders"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingSupplier(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveSupplier} className="p-6 space-y-4 overflow-y-auto">
              {formError && (
                <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Company Name & Supplier Contact Name (Requirement 3) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Company / Vendor Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Metro Electronics Distribution"
                    value={formCompany}
                    onChange={(e) => setFormCompany(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Person Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rajesh Verma"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>
              </div>

              {/* Mobile Number & Email (Requirement 3 & 11) */}
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
                      placeholder="+91 98111 22334"
                      value={formMobile}
                      onChange={(e) => setFormMobile(e.target.value)}
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
                      placeholder="vendor@domain.com"
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
                  Address / Warehouse Location <span className="text-slate-400 text-[10px]">(Optional)</span>
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <textarea
                    rows={2}
                    placeholder="e.g. Warehouse 14, Okhla Industrial Area Phase 3, New Delhi"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    className="w-full text-xs pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>
              </div>

              {/* Notes (Requirement 3) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes &amp; Supply Terms <span className="text-slate-400 text-[10px]">(Optional)</span>
                </label>
                <div className="relative">
                  <FileText className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <textarea
                    rows={2}
                    placeholder="e.g. Net 30 payment terms, supplies monitors and barcode equipment, warranty contact..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full text-xs pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingSupplier(null);
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
                  {isSubmitting ? "Saving..." : editingSupplier ? "Save Changes" : "Create Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. COMPLETE SUPPLIER DETAILS & PURCHASE ORDERS MODAL (Requirement 2, 3, 4, 8, 9, 10) */}
      {viewingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
                  <Truck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">{viewingSupplier.company_name}</h3>
                  <div className="text-xs text-slate-400 flex items-center gap-3 mt-0.5 font-mono">
                    <span>Contact: {viewingSupplier.name}</span>
                    <span>• {viewingSupplier.mobile}</span>
                    {viewingSupplier.email && <span>• {viewingSupplier.email}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const s = viewingSupplier;
                    setViewingSupplier(null);
                    openEditModal(s);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingSupplier(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Supplier Metrics Strip (Requirement 4 & 9) */}
            <div className="bg-slate-50 px-6 py-3.5 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Procurement</span>
                <div className="font-mono font-bold text-slate-900 text-base mt-0.5">
                  {formatCurrency(viewingSupplier.total_purchases)}
                </div>
                <div className="text-[10px] text-slate-400">From purchase records</div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Purchase Orders</span>
                <div className="font-mono font-bold text-slate-900 text-base mt-0.5">
                  {supplierPurchases.length} {supplierPurchases.length === 1 ? "Order" : "Orders"}
                </div>
                <div className="text-[10px] text-slate-400">Recorded transactions</div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Last Purchase</span>
                <div className="font-mono font-bold text-slate-900 text-base mt-0.5">
                  {viewingSupplier.last_purchase_date ? formatDate(viewingSupplier.last_purchase_date) : "None"}
                </div>
                <div className="text-[10px] text-slate-400">Most recent intake</div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Vendor Status</span>
                <div className="font-mono font-bold text-emerald-600 text-base mt-0.5">
                  {Number(viewingSupplier.total_purchases || 0) > 0 ? "Active Supplier" : "Registered"}
                </div>
                <div className="text-[10px] text-slate-400">Procurement standing</div>
              </div>
            </div>

            {/* Profile Details (Requirement 3: Name, Mobile, Email, Address, Company Name, Notes) */}
            <div className="px-6 py-4 bg-white border-b border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Contact &amp; Location
                </div>
                <div className="flex items-center gap-2 text-slate-800">
                  <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="font-semibold">{viewingSupplier.company_name}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-800">
                  <Phone className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="font-mono font-semibold">{viewingSupplier.mobile}</span>
                  <span className="text-slate-400">({viewingSupplier.name})</span>
                </div>
                <div className="flex items-center gap-2 text-slate-800">
                  <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{viewingSupplier.email || "No email address provided"}</span>
                </div>
                <div className="flex items-start gap-2 text-slate-800">
                  <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>{viewingSupplier.address || "No warehouse / business address provided"}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Notes &amp; Terms
                </div>
                {viewingSupplier.notes ? (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 leading-relaxed text-[11px]">
                    {viewingSupplier.notes}
                  </div>
                ) : (
                  <div className="text-slate-400 italic text-[11px]">
                    No notes recorded for this vendor.
                  </div>
                )}
              </div>
            </div>

            {/* Purchase Orders History & Action (Requirement 8, 9, 10) */}
            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-blue-600" />
                  <span>Procurement &amp; Purchase Orders History</span>
                </h4>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 font-mono">
                    {supplierPurchases.length} order(s)
                  </span>
                  <button
                    onClick={() => setIsRecordPurchaseOpen(!isRecordPurchaseOpen)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>{isRecordPurchaseOpen ? "Cancel PO Form" : "Record Purchase Order"}</span>
                  </button>
                </div>
              </div>

              {/* Inline Record Purchase Form */}
              {isRecordPurchaseOpen && (
                <form
                  onSubmit={handleRecordPurchase}
                  className="p-4 bg-slate-50 border border-blue-200 rounded-xl space-y-3 animate-in fade-in duration-150"
                >
                  <div className="font-bold text-xs text-slate-800 flex items-center gap-2">
                    <PlusCircle className="w-4 h-4 text-blue-600" />
                    <span>New Purchase Order from {viewingSupplier.company_name}</span>
                  </div>

                  {purchaseError && (
                    <div className="p-2 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                      {purchaseError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Product / Item Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Ultra HD Monitor 27-inch"
                        value={purchaseProductName}
                        onChange={(e) => setPurchaseProductName(e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Quantity *
                      </label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={purchaseQuantity}
                        onChange={(e) => setPurchaseQuantity(parseInt(e.target.value, 10) || 1)}
                        className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Unit Cost (₹) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        placeholder="0.00"
                        value={purchaseUnitCost}
                        onChange={(e) => setPurchaseUnitCost(e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Purchase Date
                      </label>
                      <input
                        type="date"
                        value={purchaseDate}
                        onChange={(e) => setPurchaseDate(e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Payment Method
                      </label>
                      <select
                        value={purchasePaymentMethod}
                        onChange={(e) => setPurchasePaymentMethod(e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900"
                      >
                        <option value="Net Banking">Net Banking</option>
                        <option value="UPI">UPI</option>
                        <option value="Card">Card</option>
                        <option value="Cash">Cash</option>
                        <option value="Cheque">Cheque</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Payment Status
                      </label>
                      <select
                        value={purchasePaymentStatus}
                        onChange={(e) => setPurchasePaymentStatus(e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900"
                      >
                        <option value="Paid">Paid</option>
                        <option value="Pending">Pending</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="text-xs font-mono font-bold text-slate-700">
                      Total: {formatCurrency((purchaseQuantity || 0) * (parseFloat(purchaseUnitCost) || 0))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsRecordPurchaseOpen(false)}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={purchaseSubmitting}
                        className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                      >
                        {purchaseSubmitting ? "Saving..." : "Save Purchase Order"}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {loadingPurchases ? (
                <div className="p-8 text-center text-xs text-slate-500">Loading purchase history...</div>
              ) : supplierPurchases.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                        <th className="py-2.5 px-4">PO #</th>
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4">Product / Item</th>
                        <th className="py-2.5 px-4 text-center">Quantity</th>
                        <th className="py-2.5 px-4 text-right">Unit Cost</th>
                        <th className="py-2.5 px-4 text-right">Total Amount</th>
                        <th className="py-2.5 px-4 text-center">Payment</th>
                        <th className="py-2.5 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {supplierPurchases.map((po) => {
                        const isPaid = (po.payment_status || "Paid").toLowerCase() === "paid";

                        return (
                          <tr key={po.id} className="hover:bg-slate-50/60">
                            <td className="py-3 px-4 font-mono font-bold text-blue-600">
                              {po.purchase_order_no || `PO-${po.id}`}
                            </td>
                            <td className="py-3 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                              {formatDate(po.purchase_date)}
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-900 max-w-[200px] truncate" title={po.product_name}>
                              {po.product_name}
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                              {po.quantity}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-slate-600">
                              {formatCurrency(po.unit_cost)}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono">
                              {formatCurrency(po.total_amount)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-700 rounded border border-slate-200">
                                {po.payment_method || "Net Banking"}
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
                                <span>{po.payment_status || "Paid"}</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Graceful Handling of No Purchase History (Requirement 10) */
                <div className="p-8 text-center space-y-2 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-slate-800">
                    No Purchase History Found
                  </div>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    No purchase orders recorded yet for {viewingSupplier.company_name}. Click &ldquo;Record Purchase Order&rdquo; above to record your first procurement intake with this vendor.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Supplier ID: #{viewingSupplier.id}
              </span>
              <button
                type="button"
                onClick={() => setViewingSupplier(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. DELETE CONFIRMATION MODAL (Requirement 2) */}
      {deletingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Delete Supplier &ldquo;{deletingSupplier.company_name}&rdquo;?
              </h3>
              <p className="text-xs text-slate-600">
                Are you sure you want to delete this supplier record?
              </p>
            </div>

            {/* Warning block */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1 text-slate-700">
              <div className="flex items-center justify-between font-mono">
                <span>Contact Person:</span>
                <span className="font-bold text-slate-900">{deletingSupplier.name}</span>
              </div>
              <div className="flex items-center justify-between font-mono">
                <span>Total Purchases:</span>
                <span className="font-bold text-slate-900">{formatCurrency(deletingSupplier.total_purchases)}</span>
              </div>
              {deletingSupplier.last_purchase_date && (
                <div className="flex items-center justify-between font-mono">
                  <span>Last Purchase Date:</span>
                  <span>{formatDate(deletingSupplier.last_purchase_date)}</span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-500 text-center">
              Note: This action will remove the supplier profile from your active vendor directory.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingSupplier(null)}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSupplier}
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

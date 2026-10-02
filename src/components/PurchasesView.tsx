import React, { useState, useMemo } from "react";
import { PurchaseItem, SupplierItem, ProductItem } from "../types";
import { formatCurrency, formatDate } from "../utils/formatters";
import {
  ShoppingBag,
  Plus,
  Search,
  Calendar,
  Truck,
  Package,
  FileText,
  RotateCcw,
  Eye,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  Building2,
  DollarSign,
  Layers,
  ArrowUpDown,
  CreditCard,
  Phone,
  Clock,
  ExternalLink,
} from "lucide-react";

interface PurchasesViewProps {
  purchases: PurchaseItem[];
  suppliers: SupplierItem[];
  products: ProductItem[];
  onAddPurchase: (purchaseData: any) => Promise<boolean>;
  onDeletePurchase?: (id: number) => Promise<boolean>;
  onRefreshPurchases: () => void;
  onRefreshProducts?: () => void;
  onRefreshSuppliers?: () => void;
  onNavigateToSuppliers?: () => void;
  onNavigateToInventory?: () => void;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  purchases,
  suppliers,
  products,
  onAddPurchase,
  onDeletePurchase,
  onRefreshPurchases,
  onRefreshProducts,
  onRefreshSuppliers,
  onNavigateToSuppliers,
  onNavigateToInventory,
}) => {
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [dateRangePreset, setDateRangePreset] = useState<"all" | "today" | "7days" | "30days" | "custom">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "supplier">("date_desc");

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState<PurchaseItem | null>(null);
  const [deletingPurchase, setDeletingPurchase] = useState<PurchaseItem | null>(null);

  // Add Purchase Form State (Requirement 2 & 6)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [formProductName, setFormProductName] = useState("");
  const [formQuantity, setFormQuantity] = useState<number>(1);
  const [formUnitPrice, setFormUnitPrice] = useState<string>("");
  const [formPurchaseDate, setFormPurchaseDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [formInvoiceNo, setFormInvoiceNo] = useState<string>("");
  const [formPaymentStatus, setFormPaymentStatus] = useState<string>("Paid");
  const [formPaymentMethod, setFormPaymentMethod] = useState<string>("Net Banking");
  const [formNotes, setFormNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-fill unit cost and product name when product is selected in dropdown
  const handleProductSelect = (prodIdStr: string) => {
    setSelectedProductId(prodIdStr);
    if (!prodIdStr || prodIdStr === "custom") {
      return;
    }
    const prod = products.find((p) => p.id === parseInt(prodIdStr, 10));
    if (prod) {
      setFormProductName(prod.name);
      if (prod.purchase_price !== undefined && prod.purchase_price !== null && Number(prod.purchase_price) > 0) {
        setFormUnitPrice(String(prod.purchase_price));
      } else if (prod.price) {
        // Fallback default reasonable cost estimate if no purchase price
        setFormUnitPrice(String(Math.round(prod.price * 0.75)));
      }
    }
  };

  // Open Add Modal with clean state
  const openAddModal = () => {
    setFormError(null);
    setSelectedSupplierId(suppliers.length > 0 ? String(suppliers[0].id) : "");
    setSelectedProductId(products.length > 0 ? String(products[0].id) : "custom");
    if (products.length > 0) {
      setFormProductName(products[0].name);
      const cost = products[0].purchase_price || Math.round(products[0].price * 0.75) || "";
      setFormUnitPrice(String(cost));
    } else {
      setFormProductName("");
      setFormUnitPrice("");
    }
    setFormQuantity(1);
    setFormPurchaseDate(new Date().toISOString().split("T")[0]);
    const rnd = Math.floor(1000 + Math.random() * 9000);
    setFormInvoiceNo(`INV-PUR-${new Date().getFullYear()}-${rnd}`);
    setFormPaymentStatus("Paid");
    setFormPaymentMethod("Net Banking");
    setFormNotes("");
    setIsAddModalOpen(true);
  };

  // Form submit handler with validations (Requirement 6 & 7)
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation 1: Required supplier
    const supId = parseInt(selectedSupplierId, 10);
    if (isNaN(supId) || supId <= 0) {
      setFormError("Please select a valid supplier.");
      return;
    }

    // Validation 2: Required product
    const finalProdName = formProductName.trim();
    if (!finalProdName) {
      setFormError("Please specify or select a product.");
      return;
    }

    // Validation 3: Quantity > 0
    const qty = parseInt(String(formQuantity), 10);
    if (isNaN(qty) || qty <= 0) {
      setFormError("Purchase quantity must be greater than 0.");
      return;
    }

    // Validation 4: Unit price >= 0
    const unitCost = parseFloat(formUnitPrice);
    if (isNaN(unitCost) || unitCost < 0) {
      setFormError("Purchase price per unit cannot be negative.");
      return;
    }

    // Validation 5: Valid date
    if (!formPurchaseDate || !formPurchaseDate.trim()) {
      setFormError("Please select a valid purchase date.");
      return;
    }

    setIsSubmitting(true);
    try {
      const calculatedTotal = Math.round(qty * unitCost * 100) / 100;
      const payload = {
        supplier_id: supId,
        product_id: selectedProductId && selectedProductId !== "custom" ? parseInt(selectedProductId, 10) : null,
        product_name: finalProdName,
        quantity: qty,
        unit_cost: unitCost,
        total_amount: calculatedTotal,
        purchase_date: formPurchaseDate.trim(),
        invoice_no: formInvoiceNo.trim() || `INV-PUR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        payment_status: formPaymentStatus,
        payment_method: formPaymentMethod,
        notes: formNotes.trim(),
      };

      const success = await onAddPurchase(payload);
      if (success) {
        setIsAddModalOpen(false);
        if (onRefreshProducts) onRefreshProducts();
        if (onRefreshSuppliers) onRefreshSuppliers();
      }
    } catch (err: any) {
      setFormError(err.message || "Failed to record purchase.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete purchase handler
  const handleDeleteConfirm = async () => {
    if (!deletingPurchase || !onDeletePurchase) return;
    setIsSubmitting(true);
    try {
      const ok = await onDeletePurchase(deletingPurchase.id);
      if (ok) {
        setDeletingPurchase(null);
        if (viewingPurchase && viewingPurchase.id === deletingPurchase.id) {
          setViewingPurchase(null);
        }
        if (onRefreshProducts) onRefreshProducts();
        if (onRefreshSuppliers) onRefreshSuppliers();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Live computed total in form
  const formCalculatedTotal = useMemo(() => {
    const qty = parseInt(String(formQuantity), 10) || 0;
    const cost = parseFloat(formUnitPrice) || 0;
    return Math.max(0, qty * cost);
  }, [formQuantity, formUnitPrice]);

  // Summary Metrics calculations
  const metrics = useMemo(() => {
    let totalSpend = 0;
    let totalQty = 0;
    const distinctSuppliers = new Set<number>();

    purchases.forEach((p) => {
      totalSpend += Number(p.total_amount || 0);
      totalQty += Number(p.quantity || 0);
      if (p.supplier_id) distinctSuppliers.add(p.supplier_id);
    });

    return {
      totalPurchases: purchases.length,
      totalSpend,
      totalQuantity: totalQty,
      activeSuppliersCount: distinctSuppliers.size,
    };
  }, [purchases]);

  // Filtered and Sorted Purchases List (Requirement 4 & 5)
  const filteredPurchases = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];

    return purchases.filter((item) => {
      // 1. Text Search (invoice, supplier, product, notes)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const inv = (item.invoice_no || item.purchase_order_no || "").toLowerCase();
        const sup = (item.supplier_name || item.supplier_company || "").toLowerCase();
        const prod = (item.product_name || "").toLowerCase();
        const notes = (item.notes || "").toLowerCase();
        if (!inv.includes(term) && !sup.includes(term) && !prod.includes(term) && !notes.includes(term)) {
          return false;
        }
      }

      // 2. Supplier Filter
      if (supplierFilter !== "all") {
        if (String(item.supplier_id) !== supplierFilter) {
          return false;
        }
      }

      // 3. Product Filter
      if (productFilter !== "all") {
        if (String(item.product_id) !== productFilter && item.product_name !== productFilter) {
          return false;
        }
      }

      // 4. Date Range Filter
      const pDate = item.purchase_date;
      if (dateRangePreset === "today") {
        if (pDate !== today) return false;
      } else if (dateRangePreset === "7days") {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        const cutoff = d.toISOString().split("T")[0];
        if (pDate < cutoff) return false;
      } else if (dateRangePreset === "30days") {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        const cutoff = d.toISOString().split("T")[0];
        if (pDate < cutoff) return false;
      } else if (dateRangePreset === "custom") {
        if (startDate && pDate < startDate) return false;
        if (endDate && pDate > endDate) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === "date_desc") {
        return (b.purchase_date || "").localeCompare(a.purchase_date || "") || b.id - a.id;
      }
      if (sortBy === "date_asc") {
        return (a.purchase_date || "").localeCompare(b.purchase_date || "") || a.id - b.id;
      }
      if (sortBy === "amount_desc") {
        return (b.total_amount || 0) - (a.total_amount || 0);
      }
      if (sortBy === "amount_asc") {
        return (a.total_amount || 0) - (b.total_amount || 0);
      }
      return 0;
    });
  }, [purchases, searchTerm, supplierFilter, productFilter, dateRangePreset, startDate, endDate, sortBy]);

  const hasActiveFilters =
    searchTerm.trim() !== "" ||
    supplierFilter !== "all" ||
    productFilter !== "all" ||
    dateRangePreset !== "all" ||
    startDate !== "" ||
    endDate !== "";

  const resetFilters = () => {
    setSearchTerm("");
    setSupplierFilter("all");
    setProductFilter("all");
    setDateRangePreset("all");
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & ACTION BAR (Requirement 1 & 11) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Purchase Management
              </h1>
              <p className="text-xs text-slate-500">
                Record supplier purchases, manage inventory intake, and track purchase history
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefreshPurchases}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
            title="Refresh Purchase Records"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all hover:shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Record Purchase</span>
          </button>
        </div>
      </div>

      {/* 2. SUMMARY METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Spend */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Purchases Value
            </span>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {formatCurrency(metrics.totalSpend)}
            </div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <span className="font-semibold text-blue-600">{metrics.totalPurchases} orders</span>
              <span>recorded</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Total Items Procured */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Units Procured
            </span>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {metrics.totalQuantity.toLocaleString()}
            </div>
            <div className="text-[11px] text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Added to stock quantity</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Active Suppliers */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Supplying Vendors
            </span>
            <div className="text-2xl font-bold text-indigo-600 font-mono">
              {metrics.activeSuppliersCount} / {suppliers.length}
            </div>
            <div className="text-[11px] text-slate-500">
              Vendors with purchase records
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Catalog Products Linked */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Inventory Catalog
            </span>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {products.length}
            </div>
            <div className="text-[11px] text-slate-500">
              Active inventory product lines
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. SEARCH & FILTERS TOOLBAR (Requirement 5) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by invoice number, supplier, product, or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Supplier Filter */}
            <div className="min-w-[150px]">
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Suppliers ({suppliers.length})</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.company_name || s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Filter */}
            <div className="min-w-[150px]">
              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Products ({products.length})</option>
                {products.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="min-w-[130px]">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="date_desc">Newest Date</option>
                <option value="date_asc">Oldest Date</option>
                <option value="amount_desc">Highest Amount</option>
                <option value="amount_asc">Lowest Amount</option>
              </select>
            </div>
          </div>
        </div>

        {/* Date Filter Presets Bar */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
              Date Filter:
            </span>
            {(["all", "today", "7days", "30days", "custom"] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => setDateRangePreset(preset)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  dateRangePreset === preset
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {preset === "all" && "All Time"}
                {preset === "today" && "Today"}
                {preset === "7days" && "Last 7 Days"}
                {preset === "30days" && "Last 30 Days"}
                {preset === "custom" && "Custom Range"}
              </button>
            ))}
          </div>

          {dateRangePreset === "custom" && (
            <div className="flex items-center gap-2 animate-in fade-in duration-150">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white"
              />
            </div>
          )}

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* 4. PURCHASE HISTORY TABLE (Requirement 4) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">Purchase History</h2>
            <span className="text-xs text-slate-500">
              ({filteredPurchases.length} {filteredPurchases.length === 1 ? "purchase" : "purchases"})
            </span>
          </div>

          <div className="text-xs text-slate-500">
            Total in view:{" "}
            <span className="font-bold text-slate-900 font-mono">
              {formatCurrency(
                filteredPurchases.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0)
              )}
            </span>
          </div>
        </div>

        {filteredPurchases.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">No purchases found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {hasActiveFilters
                ? "No purchase records match the selected filters. Try resetting search or date ranges."
                : "No purchases have been recorded yet. Click 'Record Purchase' to add your first procurement order."}
            </p>
            {hasActiveFilters ? (
              <button
                onClick={resetFilters}
                className="mt-3 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            ) : (
              <button
                onClick={openAddModal}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Record First Purchase
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Purchase Date</th>
                  <th className="py-3 px-4">Invoice / Bill #</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4 text-center">Quantity</th>
                  <th className="py-3 px-4 text-right">Unit Price</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPurchases.map((purchase) => {
                  const invNumber = purchase.invoice_no || purchase.purchase_order_no || `INV-PUR-${purchase.id}`;
                  const supCompany = purchase.supplier_company || purchase.supplier_name || "Unknown Supplier";
                  const supContact = purchase.supplier_name && purchase.supplier_name !== supCompany ? purchase.supplier_name : "";

                  return (
                    <tr
                      key={purchase.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => setViewingPurchase(purchase)}
                    >
                      {/* Purchase Date */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatDate(purchase.purchase_date)}</span>
                        </div>
                      </td>

                      {/* Invoice Number */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-800 rounded-md font-mono font-medium text-[11px] border border-slate-200">
                          <FileText className="w-3 h-3 text-slate-500" />
                          {invNumber}
                        </span>
                      </td>

                      {/* Supplier */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{supCompany}</div>
                        {supContact && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1">
                            <span>{supContact}</span>
                            {purchase.supplier_mobile && (
                              <span className="text-slate-400">({purchase.supplier_mobile})</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Product */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span>{purchase.product_name}</span>
                        </div>
                        {purchase.product_category && (
                          <span className="inline-block px-1.5 py-0.5 mt-0.5 rounded text-[10px] bg-slate-100 text-slate-600">
                            {purchase.product_category}
                          </span>
                        )}
                      </td>

                      {/* Quantity */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold font-mono">
                          {purchase.quantity} units
                        </span>
                      </td>

                      {/* Unit Price */}
                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-slate-600">
                        {formatCurrency(purchase.unit_cost)}
                      </td>

                      {/* Total Amount */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className="font-bold text-slate-900 font-mono text-sm">
                          {formatCurrency(purchase.total_amount)}
                        </span>
                      </td>

                      {/* Payment Status */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            (purchase.payment_status || "").toLowerCase() === "paid"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {purchase.payment_status || "Paid"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setViewingPurchase(purchase)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="View Purchase Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {onDeletePurchase && (
                            <button
                              onClick={() => setDeletingPurchase(purchase)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Purchase Record"
                            >
                              <Trash2 className="w-4 h-4" />
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
        )}
      </div>

      {/* ================= MODAL 1: RECORD PURCHASE (Requirements 2, 6, 7) ================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Record New Purchase</h3>
                  <p className="text-[11px] text-slate-500">
                    Stock will automatically increase in inventory & supplier totals will update
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Supplier Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supplier / Vendor <span className="text-rose-500">*</span>
                </label>
                {suppliers.length === 0 ? (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
                    <span>No suppliers registered yet. Please add a supplier first.</span>
                    {onNavigateToSuppliers && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddModalOpen(false);
                          onNavigateToSuppliers();
                        }}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        Add Supplier &rarr;
                      </button>
                    )}
                  </div>
                ) : (
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.company_name} {s.name && s.name !== s.company_name ? `(${s.name})` : ""} - {s.mobile}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Product Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select from Catalog <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => handleProductSelect(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="custom">-- Custom Product / Free Text --</option>
                    {products.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.name} (Stock: {p.stock_quantity})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Product / Item Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ultra HD Monitor 27 inch"
                    value={formProductName}
                    onChange={(e) => setFormProductName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Quantity & Unit Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Purchase Quantity <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Purchase Price per Unit (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    placeholder="e.g. 13200.00"
                    value={formUnitPrice}
                    onChange={(e) => setFormUnitPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* Live Computed Total Preview Banner */}
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                    Calculated Total Purchase Amount
                  </span>
                  <span className="text-xs text-slate-600">
                    {formQuantity} units &times; {formatCurrency(parseFloat(formUnitPrice) || 0)}
                  </span>
                </div>
                <div className="text-lg font-bold text-blue-900 font-mono">
                  {formatCurrency(formCalculatedTotal)}
                </div>
              </div>

              {/* Purchase Date & Invoice / Bill Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Purchase Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formPurchaseDate}
                    onChange={(e) => setFormPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Invoice / Bill Number <span className="text-slate-400 font-normal">(auto-generated)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-PUR-2026-081"
                    value={formInvoiceNo}
                    onChange={(e) => setFormInvoiceNo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Payment Method & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Net Banking">Net Banking / NEFT</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="Bank Transfer">Direct Bank Transfer</option>
                    <option value="Card">Corporate Credit Card</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Status
                  </label>
                  <select
                    value={formPaymentStatus}
                    onChange={(e) => setFormPaymentStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending / Due</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes / Order Details <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Batch intake, warranty terms, dispatch receipt..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || suppliers.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Recording...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm & Record Purchase</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: VIEW PURCHASE DETAILS (Requirement 5) ================= */}
      {viewingPurchase && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Purchase Order Details
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {viewingPurchase.invoice_no || viewingPurchase.purchase_order_no || `INV-PUR-${viewingPurchase.id}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingPurchase(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Financial Highlight Card */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Total Procurement Cost
                  </div>
                  <div className="text-2xl font-bold font-mono text-emerald-400">
                    {formatCurrency(viewingPurchase.total_amount)}
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    {viewingPurchase.quantity} units @ {formatCurrency(viewingPurchase.unit_cost)} / unit
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                      (viewingPurchase.payment_status || "").toLowerCase() === "paid"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    }`}
                  >
                    {viewingPurchase.payment_status || "Paid"}
                  </span>
                  <div className="text-[11px] text-slate-400 mt-1">
                    via {viewingPurchase.payment_method || "Net Banking"}
                  </div>
                </div>
              </div>

              {/* Automatic Stock Increment Banner (Requirement 3) */}
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-semibold">Inventory Stock Updated: </span>
                  <span>
                    Successfully added {viewingPurchase.quantity} units to inventory catalog with valuation updated to {formatCurrency(viewingPurchase.unit_cost)}.
                  </span>
                </div>
              </div>

              {/* Two Column Cards: Supplier & Product */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Supplier Card */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <Truck className="w-3.5 h-3.5 text-blue-600" />
                    <span>Supplier Information</span>
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="font-semibold text-slate-800">
                      {viewingPurchase.supplier_company || viewingPurchase.supplier_name || "Supplier #" + viewingPurchase.supplier_id}
                    </div>
                    {viewingPurchase.supplier_name && viewingPurchase.supplier_name !== viewingPurchase.supplier_company && (
                      <div className="text-slate-600 text-[11px]">
                        Contact: {viewingPurchase.supplier_name}
                      </div>
                    )}
                    {viewingPurchase.supplier_mobile && (
                      <div className="text-slate-600 text-[11px] flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{viewingPurchase.supplier_mobile}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Product Card */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <Package className="w-3.5 h-3.5 text-blue-600" />
                    <span>Product Intake</span>
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="font-semibold text-slate-800">{viewingPurchase.product_name}</div>
                    {viewingPurchase.product_category && (
                      <div className="text-[11px] text-slate-500">
                        Category: {viewingPurchase.product_category}
                      </div>
                    )}
                    {viewingPurchase.product_sku && (
                      <div className="text-[11px] text-slate-500 font-mono">
                        SKU: {viewingPurchase.product_sku}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Purchase Metadata Details Grid */}
              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
                <div className="p-3 flex items-center justify-between">
                  <span className="text-slate-500">Purchase Date</span>
                  <span className="font-semibold text-slate-900">{formatDate(viewingPurchase.purchase_date)}</span>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-slate-500">Invoice / PO Number</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {viewingPurchase.invoice_no || viewingPurchase.purchase_order_no}
                  </span>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-slate-500">Quantity Procured</span>
                  <span className="font-bold text-blue-600 font-mono">{viewingPurchase.quantity} units</span>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-slate-500">Purchase Unit Cost</span>
                  <span className="font-mono font-semibold text-slate-900">{formatCurrency(viewingPurchase.unit_cost)}</span>
                </div>
                {viewingPurchase.notes && (
                  <div className="p-3">
                    <span className="text-slate-500 block mb-1">Notes / Remarks</span>
                    <p className="text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-100 italic">
                      "{viewingPurchase.notes}"
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex items-center justify-between">
                {onDeletePurchase && (
                  <button
                    onClick={() => {
                      setDeletingPurchase(viewingPurchase);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Purchase</span>
                  </button>
                )}

                <button
                  onClick={() => setViewingPurchase(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer ml-auto"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: DELETE CONFIRMATION ================= */}
      {deletingPurchase && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete Purchase Record?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Are you sure you want to delete invoice{" "}
                <span className="font-bold text-slate-800 font-mono">
                  {deletingPurchase.invoice_no || deletingPurchase.purchase_order_no}
                </span>{" "}
                ({formatCurrency(deletingPurchase.total_amount)})? This will automatically reverse{" "}
                <span className="font-semibold text-rose-600">{deletingPurchase.quantity} units</span> from your inventory stock and update the supplier's purchase total.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingPurchase(null)}
                className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {isSubmitting ? "Deleting..." : "Confirm & Adjust Stock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from "react";
import { ProductItem, StockMovementItem, SupplierItem } from "../types";
import { formatCurrency, getDiscountInfo } from "../utils/formatters";
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  X,
  Edit2,
  Trash2,
  History,
  Boxes,
  RotateCcw,
  Eye,
  Building2,
  Tag,
  DollarSign,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Percent,
  Calendar,
  AlertCircle,
  SlidersHorizontal,
  ArrowUpDown,
} from "lucide-react";
import { VoiceInputButton } from "./VoiceInputButton";

interface InventoryViewProps {
  products: ProductItem[];
  stockMovements?: StockMovementItem[];
  suppliers?: SupplierItem[];
  productAlertTags?: Record<number, string[]>;
  onAddProduct: (product: Omit<ProductItem, "id">) => Promise<boolean> | void;
  onUpdateProduct?: (id: number, product: Partial<ProductItem>) => Promise<boolean> | void;
  onDeleteProduct?: (id: number) => Promise<boolean> | void;
  onAdjustStock?: (
    id: number,
    actionType: "add" | "set" | "increase" | "decrease",
    quantity: number,
    notes?: string
  ) => Promise<boolean> | void;
  onRestockProduct?: (product: ProductItem) => void;
  onRefreshMovements?: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  stockMovements = [],
  suppliers = [],
  productAlertTags = {},
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onAdjustStock,
  onRefreshMovements,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"catalog" | "movements">("catalog");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all");

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<ProductItem | null>(null);
  const [viewingProduct, setViewingProduct] = useState<ProductItem | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<ProductItem | null>(null);

  // Add Product Form State
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("Electronics");
  const [supplier, setSupplier] = useState("");
  const [brand, setBrand] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [currentStock, setCurrentStock] = useState("");
  const [minStock, setMinStock] = useState("5");
  const [addError, setAddError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Product Form State
  const [editName, setEditName] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editSupplier, setEditSupplier] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editPurchasePrice, setEditPurchasePrice] = useState("");
  const [editMrp, setEditMrp] = useState("");
  const [editSellingPrice, setEditSellingPrice] = useState("");
  const [editDiscountType, setEditDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [editDiscountPercent, setEditDiscountPercent] = useState("");
  const [editDiscountAmount, setEditDiscountAmount] = useState("");
  const [editStock, setEditStock] = useState("");
  const [editMinStock, setEditMinStock] = useState("");
  const [editError, setEditError] = useState("");

  // Sorting State (Name A-Z, Name Z-A, Price Low-High, Price High-Low, Stock Low-High, Stock High-Low, Recently Added)
  const [sortBy, setSortBy] = useState<
    "name_asc" | "name_desc" | "price_asc" | "price_desc" | "stock_asc" | "stock_desc" | "recently_added" | "category" | "discount_desc"
  >("name_asc");

  // Price Range Filter State
  const [priceRangePreset, setPriceRangePreset] = useState<
    "all" | "under_1k" | "1k_5k" | "5k_15k" | "above_15k" | "custom"
  >("all");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");

  // Discount Filter State (Requirement: Add a filter to show only discounted products)
  const [onlyDiscounted, setOnlyDiscounted] = useState(false);

  // Dynamic Calculation Helpers for Add Form (Requirement 3)
  const handleMrpChange = (val: string) => {
    setMrp(val);
    const numMrp = parseFloat(val);
    const numSelling = parseFloat(sellingPrice);
    if (!isNaN(numMrp) && !isNaN(numSelling) && numMrp > 0 && numMrp >= numSelling) {
      const discAmt = Math.round((numMrp - numSelling) * 100) / 100;
      const discPct = Math.round(((numMrp - numSelling) / numMrp) * 1000) / 10;
      setDiscountAmount(discAmt > 0 ? discAmt.toString() : "0");
      setDiscountPercent(discPct > 0 ? discPct.toString() : "0");
    } else if (!isNaN(numMrp) && isNaN(numSelling)) {
      setSellingPrice(val);
      setDiscountAmount("0");
      setDiscountPercent("0");
    }
  };

  const handleSellingPriceChange = (val: string) => {
    setSellingPrice(val);
    const numSelling = parseFloat(val);
    let numMrp = parseFloat(mrp);
    if (isNaN(numMrp) || numMrp < numSelling) {
      numMrp = numSelling;
      setMrp(val);
    }
    if (numMrp > 0 && numMrp >= numSelling) {
      const discAmt = Math.round((numMrp - numSelling) * 100) / 100;
      const discPct = Math.round(((numMrp - numSelling) / numMrp) * 1000) / 10;
      setDiscountAmount(discAmt > 0 ? discAmt.toString() : "0");
      setDiscountPercent(discPct > 0 ? discPct.toString() : "0");
    }
  };

  const handleDiscountPercentChange = (val: string) => {
    setDiscountPercent(val);
    const numPct = parseFloat(val);
    const numMrp = parseFloat(mrp);
    if (!isNaN(numMrp) && !isNaN(numPct) && numMrp > 0) {
      const clampedPct = Math.min(100, Math.max(0, numPct));
      const discAmt = Math.round((numMrp * (clampedPct / 100)) * 100) / 100;
      const finalPrice = Math.round((numMrp - discAmt) * 100) / 100;
      setDiscountAmount(discAmt.toString());
      setSellingPrice(finalPrice.toString());
    }
  };

  const handleDiscountAmountChange = (val: string) => {
    setDiscountAmount(val);
    const numAmt = parseFloat(val);
    const numMrp = parseFloat(mrp);
    if (!isNaN(numMrp) && !isNaN(numAmt) && numMrp > 0) {
      const clampedAmt = Math.min(numMrp, Math.max(0, numAmt));
      const discPct = Math.round((clampedAmt / numMrp) * 1000) / 10;
      const finalPrice = Math.round((numMrp - clampedAmt) * 100) / 100;
      setDiscountPercent(discPct.toString());
      setSellingPrice(finalPrice.toString());
    }
  };

  // Dynamic Calculation Helpers for Edit Form
  const handleEditMrpChange = (val: string) => {
    setEditMrp(val);
    const numMrp = parseFloat(val);
    const numSelling = parseFloat(editSellingPrice);
    if (!isNaN(numMrp) && !isNaN(numSelling) && numMrp > 0 && numMrp >= numSelling) {
      const discAmt = Math.round((numMrp - numSelling) * 100) / 100;
      const discPct = Math.round(((numMrp - numSelling) / numMrp) * 1000) / 10;
      setEditDiscountAmount(discAmt > 0 ? discAmt.toString() : "0");
      setEditDiscountPercent(discPct > 0 ? discPct.toString() : "0");
    }
  };

  const handleEditSellingPriceChange = (val: string) => {
    setEditSellingPrice(val);
    const numSelling = parseFloat(val);
    let numMrp = parseFloat(editMrp);
    if (isNaN(numMrp) || numMrp < numSelling) {
      numMrp = numSelling;
      setEditMrp(val);
    }
    if (numMrp > 0 && numMrp >= numSelling) {
      const discAmt = Math.round((numMrp - numSelling) * 100) / 100;
      const discPct = Math.round(((numMrp - numSelling) / numMrp) * 1000) / 10;
      setEditDiscountAmount(discAmt > 0 ? discAmt.toString() : "0");
      setEditDiscountPercent(discPct > 0 ? discPct.toString() : "0");
    }
  };

  const handleEditDiscountPercentChange = (val: string) => {
    setEditDiscountPercent(val);
    const numPct = parseFloat(val);
    const numMrp = parseFloat(editMrp);
    if (!isNaN(numMrp) && !isNaN(numPct) && numMrp > 0) {
      const clampedPct = Math.min(100, Math.max(0, numPct));
      const discAmt = Math.round((numMrp * (clampedPct / 100)) * 100) / 100;
      const finalPrice = Math.round((numMrp - discAmt) * 100) / 100;
      setEditDiscountAmount(discAmt.toString());
      setEditSellingPrice(finalPrice.toString());
    }
  };

  const handleEditDiscountAmountChange = (val: string) => {
    setEditDiscountAmount(val);
    const numAmt = parseFloat(val);
    const numMrp = parseFloat(editMrp);
    if (!isNaN(numMrp) && !isNaN(numAmt) && numMrp > 0) {
      const clampedAmt = Math.min(numMrp, Math.max(0, numAmt));
      const discPct = Math.round((clampedAmt / numMrp) * 1000) / 10;
      const finalPrice = Math.round((numMrp - clampedAmt) * 100) / 100;
      setEditDiscountPercent(discPct.toString());
      setEditSellingPrice(finalPrice.toString());
    }
  };

  // Quick Adjustment Modal State
  const [adjustAction, setAdjustAction] = useState<"add" | "decrease" | "set">("add");
  const [adjustQty, setAdjustQty] = useState("5");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [adjustError, setAdjustError] = useState("");

  // Categories list
  const categories = Array.from(new Set(products.map((p) => p.category))).filter(Boolean);

  // Summary Metrics calculations (Requirement 3: Inventory dashboard)
  const totalProducts = products.length;
  const totalStockUnits = products.reduce((acc, p) => acc + (Number(p.stock_quantity) || 0), 0);
  const outOfStockProducts = products.filter((p) => (Number(p.stock_quantity) || 0) <= 0);
  const outOfStockCount = outOfStockProducts.length;
  const lowStockProducts = products.filter(
    (p) => (Number(p.stock_quantity) || 0) > 0 && (Number(p.stock_quantity) || 0) <= p.min_stock_level
  );
  const lowStockCount = lowStockProducts.length;

  // Discounted products count (Requirement: Discount Detection & Filter)
  const discountedProducts = products.filter((p) => {
    const pPrice = Number(p.price) || 0;
    const pMrp = Number(p.mrp) || 0;
    return pMrp > pPrice && pPrice >= 0;
  });
  const discountedCount = discountedProducts.length;

  const totalRetailValuation = products.reduce(
    (acc, p) => acc + (Number(p.price) || 0) * (Number(p.stock_quantity) || 0),
    0
  );
  const totalCostValuation = products.reduce(
    (acc, p) => acc + (Number(p.purchase_price) || Number(p.price) * 0.65) * (Number(p.stock_quantity) || 0),
    0
  );

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const q = searchTerm.toLowerCase().trim();
    const brandName = ((p.brand || (p as any).brand) || "").toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      p.category.toLowerCase().includes(q) ||
      brandName.includes(q) ||
      (p.supplier && p.supplier.toLowerCase().includes(q));

    const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;

    let matchesStatus = true;
    const qty = Number(p.stock_quantity) || 0;
    if (statusFilter === "in_stock") {
      matchesStatus = qty > p.min_stock_level;
    } else if (statusFilter === "low_stock") {
      matchesStatus = qty > 0 && qty <= p.min_stock_level;
    } else if (statusFilter === "out_of_stock") {
      matchesStatus = qty <= 0;
    }

    let matchesPrice = true;
    const numPrice = Number(p.price) || 0;
    const minVal = parseFloat(minPrice);
    const maxVal = parseFloat(maxPrice);
    if (!isNaN(minVal) && minVal >= 0) {
      matchesPrice = matchesPrice && numPrice >= minVal;
    }
    if (!isNaN(maxVal) && maxVal > 0) {
      matchesPrice = matchesPrice && numPrice <= maxVal;
    }

    let matchesDiscount = true;
    if (onlyDiscounted) {
      const pMrp = Number(p.mrp) || 0;
      matchesDiscount = pMrp > numPrice && numPrice >= 0;
    }

    return matchesSearch && matchesCategory && matchesStatus && matchesPrice && matchesDiscount;
  });

  // Sorted Products (Name A-Z, Name Z-A, Price Low-High, Price High-Low, Stock Low-High, Stock High-Low, Recently Added)
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === "name_asc") return a.name.localeCompare(b.name);
    if (sortBy === "name_desc") return b.name.localeCompare(a.name);
    if (sortBy === "price_asc") return (a.price || 0) - (b.price || 0);
    if (sortBy === "price_desc") return (b.price || 0) - (a.price || 0);
    if (sortBy === "stock_asc") return (a.stock_quantity || 0) - (b.stock_quantity || 0);
    if (sortBy === "stock_desc") return (b.stock_quantity || 0) - (a.stock_quantity || 0);
    if (sortBy === "recently_added") {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (dateA !== dateB) return dateB - dateA;
      return (b.id || 0) - (a.id || 0);
    }
    if (sortBy === "category") return a.category.localeCompare(b.category);
    if (sortBy === "discount_desc") return (b.discount_percent || 0) - (a.discount_percent || 0);
    return 0;
  });

  // Filtered Movements
  const filteredMovements = stockMovements.filter((m) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      m.product_name.toLowerCase().includes(q) ||
      (m.notes && m.notes.toLowerCase().includes(q)) ||
      (m.reference_id && m.reference_id.toLowerCase().includes(q)) ||
      m.movement_type.toLowerCase().includes(q)
    );
  });

  // Helper to open Add Modal
  const openAddModal = () => {
    setName("");
    setSku(`SKU-${Math.floor(1000 + Math.random() * 9000)}`);
    setCategory(categories[0] || "Electronics");
    setSupplier(suppliers[0]?.company_name || "");
    setBrand("");
    setPurchasePrice("");
    setMrp("");
    setSellingPrice("");
    setDiscountType("percentage");
    setDiscountPercent("");
    setDiscountAmount("");
    setCurrentStock("10");
    setMinStock("5");
    setAddError("");
    setIsAddModalOpen(true);
  };

  // Helper to open Edit Modal
  const openEditModal = (p: ProductItem) => {
    setEditingProduct(p);
    setEditName(p.name);
    setEditSku(p.sku || `SKU-${p.id.toString().padStart(4, "0")}`);
    setEditCategory(p.category);
    setEditSupplier(p.supplier || "");
    setEditBrand(p.brand || "");
    setEditPurchasePrice((p.purchase_price ?? Math.round(p.price * 0.65)).toString());
    setEditMrp((p.mrp ?? p.price).toString());
    setEditSellingPrice(p.price.toString());
    setEditDiscountType((p.discount_type as any) || "percentage");
    setEditDiscountPercent((p.discount_percent ?? 0).toString());
    setEditDiscountAmount((p.discount_amount ?? 0).toString());
    setEditStock(p.stock_quantity.toString());
    setEditMinStock(p.min_stock_level.toString());
    setEditError("");
  };

  // Helper to open Adjust Modal
  const openAdjustModal = (p: ProductItem) => {
    setAdjustingProduct(p);
    setAdjustAction("add");
    setAdjustQty("10");
    setAdjustNotes("Restock delivery received");
    setAdjustError("");
  };

  // Submit Add Product Form (Requirement 2, 3 & 12)
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");

    if (!name.trim()) {
      setAddError("Product name cannot be empty.");
      return;
    }

    const cost = parseFloat(purchasePrice) || 0;
    const sell = parseFloat(sellingPrice);
    const stock = parseInt(currentStock, 10);
    const min = parseInt(minStock, 10);

    if (isNaN(sell) || sell < 0) {
      setAddError("Selling price must be a valid non-negative number.");
      return;
    }
    if (cost < 0) {
      setAddError("Purchase price cannot be negative.");
      return;
    }
    if (isNaN(stock) || stock < 0) {
      setAddError("Starting stock quantity cannot be negative.");
      return;
    }
    if (isNaN(min) || min < 0) {
      setAddError("Minimum stock level cannot be negative.");
      return;
    }

    const numMrp = parseFloat(mrp);
    if (!isNaN(numMrp) && numMrp > 0 && sell > numMrp) {
      setAddError(`Invalid pricing: Selling price (${formatCurrency(sell)}) cannot be greater than MRP (${formatCurrency(numMrp)}).`);
      return;
    }

    const originalMrp = !isNaN(numMrp) && numMrp > 0 ? numMrp : sell;
    if (originalMrp < 0) {
      setAddError("Original/MRP price cannot be negative.");
      return;
    }

    const hasDiscount = originalMrp > sell && originalMrp > 0;
    const calcDiscountAmt = hasDiscount ? Math.round((originalMrp - sell) * 100) / 100 : 0;
    const calcDiscountPct = hasDiscount ? Math.round(((originalMrp - sell) / originalMrp) * 1000) / 10 : 0;

    if (calcDiscountPct < 0 || calcDiscountAmt < 0) {
      setAddError("Discount amount and percentage cannot be negative.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddProduct({
        name: name.trim(),
        sku: sku.trim() || undefined,
        category: category.trim() || "General",
        supplier: supplier.trim() || undefined,
        brand: brand.trim() || undefined,
        price: sell,
        mrp: originalMrp,
        discount_amount: Math.round(calcDiscountAmt * 100) / 100,
        discount_percent: Math.round(calcDiscountPct * 10) / 10,
        discount_type: discountType,
        purchase_price: cost,
        stock_quantity: stock,
        min_stock_level: min,
      });
      setIsAddModalOpen(false);
    } catch (err: any) {
      setAddError(err.message || "Failed to save product.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit Product Form (Requirement 2, 3 & 12)
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setEditError("");

    if (!editName.trim()) {
      setEditError("Product name cannot be empty.");
      return;
    }

    const cost = parseFloat(editPurchasePrice) || 0;
    const sell = parseFloat(editSellingPrice);
    const stock = parseInt(editStock, 10);
    const min = parseInt(editMinStock, 10);

    if (isNaN(sell) || sell < 0) {
      setEditError("Selling price must be a valid non-negative number.");
      return;
    }
    if (cost < 0) {
      setEditError("Purchase price cannot be negative.");
      return;
    }
    if (isNaN(stock) || stock < 0) {
      setEditError("Stock quantity cannot be negative.");
      return;
    }
    if (isNaN(min) || min < 0) {
      setEditError("Minimum stock level cannot be negative.");
      return;
    }

    const numEditMrp = parseFloat(editMrp);
    if (!isNaN(numEditMrp) && numEditMrp > 0 && sell > numEditMrp) {
      setEditError(`Invalid pricing: Selling price (${formatCurrency(sell)}) cannot be greater than MRP (${formatCurrency(numEditMrp)}).`);
      return;
    }

    const originalMrp = !isNaN(numEditMrp) && numEditMrp > 0 ? numEditMrp : sell;
    if (originalMrp < 0) {
      setEditError("Original/MRP price cannot be negative.");
      return;
    }

    const hasDiscount = originalMrp > sell && originalMrp > 0;
    const calcDiscountAmt = hasDiscount ? Math.round((originalMrp - sell) * 100) / 100 : 0;
    const calcDiscountPct = hasDiscount ? Math.round(((originalMrp - sell) / originalMrp) * 1000) / 10 : 0;

    if (calcDiscountPct < 0 || calcDiscountAmt < 0) {
      setEditError("Discount amount and percentage cannot be negative.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (onUpdateProduct) {
        await onUpdateProduct(editingProduct.id, {
          name: editName.trim(),
          sku: editSku.trim(),
          category: editCategory.trim(),
          supplier: editSupplier.trim(),
          brand: editBrand.trim() || undefined,
          price: sell,
          mrp: originalMrp,
          discount_amount: Math.round(calcDiscountAmt * 100) / 100,
          discount_percent: Math.round(calcDiscountPct * 10) / 10,
          discount_type: editDiscountType,
          purchase_price: cost,
          stock_quantity: stock,
          min_stock_level: min,
        });
      }
      setEditingProduct(null);
    } catch (err: any) {
      setEditError(err.message || "Failed to update product.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Stock Adjustment Form (Requirement 8)
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;
    setAdjustError("");

    // Requirement 8: Require a reason for every manual stock adjustment
    if (!adjustNotes.trim()) {
      setAdjustError("Please provide a reason for this stock adjustment (required).");
      return;
    }

    const qty = parseInt(adjustQty, 10);
    if (isNaN(qty) || qty < 0) {
      setAdjustError("Please enter a valid quantity.");
      return;
    }

    if ((adjustAction === "add" || adjustAction === "decrease") && qty <= 0) {
      setAdjustError("Quantity must be greater than 0.");
      return;
    }

    if (adjustAction === "decrease" && qty > adjustingProduct.stock_quantity) {
      setAdjustError(
        `Cannot decrease by ${qty}. Current stock on hand is only ${adjustingProduct.stock_quantity} units.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      if (onAdjustStock) {
        await onAdjustStock(adjustingProduct.id, adjustAction, qty, adjustNotes.trim());
      }
      setAdjustingProduct(null);
    } catch (err: any) {
      setAdjustError(err.message || "Failed to adjust stock.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Delete Confirmation
  const handleDeleteConfirm = async () => {
    if (!deletingProduct) return;
    setIsSubmitting(true);
    try {
      if (onDeleteProduct) {
        await onDeleteProduct(deletingProduct.id);
      }
      setDeletingProduct(null);
    } catch (err: any) {
      console.error("Delete failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. INVENTORY DASHBOARD (Requirement 3) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Products */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Products
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900">{totalProducts}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Catalog SKUs</div>
          </div>
        </div>

        {/* Total Stock Units */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Stock Units
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900">
              {totalStockUnits.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Units in inventory</div>
          </div>
        </div>

        {/* Low Stock Products */}
        <div
          onClick={() => setStatusFilter("low_stock")}
          className={`p-4 sm:p-5 rounded-2xl border shadow-2xs cursor-pointer transition-all ${
            lowStockCount > 0
              ? "bg-amber-50/60 border-amber-200 hover:border-amber-300"
              : "bg-white border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
              Low Stock
            </span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                lowStockCount > 0 ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-600"
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div
              className={`text-2xl font-bold ${
                lowStockCount > 0 ? "text-amber-700" : "text-slate-900"
              }`}
            >
              {lowStockCount}
            </div>
            <div className="text-[11px] text-amber-700/80 mt-0.5">
              {lowStockCount > 0 ? "Reorder required" : "Above minimum"}
            </div>
          </div>
        </div>

        {/* Out of Stock Products */}
        <div
          onClick={() => setStatusFilter("out_of_stock")}
          className={`p-4 sm:p-5 rounded-2xl border shadow-2xs cursor-pointer transition-all ${
            outOfStockCount > 0
              ? "bg-rose-50/70 border-rose-200 hover:border-rose-300"
              : "bg-white border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-800 uppercase tracking-wider">
              Out of Stock
            </span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                outOfStockCount > 0 ? "bg-rose-500 text-white" : "bg-rose-50 text-rose-600"
              }`}
            >
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div
              className={`text-2xl font-bold ${
                outOfStockCount > 0 ? "text-rose-700" : "text-slate-900"
              }`}
            >
              {outOfStockCount}
            </div>
            <div className="text-[11px] text-rose-700/80 mt-0.5">
              {outOfStockCount > 0 ? "Depleted stock" : "None out of stock"}
            </div>
          </div>
        </div>

        {/* Total Inventory Value (Requirement 3) */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Inventory Value
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(totalRetailValuation)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Cost: <span className="font-semibold text-slate-700">{formatCurrency(totalCostValuation)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SUB-TABS: Catalog vs Stock Movement History */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab("catalog")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === "catalog"
                ? "bg-purple-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Product Inventory ({products.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveSubTab("movements");
              if (onRefreshMovements) onRefreshMovements();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === "movements"
                ? "bg-purple-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <History className="w-4 h-4" />
            <span>Stock Audit History ({stockMovements.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* 3. FILTER AND SEARCH CONTROLS */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Instant Search Bar with Clear & Voice Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={
                activeSubTab === "catalog"
                  ? "Search by name, SKU, category, or brand..."
                  : "Search movements by product, invoice, notes..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-14 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-500 text-slate-900 font-medium placeholder:text-slate-400"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer"
                  title="Clear search input"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              {activeSubTab === "catalog" && (
                <VoiceInputButton
                  size="sm"
                  onTranscript={(spokenText) => {
                    setSearchTerm(spokenText);
                  }}
                />
              )}
            </div>
          </div>

          {/* Catalog-only Filters and Sort Controls */}
          {activeSubTab === "catalog" && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Category Filter */}
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider hidden sm:inline">Category:</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="text-xs bg-transparent border-none focus:outline-hidden text-slate-700 font-semibold cursor-pointer"
                >
                  <option value="all">All Categories ({categories.length})</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Stock Status Filter */}
              <div className="flex rounded-xl border border-slate-200 p-0.5 bg-slate-50 text-xs">
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    statusFilter === "all"
                      ? "bg-white text-slate-900 shadow-xs font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setStatusFilter("in_stock")}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    statusFilter === "in_stock"
                      ? "bg-white text-emerald-700 shadow-xs font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  In Stock
                </button>
                <button
                  onClick={() => setStatusFilter("low_stock")}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                    statusFilter === "low_stock"
                      ? "bg-amber-500 text-white shadow-xs font-semibold"
                      : "text-amber-700 hover:text-amber-800"
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>Low ({lowStockCount})</span>
                </button>
                <button
                  onClick={() => setStatusFilter("out_of_stock")}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                    statusFilter === "out_of_stock"
                      ? "bg-rose-500 text-white shadow-xs font-semibold"
                      : "text-rose-700 hover:text-rose-800"
                  }`}
                >
                  <AlertOctagon className="w-3 h-3" />
                  <span>Out ({outOfStockCount})</span>
                </button>
              </div>

              {/* Price Range Filter */}
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider hidden sm:inline">Price:</span>
                <select
                  value={priceRangePreset}
                  onChange={(e) => {
                    const preset = e.target.value as any;
                    setPriceRangePreset(preset);
                    if (preset === "all") {
                      setMinPrice("");
                      setMaxPrice("");
                    } else if (preset === "under_1k") {
                      setMinPrice("");
                      setMaxPrice("1000");
                    } else if (preset === "1k_5k") {
                      setMinPrice("1000");
                      setMaxPrice("5000");
                    } else if (preset === "5k_15k") {
                      setMinPrice("5000");
                      setMaxPrice("15000");
                    } else if (preset === "above_15k") {
                      setMinPrice("15000");
                      setMaxPrice("");
                    }
                  }}
                  className="text-xs bg-transparent border-none focus:outline-hidden text-slate-700 font-semibold cursor-pointer"
                >
                  <option value="all">All Prices</option>
                  <option value="under_1k">Under ₹1,000</option>
                  <option value="1k_5k">₹1,000 - ₹5,000</option>
                  <option value="5k_15k">₹5,000 - ₹15,000</option>
                  <option value="above_15k">Above ₹15,000</option>
                  <option value="custom">Custom Range...</option>
                </select>
              </div>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-xs bg-transparent border-none focus:outline-hidden text-slate-700 font-semibold cursor-pointer"
                >
                  <option value="name_asc">Name (A-Z)</option>
                  <option value="name_desc">Name (Z-A)</option>
                  <option value="price_asc">Price (Low → High)</option>
                  <option value="price_desc">Price (High → Low)</option>
                  <option value="stock_asc">Stock (Low → High)</option>
                  <option value="stock_desc">Stock (High → Low)</option>
                  <option value="recently_added">Recently Added</option>
                  <option value="category">Category (A-Z)</option>
                  <option value="discount_desc">Highest Discount</option>
                </select>
              </div>

              {/* Discount Filter Button (Requirement: Add a filter to show only discounted products) */}
              <button
                type="button"
                onClick={() => setOnlyDiscounted(!onlyDiscounted)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                  onlyDiscounted
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
                }`}
                title="Filter to show only discounted products"
              >
                <Tag className={`w-3.5 h-3.5 ${onlyDiscounted ? "text-white" : "text-emerald-600"}`} />
                <span>Discounted ({discountedCount})</span>
              </button>

              {/* Reset Filters button */}
              {(searchTerm || selectedCategory !== "all" || statusFilter !== "all" || priceRangePreset !== "all" || minPrice !== "" || maxPrice !== "" || onlyDiscounted || sortBy !== "name_asc") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedCategory("all");
                    setStatusFilter("all");
                    setPriceRangePreset("all");
                    setMinPrice("");
                    setMaxPrice("");
                    setOnlyDiscounted(false);
                    setSortBy("name_asc");
                  }}
                  className="px-2.5 py-1 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 flex items-center gap-1 cursor-pointer transition-colors"
                  title="Reset all filters and sorting"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Custom Price Inputs when Custom Range is active */}
        {activeSubTab === "catalog" && (priceRangePreset === "custom" || minPrice !== "" || maxPrice !== "") && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-purple-600" />
              <span>Price Range (₹):</span>
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="0"
                placeholder="Min ₹"
                value={minPrice}
                onChange={(e) => {
                  setMinPrice(e.target.value);
                  setPriceRangePreset("custom");
                }}
                className="w-24 px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-purple-500 font-mono"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="number"
                min="0"
                placeholder="Max ₹"
                value={maxPrice}
                onChange={(e) => {
                  setMaxPrice(e.target.value);
                  setPriceRangePreset("custom");
                }}
                className="w-24 px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-purple-500 font-mono"
              />
              {(minPrice !== "" || maxPrice !== "") && (
                <button
                  type="button"
                  onClick={() => {
                    setMinPrice("");
                    setMaxPrice("");
                    setPriceRangePreset("all");
                  }}
                  className="text-[11px] text-slate-400 hover:text-slate-600 p-1"
                  title="Clear price filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Active Filters Summary Bar */}
        {activeSubTab === "catalog" && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            <div>
              Showing <span className="font-bold text-slate-800">{sortedProducts.length}</span> of{" "}
              <span className="font-semibold text-slate-700">{products.length}</span> products
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {searchTerm && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-semibold border border-purple-200">
                  <span>Search: "{searchTerm}"</span>
                  <X className="w-3 h-3 cursor-pointer hover:text-purple-900" onClick={() => setSearchTerm("")} />
                </span>
              )}
              {selectedCategory !== "all" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                  <span>Category: {selectedCategory}</span>
                  <X className="w-3 h-3 cursor-pointer hover:text-slate-900" onClick={() => setSelectedCategory("all")} />
                </span>
              )}
              {statusFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                  <span>Status: {statusFilter.replace("_", " ").toUpperCase()}</span>
                  <X className="w-3 h-3 cursor-pointer hover:text-slate-900" onClick={() => setStatusFilter("all")} />
                </span>
              )}
              {(minPrice !== "" || maxPrice !== "") && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                  <span>Price: ₹{minPrice || "0"} - {maxPrice ? `₹${maxPrice}` : "Any"}</span>
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-slate-900"
                    onClick={() => {
                      setMinPrice("");
                      setMaxPrice("");
                      setPriceRangePreset("all");
                    }}
                  />
                </span>
              )}
              {onlyDiscounted && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
                  <span>Discount: Only Discounted ({discountedCount})</span>
                  <X className="w-3 h-3 cursor-pointer hover:text-emerald-950" onClick={() => setOnlyDiscounted(false)} />
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. MAIN VIEW: CATALOG TABLE (Requirement 6: Product, SKU, Category, Current Stock, Minimum Stock, Selling Price, Stock Status, Actions) */}
      {activeSubTab === "catalog" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-center">Current Stock</th>
                  <th className="py-3 px-4 text-center">Minimum Stock</th>
                  <th className="py-3 px-4 text-right">Selling Price & Discount</th>
                  <th className="py-3 px-4 text-center">Stock Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {sortedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <div className="max-w-md mx-auto flex flex-col items-center">
                        <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3 shadow-inner">
                          <Package className="w-7 h-7" />
                        </div>
                        <h4 className="text-base font-bold text-slate-900">No products found</h4>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm">
                          {searchTerm || selectedCategory !== "all" || statusFilter !== "all" || priceRangePreset !== "all" || minPrice !== "" || maxPrice !== "" || onlyDiscounted
                            ? "We couldn't find any products matching your active search query or selected filter criteria. Try adjusting or resetting your filters."
                            : "Your product inventory catalog is currently empty. Click 'Add Product' to register your first item."}
                        </p>

                        <div className="flex items-center gap-2 mt-4">
                          {(searchTerm || selectedCategory !== "all" || statusFilter !== "all" || priceRangePreset !== "all" || minPrice !== "" || maxPrice !== "" || onlyDiscounted || sortBy !== "name_asc") && (
                            <button
                              type="button"
                              onClick={() => {
                                setSearchTerm("");
                                setSelectedCategory("all");
                                setStatusFilter("all");
                                setPriceRangePreset("all");
                                setMinPrice("");
                                setMaxPrice("");
                                setOnlyDiscounted(false);
                                setSortBy("name_asc");
                              }}
                              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Reset All Filters</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={openAddModal}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors shadow-2xs cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Product</span>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedProducts.map((prod) => {
                    const stock = Number(prod.stock_quantity) || 0;
                    const minLvl = Number(prod.min_stock_level) || 0;
                    const isOutOfStock = stock <= 0;
                    const isLowStock = !isOutOfStock && stock <= minLvl;
                    const purchaseCost = Number(prod.purchase_price) || 0;
                    const margin =
                      prod.price > 0 && purchaseCost > 0
                        ? Math.round(((prod.price - purchaseCost) / prod.price) * 100)
                        : null;
                    const discInfo = getDiscountInfo(prod.mrp, prod.price);

                    return (
                      <tr key={prod.id} className={`hover:bg-slate-50/80 transition-colors ${discInfo.hasDiscount ? "bg-emerald-50/15" : ""}`}>
                        {/* 1. Product Name, Brand, Supplier & Smart Alerts */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-slate-900 text-sm">{prod.name}</span>
                            {prod.brand && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                {prod.brand}
                              </span>
                            )}
                            {discInfo.hasDiscount && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                                <Tag className="w-2.5 h-2.5 text-emerald-700" />
                                <span>{discInfo.discountPercent}% OFF</span>
                              </span>
                            )}
                            {productAlertTags[prod.id]?.includes("high_demand") && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800">
                                🔥 High Demand
                              </span>
                            )}
                            {productAlertTags[prod.id]?.includes("slow_moving") && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                                📉 Slow Moving
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                            {prod.brand && !prod.supplier && (
                              <span className="text-slate-500">Brand: <span className="font-medium text-slate-700">{prod.brand}</span></span>
                            )}
                            {prod.supplier ? (
                              <span className="inline-flex items-center gap-1 text-slate-500">
                                <Building2 className="w-3 h-3 text-slate-400" />
                                <span>{prod.supplier}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400">No supplier assigned</span>
                            )}
                          </div>
                        </td>

                        {/* 2. SKU */}
                        <td className="py-3.5 px-4">
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                            {prod.sku || `SKU-${prod.id.toString().padStart(4, "0")}`}
                          </span>
                        </td>

                        {/* 3. Category */}
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {prod.category}
                          </span>
                        </td>

                        {/* 4. Current Stock */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex flex-col items-center">
                            <span
                              className={`text-sm font-bold font-mono ${
                                isOutOfStock
                                  ? "text-rose-600"
                                  : isLowStock
                                  ? "text-amber-600"
                                  : "text-slate-800"
                              }`}
                            >
                              {stock}
                            </span>
                            <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
                              <div
                                className={`h-full rounded-full ${
                                  isOutOfStock
                                    ? "bg-rose-500 w-full"
                                    : isLowStock
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                                }`}
                                style={{
                                  width: isOutOfStock
                                    ? "100%"
                                    : `${Math.min(100, Math.max(15, (stock / Math.max(1, minLvl * 3)) * 100))}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* 5. Minimum Stock */}
                        <td className="py-3.5 px-4 text-center text-slate-600 font-mono font-medium">
                          {minLvl}
                        </td>

                        {/* 6. Selling Price & Discounts (Requirement: Discount Detection & Highlight) */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="font-mono font-bold text-slate-900 text-sm">
                            {formatCurrency(prod.price)}
                          </div>
                          {discInfo.hasDiscount ? (
                            <div className="flex flex-col items-end gap-0.5 mt-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="line-through text-slate-400 font-mono text-[10px]">
                                  MRP: {formatCurrency(discInfo.mrp)}
                                </span>
                                <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-extrabold text-[9px] border border-emerald-200">
                                  {discInfo.discountPercent}% OFF
                                </span>
                              </div>
                              <div className="text-[10px] font-mono font-bold text-emerald-700">
                                Save {formatCurrency(discInfo.discountAmount)}
                              </div>
                            </div>
                          ) : null}
                          {purchaseCost > 0 && (
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              Cost: {formatCurrency(purchaseCost)}
                              {margin !== null && (
                                <span className="text-emerald-600 font-semibold ml-1">
                                  ({margin}%)
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 7. Stock Status (Requirement 5) */}
                        <td className="py-3.5 px-4 text-center">
                          {isOutOfStock ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <AlertOctagon className="w-3 h-3 text-rose-600" />
                              <span>Out of Stock</span>
                            </span>
                          ) : isLowStock ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>Low Stock</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>In Stock</span>
                            </span>
                          )}
                        </td>

                        {/* 8. Actions (Requirement 7: Add, Edit, Delete, Adjust Stock, View Product Details) */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            {/* View Product Details */}
                            <button
                              onClick={() => setViewingProduct(prod)}
                              title="View Product Details"
                              className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Adjust Stock */}
                            <button
                              onClick={() => openAdjustModal(prod)}
                              title="Adjust Stock Quantity"
                              className="px-2 py-1 text-[11px] font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-colors cursor-pointer border border-purple-200"
                            >
                              Adjust
                            </button>

                            {/* Edit Product */}
                            <button
                              onClick={() => openEditModal(prod)}
                              title="Edit product"
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Product */}
                            <button
                              onClick={() => setDeletingProduct(prod)}
                              title="Delete product"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
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
      )}

      {/* 5. MAIN VIEW: STOCK MOVEMENT / HISTORY TABLE */}
      {activeSubTab === "movements" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-purple-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Real-Time Stock Audit Log
              </h3>
            </div>
            <button
              onClick={onRefreshMovements}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-600 hover:text-purple-800 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Refresh Log</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Movement Type</th>
                  <th className="py-3 px-4 text-center">Change Qty</th>
                  <th className="py-3 px-4 text-center">Prev Stock</th>
                  <th className="py-3 px-4 text-center">New Stock</th>
                  <th className="py-3 px-4">Reference / Reason Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <History className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-slate-600">No stock movements recorded yet</p>
                      <p className="text-[11px] mt-1">
                        Stock movements are logged automatically on sales, purchases, or adjustments.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((m) => {
                    const isSale = m.movement_type === "Sale";
                    const isAdd = m.movement_type === "Stock Added" || m.movement_type === "Restock";
                    const isRestored = m.movement_type === "Sale Restored";

                    return (
                      <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Date */}
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                          {m.created_at ? m.created_at.slice(0, 19).replace("T", " ") : "Just now"}
                        </td>

                        {/* Product */}
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {m.product_name}
                        </td>

                        {/* Movement Type */}
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              isSale
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : isAdd
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : isRestored
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-purple-50 text-purple-700 border-purple-200"
                            }`}
                          >
                            {m.movement_type}
                          </span>
                        </td>

                        {/* Quantity */}
                        <td className="py-3 px-4 text-center font-mono font-bold">
                          <span
                            className={
                              m.quantity > 0
                                ? "text-emerald-600"
                                : m.quantity < 0
                                ? "text-rose-600"
                                : "text-slate-600"
                            }
                          >
                            {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                          </span>
                        </td>

                        {/* Prev Stock */}
                        <td className="py-3 px-4 text-center font-mono text-slate-500">
                          {m.previous_stock}
                        </td>

                        {/* New Stock */}
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
                          {m.new_stock}
                        </td>

                        {/* Reference / Notes */}
                        <td className="py-3 px-4 text-slate-500">
                          <div className="flex items-center gap-1.5">
                            {m.reference_id && (
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                                {m.reference_id}
                              </span>
                            )}
                            <span className="text-xs truncate max-w-xs">{m.notes || "—"}</span>
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
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD PRODUCT FORM (Requirement 2, 7, 12) */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add New Product</h3>
                  <p className="text-[11px] text-slate-500">
                    Register a new product in your inventory catalog
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4 pt-4">
              {/* Product Name with Voice Mic Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Product Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400">Speak name:</span>
                    <VoiceInputButton
                      size="sm"
                      onTranscript={(spokenText) => {
                        setName((prev) => (prev ? `${prev} ${spokenText}` : spokenText));
                      }}
                    />
                  </div>
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ergonomic Bluetooth Mouse"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden text-slate-900 font-medium"
                />
              </div>

              {/* SKU & Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    SKU / Product Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ACC-402"
                    value={sku}
                    onChange={(e) => setSku(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    list="category-suggestions"
                    placeholder="e.g. Electronics"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                  <datalist id="category-suggestions">
                    <option value="Electronics" />
                    <option value="Furniture" />
                    <option value="Hardware" />
                    <option value="Supplies" />
                    <option value="Accessories" />
                  </datalist>
                </div>
              </div>

              {/* Supplier & Brand */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Supplier / Vendor
                  </label>
                  <input
                    type="text"
                    list="supplier-suggestions"
                    placeholder="e.g. Apex Peripherals & Components"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                  <datalist id="supplier-suggestions">
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.company_name} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Brand / Manufacturer
                  </label>
                  <input
                    type="text"
                    list="brand-suggestions"
                    placeholder="e.g. Dell, Logitech, Epson"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                  <datalist id="brand-suggestions">
                    <option value="Dell" />
                    <option value="Logitech" />
                    <option value="Epson" />
                    <option value="Honeywell" />
                    <option value="Steelcase" />
                    <option value="Brother" />
                    <option value="Anker" />
                    <option value="HP" />
                    <option value="Canon" />
                  </datalist>
                </div>
              </div>

              {/* DISCOUNT MANAGEMENT & PRICING SECTION (Requirement 3) */}
              <div className="p-3.5 bg-purple-50/60 border border-purple-200/80 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                    <Tag className="w-3.5 h-3.5 text-purple-600" />
                    <span>Pricing & Discount Setup</span>
                  </div>
                  {/* Discount Type Toggle */}
                  <div className="flex rounded-lg border border-purple-200 p-0.5 bg-white text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setDiscountType("percentage")}
                      className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                        discountType === "percentage"
                          ? "bg-purple-600 text-white"
                          : "text-purple-700 hover:bg-purple-50"
                      }`}
                    >
                      % Discount
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType("fixed")}
                      className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                        discountType === "fixed"
                          ? "bg-purple-600 text-white"
                          : "text-purple-700 hover:bg-purple-50"
                      }`}
                    >
                      Fixed (₹)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {/* Original / MRP Price */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Original / MRP (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 1000"
                      value={mrp}
                      onChange={(e) => handleMrpChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-purple-200 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 font-mono font-bold"
                    />
                  </div>

                  {/* Discount Input (% or ₹) */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      {discountType === "percentage" ? "Discount (%)" : "Discount (₹)"}
                    </label>
                    {discountType === "percentage" ? (
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        placeholder="e.g. 20"
                        value={discountPercent}
                        onChange={(e) => handleDiscountPercentChange(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-purple-200 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 font-mono font-bold text-emerald-700"
                      />
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="e.g. 200"
                        value={discountAmount}
                        onChange={(e) => handleDiscountAmountChange(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-purple-200 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 font-mono font-bold text-emerald-700"
                      />
                    )}
                  </div>

                  {/* Selling Price (Final) */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Selling Price (₹) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="e.g. 800"
                      value={sellingPrice}
                      onChange={(e) => handleSellingPriceChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-purple-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 font-mono font-extrabold text-purple-900"
                    />
                  </div>
                </div>

                {/* Live Discount Calculation Summary */}
                {parseFloat(mrp) > 0 && parseFloat(sellingPrice) > parseFloat(mrp) ? (
                  <div className="flex items-center gap-1.5 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                    <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Invalid value: Selling Price (₹{sellingPrice}) cannot be greater than MRP (₹{mrp}).</span>
                  </div>
                ) : parseFloat(mrp) > 0 && parseFloat(sellingPrice) > 0 ? (
                  <div className="flex items-center justify-between text-[11px] bg-white px-2.5 py-1.5 rounded-lg border border-purple-200/80">
                    <span className="text-slate-600">
                      Savings: <strong className="text-emerald-700">₹{Math.max(0, Math.round((parseFloat(mrp) - parseFloat(sellingPrice)) * 100) / 100)}</strong>
                    </span>
                    <span className="text-slate-600">
                      Discount: <strong className="text-purple-700">{Math.max(0, Math.round(((parseFloat(mrp) - parseFloat(sellingPrice)) / parseFloat(mrp)) * 1000) / 10)}%</strong>
                    </span>
                    <span className="text-slate-600">
                      Customer Pays: <strong className="text-slate-900 font-bold">₹{sellingPrice}</strong>
                    </span>
                  </div>
                ) : null}

                {/* Purchase Cost Price */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Purchase Price / Unit Cost (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 500"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Used for Gross & Net Profit calculations</p>
                </div>
              </div>

              {/* Current Stock & Minimum Stock Level */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Starting Stock Units <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={currentStock}
                    onChange={(e) => setCurrentStock(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden font-mono font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Minimum Stock Level <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Triggers Low Stock alert</p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT PRODUCT MODAL (Requirement 2, 7, 12) */}
      {/* ========================================================================= */}
      {editingProduct && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Edit Product Details</h3>
                  <p className="text-[11px] text-slate-500">
                    Modify product SKU, prices, supplier, and stock boundaries
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4 pt-4">
              {/* Edit Product Name with Voice Mic Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Product Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400">Speak name:</span>
                    <VoiceInputButton
                      size="sm"
                      onTranscript={(spokenText) => {
                        setEditName((prev) => (prev ? `${prev} ${spokenText}` : spokenText));
                      }}
                    />
                  </div>
                </div>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden text-slate-900 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    SKU Code
                  </label>
                  <input
                    type="text"
                    value={editSku}
                    onChange={(e) => setEditSku(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Edit Supplier & Brand */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Supplier / Vendor
                  </label>
                  <input
                    type="text"
                    list="edit-supplier-suggestions"
                    placeholder="e.g. Apex Peripherals & Components"
                    value={editSupplier}
                    onChange={(e) => setEditSupplier(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                  <datalist id="edit-supplier-suggestions">
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.company_name} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Brand / Manufacturer
                  </label>
                  <input
                    type="text"
                    list="edit-brand-suggestions"
                    placeholder="e.g. Dell, Logitech, Epson"
                    value={editBrand}
                    onChange={(e) => setEditBrand(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                  <datalist id="edit-brand-suggestions">
                    <option value="Dell" />
                    <option value="Logitech" />
                    <option value="Epson" />
                    <option value="Honeywell" />
                    <option value="Steelcase" />
                    <option value="Brother" />
                    <option value="Anker" />
                    <option value="HP" />
                    <option value="Canon" />
                  </datalist>
                </div>
              </div>

              {/* PRICING & DISCOUNT SETUP (Requirement 3) */}
              <div className="p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                    <Tag className="w-3.5 h-3.5 text-blue-600" />
                    <span>Pricing & Discount Setup</span>
                  </div>
                  {/* Discount Type Toggle */}
                  <div className="flex rounded-lg border border-blue-200 p-0.5 bg-white text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setEditDiscountType("percentage")}
                      className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                        editDiscountType === "percentage"
                          ? "bg-blue-600 text-white"
                          : "text-blue-700 hover:bg-blue-50"
                      }`}
                    >
                      % Discount
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditDiscountType("fixed")}
                      className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                        editDiscountType === "fixed"
                          ? "bg-blue-600 text-white"
                          : "text-blue-700 hover:bg-blue-50"
                      }`}
                    >
                      Fixed (₹)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {/* Original / MRP Price */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Original / MRP (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editMrp}
                      onChange={(e) => handleEditMrpChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-blue-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 font-mono font-bold"
                    />
                  </div>

                  {/* Discount Input (% or ₹) */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      {editDiscountType === "percentage" ? "Discount (%)" : "Discount (₹)"}
                    </label>
                    {editDiscountType === "percentage" ? (
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={editDiscountPercent}
                        onChange={(e) => handleEditDiscountPercentChange(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-blue-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 font-mono font-bold text-emerald-700"
                      />
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editDiscountAmount}
                        onChange={(e) => handleEditDiscountAmountChange(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-blue-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 font-mono font-bold text-emerald-700"
                      />
                    )}
                  </div>

                  {/* Selling Price (Final) */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Selling Price (₹) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={editSellingPrice}
                      onChange={(e) => handleEditSellingPriceChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 font-mono font-extrabold text-blue-900"
                    />
                  </div>
                </div>

                {/* Live Discount Calculation Summary */}
                {parseFloat(editMrp) > 0 && parseFloat(editSellingPrice) > parseFloat(editMrp) ? (
                  <div className="flex items-center gap-1.5 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                    <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Invalid value: Selling Price (₹{editSellingPrice}) cannot be greater than MRP (₹{editMrp}).</span>
                  </div>
                ) : parseFloat(editMrp) > 0 && parseFloat(editSellingPrice) > 0 ? (
                  <div className="flex items-center justify-between text-[11px] bg-white px-2.5 py-1.5 rounded-lg border border-blue-200/80">
                    <span className="text-slate-600">
                      Savings: <strong className="text-emerald-700">₹{Math.max(0, Math.round((parseFloat(editMrp) - parseFloat(editSellingPrice)) * 100) / 100)}</strong>
                    </span>
                    <span className="text-slate-600">
                      Discount: <strong className="text-blue-700">{Math.max(0, Math.round(((parseFloat(editMrp) - parseFloat(editSellingPrice)) / parseFloat(editMrp)) * 1000) / 10)}%</strong>
                    </span>
                    <span className="text-slate-600">
                      Customer Pays: <strong className="text-slate-900 font-bold">₹{editSellingPrice}</strong>
                    </span>
                  </div>
                ) : null}

                {/* Purchase Cost Price */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Purchase Price / Unit Cost (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editPurchasePrice}
                    onChange={(e) => setEditPurchasePrice(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Used for Gross & Net Profit calculations</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Current Stock <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editStock}
                    onChange={(e) => setEditStock(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden font-mono font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Minimum Stock Level <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editMinStock}
                    onChange={(e) => setEditMinStock(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Updating..." : "Update Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: VIEW PRODUCT DETAILS MODAL (Requirement 7) */}
      {/* ========================================================================= */}
      {viewingProduct && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{viewingProduct.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {viewingProduct.sku || `SKU-${viewingProduct.id}`}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500">
                      {viewingProduct.category}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setViewingProduct(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 pt-4">
              {/* Status and Stock Banner */}
              <div className="p-4 rounded-xl border flex items-center justify-between bg-slate-50 border-slate-200">
                <div>
                  <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                    Current Stock Quantity
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900 mt-0.5">
                    {viewingProduct.stock_quantity} units
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Minimum threshold: {viewingProduct.min_stock_level} units
                  </div>
                </div>
                <div>
                  {viewingProduct.stock_quantity <= 0 ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      <AlertOctagon className="w-4 h-4 text-rose-600" />
                      <span>Out of Stock</span>
                    </span>
                  ) : viewingProduct.stock_quantity <= viewingProduct.min_stock_level ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Low Stock</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>In Stock</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Pricing, MRP & Discount Details (Requirement 3) */}
              <div className="p-3.5 rounded-xl bg-purple-50/50 border border-purple-200/80 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                  <Tag className="w-3.5 h-3.5 text-purple-600" />
                  <span>Discount & Pricing Breakdown</span>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="p-2.5 rounded-lg bg-white border border-purple-100">
                    <div className="text-[10px] text-slate-500 font-semibold uppercase">Original / MRP</div>
                    <div className="text-sm font-bold font-mono text-slate-800 mt-0.5">
                      {formatCurrency(viewingProduct.mrp ?? viewingProduct.price)}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white border border-purple-100">
                    <div className="text-[10px] text-slate-500 font-semibold uppercase">Discount</div>
                    <div className="text-sm font-bold font-mono text-emerald-700 mt-0.5">
                      {viewingProduct.discount_percent && viewingProduct.discount_percent > 0 ? (
                        <>
                          {viewingProduct.discount_percent}% OFF
                          <span className="text-[10px] text-slate-500 block">
                            (Save {formatCurrency(viewingProduct.discount_amount || (viewingProduct.mrp ? viewingProduct.mrp - viewingProduct.price : 0))})
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400">No discount</span>
                      )}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white border border-purple-200">
                    <div className="text-[10px] text-purple-900 font-semibold uppercase">Final Selling Price</div>
                    <div className="text-sm font-extrabold font-mono text-purple-900 mt-0.5">
                      {formatCurrency(viewingProduct.price)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-white border border-slate-100">
                    <span className="text-[11px] text-slate-500 block">Purchase Cost:</span>
                    <strong className="font-mono text-slate-800">
                      {formatCurrency(viewingProduct.purchase_price || 0)}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                    <span className="text-[11px] text-emerald-800 block">Profit per unit:</span>
                    <strong className="font-mono text-emerald-900">
                      {formatCurrency(viewingProduct.price - (viewingProduct.purchase_price || 0))} (
                      {viewingProduct.price > 0
                        ? Math.round(
                            ((viewingProduct.price - (viewingProduct.purchase_price || 0)) /
                              viewingProduct.price) *
                              100
                          )
                        : 0}
                      %)
                    </strong>
                  </div>
                </div>
              </div>

              {/* Supplier Information */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Supplier / Procurement Source
                </div>
                <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>{viewingProduct.supplier || "No designated supplier"}</span>
                </div>
              </div>

              {/* Recent Product Stock Movements */}
              <div>
                <div className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-purple-600" />
                  <span>Recent Stock History for this product</span>
                </div>
                {stockMovements.filter(
                  (m) =>
                    m.product_id === viewingProduct.id ||
                    m.product_name.toLowerCase() === viewingProduct.name.toLowerCase()
                ).length === 0 ? (
                  <div className="p-3 bg-slate-50 rounded-xl text-center text-[11px] text-slate-400">
                    No individual movements recorded yet.
                  </div>
                ) : (
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 text-xs">
                    {stockMovements
                      .filter(
                        (m) =>
                          m.product_id === viewingProduct.id ||
                          m.product_name.toLowerCase() === viewingProduct.name.toLowerCase()
                      )
                      .slice(0, 5)
                      .map((m) => (
                        <div key={m.id} className="p-2.5 flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-slate-800">{m.movement_type}</span>
                            <span className="text-[10px] text-slate-400 ml-2">
                              {m.created_at ? m.created_at.slice(0, 10) : "Recent"}
                            </span>
                            {m.notes && (
                              <div className="text-[10px] text-slate-500 truncate max-w-xs">
                                {m.notes}
                              </div>
                            )}
                          </div>
                          <div className="text-right font-mono">
                            <span
                              className={`font-bold ${
                                m.quantity > 0 ? "text-emerald-600" : "text-rose-600"
                              }`}
                            >
                              {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                            </span>
                            <div className="text-[10px] text-slate-400">
                              {m.previous_stock} &rarr; {m.new_stock}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    const p = viewingProduct;
                    setViewingProduct(null);
                    openAdjustModal(p);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg transition-colors cursor-pointer border border-purple-200"
                >
                  Adjust Stock
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const p = viewingProduct;
                    setViewingProduct(null);
                    openEditModal(p);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Edit Details
                </button>
                <button
                  type="button"
                  onClick={() => setViewingProduct(null)}
                  className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: STOCK ADJUSTMENT MODAL (Requirement 8) */}
      {/* ========================================================================= */}
      {adjustingProduct && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Adjust Stock</h3>
                  <p className="text-[11px] text-slate-500">
                    {adjustingProduct.name} ({adjustingProduct.sku || "No SKU"})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAdjustingProduct(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-3 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Current Stock on Record:</span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {adjustingProduct.stock_quantity} units
              </span>
            </div>

            {adjustError && (
              <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{adjustError}</span>
              </div>
            )}

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              {/* Adjustment Mode Selection: Increase / Decrease / Set Exact (Requirement 8) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Adjustment Action
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAdjustAction("add")}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer text-center flex flex-col items-center gap-0.5 ${
                      adjustAction === "add"
                        ? "bg-purple-50 border-purple-500 text-purple-700 font-bold"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <ArrowUp className="w-3.5 h-3.5 text-emerald-600" />
                    <span>+ Increase</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustAction("decrease")}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer text-center flex flex-col items-center gap-0.5 ${
                      adjustAction === "decrease"
                        ? "bg-purple-50 border-purple-500 text-purple-700 font-bold"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <ArrowDown className="w-3.5 h-3.5 text-rose-600" />
                    <span>- Decrease</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustAction("set")}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer text-center flex flex-col items-center gap-0.5 ${
                      adjustAction === "set"
                        ? "bg-purple-50 border-purple-500 text-purple-700 font-bold"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="font-mono text-sm leading-none">=</span>
                    <span>= Set Count</span>
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {adjustAction === "add"
                    ? "Quantity to Add (+)"
                    : adjustAction === "decrease"
                    ? "Quantity to Deduct (-)"
                    : "New Actual Stock Count (=)"}
                </label>
                <input
                  type="number"
                  min={adjustAction === "set" ? "0" : "1"}
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden font-mono font-bold"
                />
              </div>

              {/* Projected Result Preview */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                <span className="text-slate-500">Projected new stock:</span>
                <span className="font-mono font-bold text-slate-900">
                  {adjustAction === "add"
                    ? adjustingProduct.stock_quantity + (parseInt(adjustQty, 10) || 0)
                    : adjustAction === "decrease"
                    ? Math.max(0, adjustingProduct.stock_quantity - (parseInt(adjustQty, 10) || 0))
                    : Math.max(0, parseInt(adjustQty, 10) || 0)}{" "}
                  units
                </span>
              </div>

              {/* Reason / Notes: Required (Requirement 8) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Adjustment <span className="text-rose-500">* Required</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Supplier PO received, damaged goods write-off, physical stock audit"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden text-slate-900"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Every manual stock change must include an audit reason.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Confirm Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: DELETE CONFIRMATION MODAL (Requirement 7) */}
      {/* ========================================================================= */}
      {deletingProduct && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Delete Product?</h3>
            <p className="text-xs text-slate-500 mt-1">
              Are you sure you want to delete{" "}
              <strong className="text-slate-800">{deletingProduct.name}</strong> (SKU:{" "}
              {deletingProduct.sku || "N/A"})? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setDeletingProduct(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

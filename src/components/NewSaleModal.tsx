import React, { useState, useEffect, useMemo } from "react";
import { ProductItem, CustomerItem, SaleProductItem } from "../types";
import { formatCurrency, getDiscountInfo } from "../utils/formatters";
import {
  X,
  Plus,
  Trash2,
  AlertCircle,
  Receipt,
  User,
  Phone,
  Calendar,
  CreditCard,
  CheckCircle2,
  Package,
  Tag,
} from "lucide-react";

interface NewSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductItem[];
  customers?: CustomerItem[];
  onSaveSale: (saleData: {
    customer_name: string;
    customer_phone: string;
    customer_address?: string;
    customer_gst?: string;
    customer_notes?: string;
    items: SaleProductItem[];
    subtotal: number;
    discount: number;
    tax_amount: number;
    total_amount: number;
    payment_method: string;
    payment_status: string;
    sale_date: string;
    notes: string;
  }) => Promise<boolean>;
  nextInvoiceNumber?: string;
}

interface ItemRow {
  id: string;
  product_id: number | null;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  max_stock: number | null; // null if custom item
}

export const NewSaleModal: React.FC<NewSaleModalProps> = ({
  isOpen,
  onClose,
  products,
  customers = [],
  onSaveSale,
  nextInvoiceNumber = "INV-2026-XXXX",
}) => {
  if (!isOpen) return null;

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("new");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerGst, setCustomerGst] = useState("");
  const [showAdditionalCustFields, setShowAdditionalCustFields] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentStatus, setPaymentStatus] = useState("Paid");
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Multi-item rows
  const [items, setItems] = useState<ItemRow[]>([
    {
      id: "1",
      product_id: products.length > 0 ? products[0].id : null,
      product_name: products.length > 0 ? products[0].name : "",
      sku: products.length > 0 ? products[0].sku || "" : "",
      quantity: 1,
      unit_price: products.length > 0 ? products[0].price : 0,
      discount: 0,
      tax_rate: 18,
      max_stock: products.length > 0 ? products[0].stock_quantity : null,
    },
  ]);

  const selectedCustomer = useMemo(() => {
    if (selectedCustomerId === "new") return null;
    const cid = parseInt(selectedCustomerId, 10);
    return customers.find((c) => c.id === cid) || null;
  }, [selectedCustomerId, customers]);

  const handleCustomerSelectionChange = (val: string) => {
    setSelectedCustomerId(val);
    if (val === "new") {
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setCustomerGst("");
    } else {
      const cid = parseInt(val, 10);
      const cust = customers.find((c) => c.id === cid);
      if (cust) {
        setCustomerName(cust.name);
        setCustomerPhone(cust.phone || "");
        setCustomerAddress(cust.address || "");
        setCustomerGst(cust.gst_number || "");
      }
    }
  };

  // Autofill customer name if matching phone entered
  useEffect(() => {
    if (selectedCustomerId === "new" && customerPhone.trim().length >= 5) {
      const match = customers.find(
        (c) =>
          c.phone &&
          c.phone.replace(/\D/g, "").includes(customerPhone.trim().replace(/\D/g, ""))
      );
      if (match && !customerName) {
        setCustomerName(match.name);
        if (match.address && !customerAddress) setCustomerAddress(match.address);
        if (match.gst_number && !customerGst) setCustomerGst(match.gst_number);
      }
    }
  }, [customerPhone, customers, customerName, selectedCustomerId, customerAddress, customerGst]);

  const handleProductSelect = (index: number, selectedValue: string) => {
    const updated = [...items];
    if (selectedValue === "custom") {
      updated[index] = {
        ...updated[index],
        product_id: null,
        product_name: "",
        sku: "",
        unit_price: 0,
        max_stock: null,
      };
    } else {
      const prodId = parseInt(selectedValue, 10);
      const prod = products.find((p) => p.id === prodId);
      if (prod) {
        const isOOS = prod.stock_quantity <= 0;
        updated[index] = {
          ...updated[index],
          product_id: prod.id,
          product_name: prod.name,
          sku: prod.sku || "",
          unit_price: prod.price,
          max_stock: prod.stock_quantity,
          // Cap quantity if current qty > stock, or 0 if out of stock
          quantity: isOOS ? 0 : (prod.stock_quantity > 0 ? Math.min(updated[index].quantity || 1, prod.stock_quantity) : 1),
        };
        if (isOOS) {
          setErrorMessage(`"${prod.name}" is currently Out of Stock (0 available in inventory).`);
        }
      }
    }
    setItems(updated);
    setErrorMessage(null);
  };

  const handleItemChange = (index: number, field: keyof ItemRow, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
    setErrorMessage(null);
  };

  const addItemRow = () => {
    // Pick next product if available
    const unusedProduct = products.find((p) => !items.some((it) => it.product_id === p.id));
    const defaultProd = unusedProduct || products[0];

    const newRow: ItemRow = {
      id: Date.now().toString() + Math.random().toString().slice(2, 6),
      product_id: defaultProd ? defaultProd.id : null,
      product_name: defaultProd ? defaultProd.name : "",
      sku: defaultProd ? defaultProd.sku || "" : "",
      quantity: 1,
      unit_price: defaultProd ? defaultProd.price : 0,
      discount: 0,
      tax_rate: 18,
      max_stock: defaultProd ? defaultProd.stock_quantity : null,
    };
    setItems([...items, newRow]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  // Calculations
  const calculatedItems = items.map((it) => {
    const qty = Number(it.quantity) || 0;
    const price = Number(it.unit_price) || 0;
    const disc = Number(it.discount) || 0;
    const gross = qty * price;
    const netBeforeTax = Math.max(0, gross - disc);
    const taxRate = Number(it.tax_rate) || 0;
    const tax = (netBeforeTax * taxRate) / 100;
    const total = netBeforeTax + tax;
    return {
      ...it,
      gross,
      disc,
      netBeforeTax,
      tax,
      total,
    };
  });

  const subtotal = calculatedItems.reduce((acc, it) => acc + it.gross, 0);
  const totalDiscount = calculatedItems.reduce((acc, it) => acc + it.disc, 0);
  const totalTax = calculatedItems.reduce((acc, it) => acc + it.tax, 0);
  const grandTotal = calculatedItems.reduce((acc, it) => acc + it.total, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // 1. Validation: Customer Name
    if (!customerName.trim()) {
      setErrorMessage("Please enter the Customer Name.");
      return;
    }

    // 2. Validation: Empty or incomplete items
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.product_name.trim()) {
        setErrorMessage(`Item #${i + 1}: Please select or enter a Product Name.`);
        return;
      }
      if (it.quantity <= 0) {
        setErrorMessage(`Item #${i + 1}: Quantity must be at least 1.`);
        return;
      }
      if (it.unit_price < 0) {
        setErrorMessage(`Item #${i + 1}: Selling price cannot be negative.`);
        return;
      }

      // Stock oversell & Out of Stock prevention (Requirement 6 & 7)
      if (it.max_stock !== null && it.max_stock <= 0) {
        setErrorMessage(
          `Cannot complete sale: "${it.product_name}" is Out of Stock (0 units available in inventory).`
        );
        return;
      }
      if (it.max_stock !== null && it.quantity > it.max_stock) {
        setErrorMessage(
          `Cannot complete sale: Insufficient stock for "${it.product_name}". Only ${it.max_stock} units available, but ${it.quantity} requested.`
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const success = await onSaveSale({
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_address: customerAddress.trim(),
        customer_gst: customerGst.trim(),
        customer_notes: notes.trim(),
        items: calculatedItems.map((it) => ({
          product_id: it.product_id || undefined,
          product_name: it.product_name.trim(),
          sku: it.sku || undefined,
          quantity: it.quantity,
          unit_price: it.unit_price,
          discount: it.discount,
          tax_rate: it.tax_rate,
          total_price: Math.round(it.total * 100) / 100,
        })),
        subtotal: Math.round(subtotal * 100) / 100,
        discount: Math.round(totalDiscount * 100) / 100,
        tax_amount: Math.round(totalTax * 100) / 100,
        total_amount: Math.round(grandTotal * 100) / 100,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        sale_date: saleDate,
        notes: notes.trim(),
      });

      if (success) {
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save sale. Please check values and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[95vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Create New Sale / Invoice</h2>
                <span className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-md">
                  {nextInvoiceNumber}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Multi-product billing with automatic stock reduction and tax calculations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Validation Issue</p>
                <p>{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Section 1: Customer & Invoice Meta Details */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>Customer &amp; Transaction Details</span>
              </div>

              {/* Customer Selector Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">Client:</span>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => handleCustomerSelectionChange(e.target.value)}
                  className="text-xs px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs max-w-[280px]"
                >
                  <option value="new">+ Create / Type New Customer</option>
                  {customers.length > 0 && (
                    <optgroup label="Registered Customers Directory">
                      {customers.map((c) => {
                        const pend = Number(c.pending_amount || 0);
                        return (
                          <option key={c.id} value={c.id.toString()}>
                            {c.name} {c.phone ? `(${c.phone})` : ""} {pend > 0 ? `• Due: ${formatCurrency(pend)}` : ""}
                          </option>
                        );
                      })}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>

            {/* Selected Existing Customer Banner */}
            {selectedCustomer && (
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <span>{selectedCustomer.name}</span>
                    {selectedCustomer.gst_number && (
                      <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-white text-blue-800 rounded border border-blue-200">
                        GST: {selectedCustomer.gst_number}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-3 mt-0.5">
                    <span className="font-mono">{selectedCustomer.phone}</span>
                    {selectedCustomer.email && <span>• {selectedCustomer.email}</span>}
                    {selectedCustomer.address && <span>• {selectedCustomer.address}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right shrink-0">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Orders</span>
                    <div className="font-mono font-bold text-slate-800">{selectedCustomer.total_orders || 0}</div>
                  </div>
                  {Number(selectedCustomer.pending_amount || 0) > 0 ? (
                    <div>
                      <span className="text-[10px] text-amber-700 uppercase font-semibold">Pending Due</span>
                      <div className="font-mono font-bold text-amber-800">{formatCurrency(selectedCustomer.pending_amount)}</div>
                    </div>
                  ) : (
                    <div>
                      <span className="text-[10px] text-emerald-700 uppercase font-semibold">Balance</span>
                      <div className="font-mono font-bold text-emerald-700">All Cleared</div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => handleCustomerSelectionChange("new")}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold underline ml-1 cursor-pointer"
                  >
                    Change
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Customer Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Electronics"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900"
                  />
                </div>
              </div>

              {/* Customer Phone */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Phone <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="+91 98765 43210"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900 font-mono"
                  />
                </div>
              </div>

              {/* Sale Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sale Date
                </label>
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
                  <option value="Card">Debit / Credit Card</option>
                  <option value="Credit">Credit / Net 30 Terms</option>
                </select>
              </div>
            </div>

            {/* Optional Customer Tax & Address (collapsible or toggle for new customer) */}
            {selectedCustomerId === "new" && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdditionalCustFields(!showAdditionalCustFields)}
                  className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>{showAdditionalCustFields ? "− Hide Address & GSTIN" : "+ Add Customer Address & GSTIN (Optional)"}</span>
                </button>

                {showAdditionalCustFields && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2.5 pt-2 border-t border-slate-200">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Billing Address
                      </label>
                      <input
                        type="text"
                        placeholder="Shop / Office address, City, State"
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        className="w-full text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        GSTIN Number
                      </label>
                      <input
                        type="text"
                        maxLength={15}
                        placeholder="e.g. 27AABCS1429B1Z8"
                        value={customerGst}
                        onChange={(e) => setCustomerGst(e.target.value.toUpperCase())}
                        className="w-full text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900 font-mono uppercase"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Line Items (Multiple Products) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-blue-600" />
                <span>Invoice Items ({items.length})</span>
              </div>
              <button
                type="button"
                onClick={addItemRow}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Product</span>
              </button>
            </div>

            {/* Desktop / Tablet Items Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
                      <th className="py-2.5 px-3 min-w-[200px]">Product / Service</th>
                      <th className="py-2.5 px-3 w-28">Quantity</th>
                      <th className="py-2.5 px-3 w-32">Price (₹)</th>
                      <th className="py-2.5 px-3 w-24">Discount (₹)</th>
                      <th className="py-2.5 px-3 w-24">GST Rate</th>
                      <th className="py-2.5 px-3 w-28 text-right">Line Total (₹)</th>
                      <th className="py-2.5 px-3 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {items.map((item, index) => {
                      const isLowOrExceeded =
                        item.max_stock !== null && item.quantity > item.max_stock;
                      const isOutOfStock = item.max_stock !== null && item.max_stock <= 0;
                      const lineCalc = calculatedItems[index];

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            isLowOrExceeded ? "bg-rose-50/40" : ""
                          }`}
                        >
                          {/* Product Selection */}
                          <td className="py-2.5 px-3">
                            <div className="space-y-1">
                              <select
                                value={item.product_id ? item.product_id.toString() : "custom"}
                                onChange={(e) => handleProductSelect(index, e.target.value)}
                                className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-medium text-slate-800"
                              >
                                <optgroup label="Inventory Stock">
                                  {products.map((p) => {
                                    const isOos = p.stock_quantity <= 0;
                                    const isLow = p.stock_quantity > 0 && p.stock_quantity <= p.min_stock_level;
                                    const disc = getDiscountInfo(p.mrp, p.price);
                                    return (
                                      <option key={p.id} value={p.id}>
                                        {isOos ? `[OUT OF STOCK - 0 AVAILABLE] ` : isLow ? `[LOW STOCK: ${p.stock_quantity}] ` : ""}{p.name} {p.sku ? `(${p.sku})` : ""} &bull; ₹{p.price.toLocaleString("en-IN")}{disc.hasDiscount ? ` (MRP: ₹${disc.mrp.toLocaleString("en-IN")} • ${disc.discountPercent}% OFF • Save ₹${disc.discountAmount})` : ""} (Stock: {p.stock_quantity})
                                      </option>
                                    );
                                  })}
                                </optgroup>
                                <optgroup label="Other">
                                  <option value="custom">+ Custom / Manual Product</option>
                                </optgroup>
                              </select>

                              {/* Discount highlight badge when a discounted product is selected */}
                              {(() => {
                                if (item.product_id) {
                                  const selectedProd = products.find((p) => p.id === item.product_id);
                                  if (selectedProd) {
                                    const disc = getDiscountInfo(selectedProd.mrp, selectedProd.price);
                                    if (disc.hasDiscount) {
                                      return (
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold w-fit">
                                          <Tag className="w-3 h-3 text-emerald-600 shrink-0" />
                                          <span>Discount: Save {formatCurrency(disc.discountAmount)} per unit ({disc.discountPercent}% OFF from MRP {formatCurrency(disc.mrp)})</span>
                                        </div>
                                      );
                                    }
                                  }
                                }
                                return null;
                              })()}

                              {/* If Custom Product, allow text editing */}
                              {item.product_id === null && (
                                <input
                                  type="text"
                                  placeholder="Enter custom product name..."
                                  value={item.product_name}
                                  onChange={(e) => handleItemChange(index, "product_name", e.target.value)}
                                  className="w-full text-xs px-2.5 py-1 bg-white border border-slate-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-slate-900"
                                />
                              )}

                              {/* Stock status indicator badge */}
                              <div className="flex items-center gap-2 text-[10px]">
                                {item.max_stock !== null ? (
                                  <span
                                    className={`font-semibold ${
                                      isOutOfStock
                                        ? "text-rose-600 font-bold"
                                        : isLowOrExceeded
                                        ? "text-rose-600"
                                        : "text-slate-500"
                                    }`}
                                  >
                                    Available Stock: {item.max_stock} units
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">Custom product</span>
                                )}
                                {isLowOrExceeded && (
                                  <span className="text-rose-600 font-bold">
                                    &bull; Exceeds Stock!
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Quantity */}
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              min="1"
                              max={item.max_stock !== null ? item.max_stock : undefined}
                              value={item.quantity}
                              onChange={(e) =>
                                handleItemChange(index, "quantity", parseInt(e.target.value, 10) || 0)
                              }
                              className={`w-full text-xs px-2.5 py-1.5 border rounded-lg focus:outline-hidden font-semibold text-center ${
                                isLowOrExceeded
                                  ? "border-rose-400 bg-rose-50 text-rose-700 focus:ring-rose-500"
                                  : "border-slate-300 bg-white text-slate-900 focus:ring-blue-500"
                              }`}
                            />
                          </td>

                          {/* Unit Price */}
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) =>
                                handleItemChange(index, "unit_price", parseFloat(e.target.value) || 0)
                              }
                              className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono text-slate-900 text-right"
                            />
                          </td>

                          {/* Discount */}
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.discount}
                              onChange={(e) =>
                                handleItemChange(index, "discount", parseFloat(e.target.value) || 0)
                              }
                              className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono text-slate-900 text-right"
                            />
                          </td>

                          {/* GST Rate */}
                          <td className="py-2.5 px-3">
                            <select
                              value={item.tax_rate}
                              onChange={(e) =>
                                handleItemChange(index, "tax_rate", parseFloat(e.target.value) || 0)
                              }
                              className="w-full text-xs px-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-slate-900"
                            >
                              <option value="0">0%</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                            </select>
                          </td>

                          {/* Line Total */}
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                            {formatCurrency(lineCalc?.total || 0)}
                          </td>

                          {/* Remove Row */}
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => removeItemRow(index)}
                              disabled={items.length <= 1}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                items.length <= 1
                                  ? "text-slate-300 cursor-not-allowed"
                                  : "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              }`}
                              title="Delete Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section 3: Summary Totals & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Payment Status & Notes */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Status
                </label>
                <div className="flex items-center gap-3">
                  {["Paid", "Pending", "Partially Paid"].map((st) => (
                    <label key={st} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="payment_status"
                        value={st}
                        checked={paymentStatus === st}
                        onChange={(e) => setPaymentStatus(e.target.value)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>{st}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Invoice Notes &amp; Terms
                </label>
                <textarea
                  rows={3}
                  placeholder="Optional terms, warranty details, or dispatch note..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900"
                />
              </div>
            </div>

            {/* Calculations Breakdown Card */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Subtotal (Before Tax)</span>
                <span className="font-mono font-semibold text-slate-800">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Discount Applied</span>
                <span className="font-mono text-rose-600 font-semibold">
                  {totalDiscount > 0 ? `- ${formatCurrency(totalDiscount)}` : "₹0.00"}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>GST / Tax Amount</span>
                <span className="font-mono font-semibold text-slate-800">{formatCurrency(totalTax)}</span>
              </div>
              <div className="pt-2 border-t border-slate-300 flex items-center justify-between text-slate-900">
                <span className="text-sm font-bold">Grand Total (INR)</span>
                <span className="text-xl font-black text-blue-700 font-mono">
                  {formatCurrency(grandTotal)}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 text-right">
                * Stock quantities will be automatically deducted upon saving.
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Sale &amp; Updating Stock...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Sale &amp; Issue Invoice</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

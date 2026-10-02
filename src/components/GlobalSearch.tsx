import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  X,
  Package,
  Users,
  Receipt,
  ShoppingBag,
  TrendingDown,
  ArrowRight,
  Sparkles,
  Command,
  Loader2,
  Tag,
  Phone,
  Calendar,
} from "lucide-react";
import { VoiceInputButton } from "./VoiceInputButton";
import { GlobalSearchResults, SidebarTab } from "../types";
import { formatCurrency } from "../utils/formatters";

interface GlobalSearchProps {
  onNavigateTab: (tab: SidebarTab) => void;
  onSelectItem?: (type: "product" | "customer" | "sale" | "purchase" | "expense", item: any) => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ onNavigateTab, onSelectItem }) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<"all" | "products" | "customers" | "sales" | "purchases" | "expenses">("all");
  const [results, setResults] = useState<GlobalSearchResults>({
    products: [],
    customers: [],
    sales: [],
    purchases: [],
    expenses: [],
  });
  const [totalCount, setTotalCount] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<any>(null);

  // Keyboard shortcut: Cmd+K or Ctrl+K opens search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close dropdown when clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch search results from SQLite backend with debounce
  const fetchSearchResults = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setResults({ products: [], customers: [], sales: [], purchases: [], expenses: [] });
      setTotalCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchTerm.trim())}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      if (data.success && data.results) {
        setResults(data.results);
        setTotalCount(data.totalCount || 0);
      }
    } catch (err) {
      console.warn("Global search error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (val: string) => {
    setQuery(val);
    setIsOpen(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSearchResults(val);
    }, 200);
  };

  const handleVoiceTranscript = (transcript: string) => {
    setQuery(transcript);
    setIsOpen(true);
    fetchSearchResults(transcript);
  };

  const handleClear = () => {
    setQuery("");
    setResults({ products: [], customers: [], sales: [], purchases: [], expenses: [] });
    setTotalCount(0);
    inputRef.current?.focus();
  };

  const handleSelectResult = (type: "product" | "customer" | "sale" | "purchase" | "expense", item: any) => {
    setIsOpen(false);
    const tabMap: Record<string, SidebarTab> = {
      product: "inventory",
      customer: "customers",
      sale: "sales",
      purchase: "purchases",
      expense: "expenses",
    };
    const targetTab = tabMap[type] || "dashboard";
    onNavigateTab(targetTab);
    onSelectItem?.(type, item);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg">
      {/* Search Input Bar */}
      <div className="relative flex items-center">
        <div className="absolute left-3 text-slate-400 pointer-events-none">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="Search products, SKU, customers, invoices, expenses..."
          className="w-full pl-9 pr-20 py-2 text-xs sm:text-sm bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-purple-500 rounded-xl transition-all shadow-2xs focus:ring-2 focus:ring-purple-500/20 focus:outline-none"
        />

        {/* Right side buttons: Mic + Clear + Cmd+K badge */}
        <div className="absolute right-2 flex items-center gap-1">
          {query ? (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-200/70 border border-slate-300 text-[10px] font-semibold text-slate-500 select-none">
              <Command className="w-2.5 h-2.5" />
              <span>K</span>
            </div>
          )}

          {/* Voice Input Mic Button */}
          <VoiceInputButton
            size="sm"
            onTranscript={handleVoiceTranscript}
            className="shadow-2xs"
          />
        </div>
      </div>

      {/* Dropdown Results Box */}
      {isOpen && query.trim().length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 max-h-[75vh] flex flex-col">
          {/* Header tabs for category filtering */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/80 flex items-center gap-1 overflow-x-auto text-[11px] no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer whitespace-nowrap ${
                activeCategory === "all"
                  ? "bg-purple-600 text-white shadow-2xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              All ({totalCount})
            </button>

            {results.products.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveCategory("products")}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  activeCategory === "products"
                    ? "bg-purple-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                Products ({results.products.length})
              </button>
            )}

            {results.customers.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveCategory("customers")}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  activeCategory === "customers"
                    ? "bg-purple-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                Customers ({results.customers.length})
              </button>
            )}

            {results.sales.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveCategory("sales")}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  activeCategory === "sales"
                    ? "bg-purple-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                Invoices/Sales ({results.sales.length})
              </button>
            )}

            {results.purchases.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveCategory("purchases")}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  activeCategory === "purchases"
                    ? "bg-purple-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                Purchases ({results.purchases.length})
              </button>
            )}

            {results.expenses.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveCategory("expenses")}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  activeCategory === "expenses"
                    ? "bg-purple-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                Expenses ({results.expenses.length})
              </button>
            )}
          </div>

          {/* Results List */}
          <div className="overflow-y-auto p-2 space-y-3 divide-y divide-slate-100">
            {/* Empty State: No results found */}
            {!loading && totalCount === 0 && (
              <div className="py-8 text-center px-4 space-y-2">
                <Search className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">No results found for "{query}"</p>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Try searching by product name, SKU, brand, customer phone, invoice number (e.g. INV-2026-0001), or expense category.
                </p>
              </div>
            )}

            {/* 1. Products Section */}
            {(activeCategory === "all" || activeCategory === "products") && results.products.length > 0 && (
              <div className="pt-2 first:pt-0">
                <div className="px-2 pb-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-blue-500" />
                  <span>Products ({results.products.length})</span>
                </div>
                <div className="space-y-1">
                  {results.products.map((p) => (
                    <button
                      key={`prod-${p.id}`}
                      type="button"
                      onClick={() => handleSelectResult("product", p)}
                      className="w-full text-left p-2 rounded-xl hover:bg-blue-50/70 border border-transparent hover:border-blue-200 transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            {p.name}
                          </span>
                          {p.brand && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 font-semibold border border-purple-200 shrink-0">
                              {p.brand}
                            </span>
                          )}
                          {p.sku && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-mono text-slate-600 shrink-0">
                              {p.sku}
                            </span>
                          )}
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-500 shrink-0">
                            {p.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                          <span>Stock: <strong className={p.stock_quantity <= p.min_stock_level ? "text-amber-600" : "text-emerald-600"}>{p.stock_quantity}</strong></span>
                          {p.mrp && p.mrp > p.price ? (
                            <>
                              <span className="line-through text-slate-400 font-mono">MRP: ₹{p.mrp.toLocaleString('en-IN')}</span>
                              <span className="font-bold text-slate-800 font-mono">₹{p.price.toLocaleString('en-IN')}</span>
                              <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-extrabold text-[10px] border border-emerald-200">
                                {Math.round(((p.mrp - p.price) / p.mrp) * 1000) / 10}% OFF (Save ₹{Math.round((p.mrp - p.price) * 100) / 100})
                              </span>
                            </>
                          ) : (
                            <span className="font-bold text-slate-800 font-mono">₹{p.price.toLocaleString('en-IN')}</span>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Customers Section */}
            {(activeCategory === "all" || activeCategory === "customers") && results.customers.length > 0 && (
              <div className="pt-2">
                <div className="px-2 pb-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-purple-500" />
                  <span>Customers ({results.customers.length})</span>
                </div>
                <div className="space-y-1">
                  {results.customers.map((c) => (
                    <button
                      key={`cust-${c.id}`}
                      type="button"
                      onClick={() => handleSelectResult("customer", c)}
                      className="w-full text-left p-2 rounded-xl hover:bg-purple-50/70 border border-transparent hover:border-purple-200 transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            {c.name}
                          </span>
                          <span className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {c.phone}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                          <span>Total Spent: <strong className="text-slate-800">₹{(c.total_purchases || 0).toLocaleString('en-IN')}</strong></span>
                          {c.pending_amount && c.pending_amount > 0 ? (
                            <span className="text-amber-600 font-medium">Pending: ₹{c.pending_amount.toLocaleString('en-IN')}</span>
                          ) : null}
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Sales & Invoices Section */}
            {(activeCategory === "all" || activeCategory === "sales") && results.sales.length > 0 && (
              <div className="pt-2">
                <div className="px-2 pb-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Sales & Invoices ({results.sales.length})</span>
                </div>
                <div className="space-y-1">
                  {results.sales.map((s) => (
                    <button
                      key={`sale-${s.id}`}
                      type="button"
                      onClick={() => handleSelectResult("sale", s)}
                      className="w-full text-left p-2 rounded-xl hover:bg-emerald-50/70 border border-transparent hover:border-emerald-200 transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            {s.invoice_no}
                          </span>
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {s.customer_name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 shrink-0">
                            {s.payment_status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                          <span>Amount: <strong className="text-slate-800">₹{(s.total_amount || 0).toLocaleString('en-IN')}</strong></span>
                          <span>Method: {s.payment_method}</span>
                          <span className="flex items-center gap-1 text-slate-400">
                            <Calendar className="w-3 h-3" />
                            {s.sale_date}
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Purchases Section */}
            {(activeCategory === "all" || activeCategory === "purchases") && results.purchases.length > 0 && (
              <div className="pt-2">
                <div className="px-2 pb-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Purchases ({results.purchases.length})</span>
                </div>
                <div className="space-y-1">
                  {results.purchases.map((pr) => (
                    <button
                      key={`pur-${pr.id}`}
                      type="button"
                      onClick={() => handleSelectResult("purchase", pr)}
                      className="w-full text-left p-2 rounded-xl hover:bg-indigo-50/70 border border-transparent hover:border-indigo-200 transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                            {pr.invoice_no}
                          </span>
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {pr.supplier_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                          <span>Item: {pr.product_name}</span>
                          <span>Total Cost: <strong className="text-slate-800">₹{(pr.total_cost || 0).toLocaleString('en-IN')}</strong></span>
                          <span>{pr.purchase_date}</span>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Expenses Section */}
            {(activeCategory === "all" || activeCategory === "expenses") && results.expenses.length > 0 && (
              <div className="pt-2">
                <div className="px-2 pb-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                  <span>Expenses ({results.expenses.length})</span>
                </div>
                <div className="space-y-1">
                  {results.expenses.map((e) => (
                    <button
                      key={`exp-${e.id}`}
                      type="button"
                      onClick={() => handleSelectResult("expense", e)}
                      className="w-full text-left p-2 rounded-xl hover:bg-rose-50/70 border border-transparent hover:border-rose-200 transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {e.title}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-semibold">
                            {e.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                          <span>Amount: <strong className="text-rose-600">₹{(e.amount || 0).toLocaleString('en-IN')}</strong></span>
                          <span>Method: {e.payment_method}</span>
                          <span>{e.expense_date}</span>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-rose-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer info bar */}
          <div className="p-2 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-400 flex items-center justify-between px-3">
            <span>Press Esc to close • Click any result to navigate</span>
            <span>{totalCount} total records found</span>
          </div>
        </div>
      )}
    </div>
  );
};

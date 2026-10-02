import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Send,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Package,
  Receipt,
  CheckCircle2,
  Copy,
  Check,
  Bot,
  User,
  ArrowRight,
  Database,
  Lightbulb,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  BarChart3,
  Building2,
  Trash2,
} from "lucide-react";
import { AIChatMessage, AIBusinessInsights, SidebarTab } from "../types";
import { formatCurrency } from "../utils/formatters";
import { VoiceInputButton } from "./VoiceInputButton";

interface AIAssistantViewProps {
  onNavigateTab: (tab: SidebarTab) => void;
}

export const AIAssistantView: React.FC<AIAssistantViewProps> = ({ onNavigateTab }) => {
  const [messages, setMessages] = useState<AIChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem("sbm_ai_chat_history");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: "welcome-1",
        role: "assistant",
        content: `👋 Hello! I am your **AI Business Assistant** powered by **Gemini 3.8 Flash** and synchronized directly with your live SQLite database.\n\nI continuously monitor your **sales, profit/loss, inventory levels, expenses, and customers** to provide answers and actionable business recommendations in simple, straightforward language.\n\nHow can I help you optimize your business today? Choose from the quick questions below or type any custom query!`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        category: "general",
        suggestedFollowUps: [
          "Summarize my business financial health and profit margins",
          "Which products need urgent restocking?",
          "Show any unusual or high expenses that need review",
          "How can I increase our average order value?",
          "Who are our top spending customers?",
        ],
      },
    ];
  });

  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<AIBusinessInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showLiveFeed, setShowLiveFeed] = useState(false);
  const [activeInsightTab, setActiveInsightTab] = useState<"overview" | "inventory" | "expenses" | "growth">("overview");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Persist chat messages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("sbm_ai_chat_history", JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // Fetch proactive insights from backend
  const fetchInsights = async () => {
    setInsightsLoading(true);
    try {
      const res = await fetch("/api/ai-assistant/insights");
      if (!res.ok) throw new Error("Failed to load AI insights");
      const data = await res.json();
      if (data.success && data.insights) {
        setInsights(data.insights);
      }
    } catch (err) {
      console.warn("Could not load AI insights:", err);
    } finally {
      setInsightsLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  // Send message to server-side AI endpoint
  const handleSendMessage = async (textToSend?: string) => {
    const rawText = typeof textToSend === "string" ? textToSend : inputMessage;
    const userMessage = rawText ? rawText.trim() : "";
    if (!userMessage || loading) return;

    const userMsg: AIChatMessage = {
      id: `usr-${Date.now()}`,
      role: "user",
      content: userMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setLoading(true);

    try {
      // Build conversation history for context (last 6 messages)
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/ai-assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          userMessage: userMessage,
          history: historyPayload,
        }),
      });

      const data = await res.json().catch(() => ({ success: false, error: "Unable to parse server response." }));

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to get AI response.");
      }

      const assistantMsg: AIChatMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: data.reply || "I have analyzed your business records, but no output was generated.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        category: "suggestions",
        isLiveAi: data.isLiveAi,
        suggestedFollowUps: [
          "Can you suggest a concrete action plan for this?",
          "How does this compare with our overall profit margin?",
          "What inventory or stock adjustments should I make?",
        ],
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error("AI Assistant error:", err);
      const errorMsg: AIChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `⚠️ **Unable to complete request:** ${err.message || "Connection issue"}.\n\nPlease try again or ask another business question.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        category: "general",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      // Refocus input
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleClearChat = () => {
    const resetMessages: AIChatMessage[] = [
      {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        content: `👋 Chat cleared! I am ready for your next question regarding sales, expenses, inventory, profits, customers, suppliers, or business strategy.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        category: "general",
        suggestedFollowUps: [
          "Summarize my business financial health and profit margins",
          "Which products need urgent restocking?",
          "Show any unusual or high expenses that need review",
          "Who are our top suppliers and recent purchase orders?",
        ],
      },
    ];
    setMessages(resetMessages);
    try {
      localStorage.removeItem("sbm_ai_chat_history");
    } catch {}
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to format text with bolding and markdown headers cleanly
  const renderFormattedContent = (content: string) => {
    const lines = content.split("\n");
    return (
      <div className="space-y-2 text-xs leading-relaxed text-slate-800">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <div key={idx} className="h-1.5" />;
          }

          // Markdown headers
          if (trimmed.startsWith("### ")) {
            return (
              <h4 key={idx} className="font-bold text-sm text-slate-900 pt-1 pb-0.5 border-b border-slate-100 flex items-center gap-1.5">
                {trimmed.replace("### ", "")}
              </h4>
            );
          }
          if (trimmed.startsWith("## ")) {
            return (
              <h3 key={idx} className="font-bold text-sm text-blue-900 pt-1.5 pb-0.5">
                {trimmed.replace("## ", "")}
              </h3>
            );
          }

          // Bullet points
          if (trimmed.startsWith("• ") || trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            const bulletText = trimmed.replace(/^[•\-*]\s+/, "");
            return (
              <div key={idx} className="flex items-start gap-2 pl-1">
                <span className="text-blue-500 font-bold mt-0.5">•</span>
                <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(bulletText) }} />
              </div>
            );
          }

          // Numbered lists
          const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
          if (numMatch) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-1">
                <span className="font-bold text-blue-600 min-w-[18px]">{numMatch[1]}.</span>
                <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(numMatch[2]) }} />
              </div>
            );
          }

          return (
            <p key={idx} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(line) }} />
          );
        })}
      </div>
    );
  };

  // Basic inline markdown (bolding, backticks, emojis)
  const formatInlineMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong class='font-semibold text-slate-900'>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em class='text-slate-700'>$1</em>")
      .replace(/`([^`]+)`/g, "<code class='bg-slate-100 text-blue-700 px-1 py-0.5 rounded text-[11px] font-mono'>$1</code>");
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-5 sm:p-6 text-white shadow-sm border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-semibold border border-purple-500/30">
              <Sparkles className="w-3.5 h-3.5 text-purple-300" />
              <span>AI Business Executive &amp; Operations Intelligence</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <span>Smart AI Business Assistant</span>
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-normal">
              Directly connected to your live SQLite database records. Ask questions in simple language to get instant sales, profit/loss, inventory reorders, and expense anomaly insights.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowLiveFeed(!showLiveFeed)}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-blue-400" />
              <span>{showLiveFeed ? "Hide Live Feed" : "View Live DB Metrics"}</span>
            </button>
            <button
              onClick={fetchInsights}
              disabled={insightsLoading}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${insightsLoading ? "animate-spin" : ""}`} />
              <span>Refresh Insights</span>
            </button>
          </div>
        </div>

        {/* Live Context Quick Ticker */}
        {insights?.overview && (
          <div className="mt-5 pt-4 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50">
              <div className="text-[10px] text-slate-400 font-medium">Gross Revenue</div>
              <div className="text-sm font-bold text-white mt-0.5">
                {formatCurrency(insights.overview.totalSales)}
              </div>
              <div className="text-[10px] text-slate-400">{insights.overview.totalOrders} Orders</div>
            </div>

            <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50">
              <div className="text-[10px] text-slate-400 font-medium">Net Profit</div>
              <div className={`text-sm font-bold mt-0.5 ${insights.overview.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {formatCurrency(insights.overview.netProfit)}
              </div>
              <div className="text-[10px] text-slate-400">{insights.overview.profitMargin}% Margin</div>
            </div>

            <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50">
              <div className="text-[10px] text-slate-400 font-medium">Inventory Value</div>
              <div className="text-sm font-bold text-blue-400 mt-0.5">
                {formatCurrency(insights.overview.inventoryValue)}
              </div>
              <div className="text-[10px] text-slate-400">In Active Catalog</div>
            </div>

            <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50">
              <div className="text-[10px] text-slate-400 font-medium">Stock Watch</div>
              <div className="text-sm font-bold text-amber-400 mt-0.5">
                {insights.inventoryAlerts.reorderSuggestedCount} Items
              </div>
              <div className="text-[10px] text-slate-400">
                {insights.inventoryAlerts.outOfStockCount > 0
                  ? `${insights.inventoryAlerts.outOfStockCount} Out of Stock`
                  : "All in stock"}
              </div>
            </div>

            <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50">
              <div className="text-[10px] text-slate-400 font-medium">Total Expenses</div>
              <div className="text-sm font-bold text-rose-300 mt-0.5">
                {formatCurrency(insights.overview.totalExpenses)}
              </div>
              <div className="text-[10px] text-slate-400">{insights.expenseWatchdog.unusualCount} Flagged</div>
            </div>

            <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50">
              <div className="text-[10px] text-slate-400 font-medium">Health Rating</div>
              <div className="text-sm font-bold text-purple-300 mt-0.5 flex items-center gap-1.5">
                <span>{insights.healthScore}/100</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/30 text-purple-200">
                  {insights.healthRating}
                </span>
              </div>
              <div className="text-[10px] text-slate-400">Database Grounded</div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Optional Live Database Feed Inspector */}
      {showLiveFeed && insights && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Real-Time SQLite Data Feed Inspected by AI
              </h3>
            </div>
            <button
              onClick={() => setShowLiveFeed(false)}
              className="text-xs text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <div className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                <span>Sales &amp; Collections</span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Total Sales:</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(insights.overview.totalSales)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Settled / Paid:</span>
                  <span className="font-semibold text-emerald-600">{formatCurrency(insights.overview.paidRevenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pending Receivables:</span>
                  <span className="font-semibold text-amber-600">{formatCurrency(insights.overview.pendingRevenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Average Order Value:</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(insights.overview.avgOrderValue)}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <div className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-amber-600" />
                <span>Inventory &amp; Stock</span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Catalog Products:</span>
                  <span className="font-semibold text-slate-900">{insights.overview.totalProducts ?? 10} Items</span>
                </div>
                <div className="flex justify-between">
                  <span>Out of Stock:</span>
                  <span className={`font-semibold ${insights.inventoryAlerts.outOfStockCount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    {insights.inventoryAlerts.outOfStockCount} items
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Low Stock Warnings:</span>
                  <span className="font-semibold text-amber-600">{insights.inventoryAlerts.lowStockCount} items</span>
                </div>
                <div className="flex justify-between">
                  <span>Stock Valuation:</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(insights.overview.inventoryValue)}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <div className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-2">
                <Receipt className="w-3.5 h-3.5 text-purple-600" />
                <span>Profit &amp; Overhead</span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Cost of Goods (COGS):</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(insights.overview.totalCogs)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Operating Expenses:</span>
                  <span className="font-semibold text-rose-600">{formatCurrency(insights.overview.totalExpenses)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Net Profit:</span>
                  <span className="font-semibold text-emerald-600">{formatCurrency(insights.overview.netProfit)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Net Margin:</span>
                  <span className="font-semibold text-purple-600">{insights.overview.profitMargin}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Proactive Insights Tab & Quick Action Strip */}
      {insights && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold text-slate-900">
                Proactive AI Business Insights &amp; Suggestions
              </h2>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveInsightTab("overview")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeInsightTab === "overview"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                P&amp;L &amp; Health
              </button>
              <button
                onClick={() => setActiveInsightTab("inventory")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeInsightTab === "inventory"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Stock Watch ({insights.inventoryAlerts.reorderSuggestedCount})
              </button>
              <button
                onClick={() => setActiveInsightTab("expenses")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeInsightTab === "expenses"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Expense Watchdog
              </button>
              <button
                onClick={() => setActiveInsightTab("growth")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeInsightTab === "growth"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Growth Advice
              </button>
            </div>
          </div>

          {/* TAB 1: P&L & Health */}
          {activeInsightTab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Financial Profitability Health</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    insights.overview.profitMargin >= 15
                      ? "bg-emerald-100 text-emerald-700"
                      : insights.overview.profitMargin > 0
                      ? "bg-blue-100 text-blue-700"
                      : "bg-rose-100 text-rose-700"
                  }`}>
                    {insights.overview.profitMargin >= 15
                      ? "Strong Margin"
                      : insights.overview.profitMargin > 0
                      ? "Moderate Margin"
                      : "Operating Deficit"}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Your business generated **{formatCurrency(insights.overview.totalSales)}** in gross sales across **{insights.overview.totalOrders} customer orders**, yielding **{formatCurrency(insights.overview.netProfit)}** in net profit after factoring **{formatCurrency(insights.overview.totalCogs)}** for inventory costs and **{formatCurrency(insights.overview.totalExpenses)}** in operating expenses.
                </p>
                <div className="pt-2 flex items-center gap-2">
                  <button
                    onClick={() => handleSendMessage("Give me a deep dive into our profit margins and cost of goods sold")}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    <span>Ask AI for Profit Breakdown</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={() => onNavigateTab("analytics")}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    <span>Open Analytics &amp; P&amp;L</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Top Revenue Driver</span>
                  <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                    Leading Item
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  **{insights.salesHighlights.topProduct}** is currently your top-performing product with **{formatCurrency(insights.salesHighlights.topProductRevenue)}** in sales. Ensure vendor suppliers maintain adequate intake inventory.
                </p>
                <div className="pt-2 flex items-center gap-2">
                  <button
                    onClick={() => handleSendMessage(`How can I sell more ${insights.salesHighlights.topProduct} or bundle it with accessories?`)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    <span>Ask AI for Bundling Strategies</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Stock Watch */}
          {activeInsightTab === "inventory" && (
            <div className="space-y-3 pt-1">
              {insights.inventoryAlerts.criticalItems.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {insights.inventoryAlerts.criticalItems.map((prod) => (
                    <div
                      key={prod.id}
                      className={`p-3.5 rounded-xl border ${
                        prod.stock <= 0
                          ? "bg-rose-50/70 border-rose-200"
                          : "bg-amber-50/70 border-amber-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          prod.stock <= 0 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                        }`}>
                          {prod.stock <= 0 ? "Out of Stock" : "Low Stock"}
                        </span>
                        <span className="text-xs font-semibold text-slate-600">
                          {prod.stock} / {prod.min_stock} min
                        </span>
                      </div>
                      <div className="font-bold text-xs text-slate-900 mt-2 truncate">{prod.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Selling: {formatCurrency(prod.price)} | Cost: {formatCurrency(prod.cost)}
                      </div>
                      <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                        <button
                          onClick={() => handleSendMessage(`What is the recommended reorder quantity and supplier for ${prod.name}?`)}
                          className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                        >
                          Ask Restock Advice
                        </button>
                        <button
                          onClick={() => onNavigateTab("purchases")}
                          className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                        >
                          Order Stock →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>All products are adequately stocked above their minimum inventory levels.</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Expense Watchdog */}
          {activeInsightTab === "expenses" && (
            <div className="space-y-3 pt-1">
              {insights.expenseWatchdog.unusualList.length > 0 ? (
                <div className="space-y-2">
                  {insights.expenseWatchdog.unusualList.map((exp) => (
                    <div
                      key={exp.id}
                      className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-slate-900">{exp.title}</span>
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-200 text-slate-700">
                            {exp.category}
                          </span>
                        </div>
                        <div className="text-[11px] text-amber-700 font-medium">
                          ⚠️ {exp.reason}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-bold text-xs text-slate-900">{formatCurrency(exp.amount)}</div>
                          <div className="text-[10px] text-slate-400">{exp.date}</div>
                        </div>
                        <button
                          onClick={() => handleSendMessage(`Analyze the expense "${exp.title}" of ${formatCurrency(exp.amount)} in category ${exp.category}. Is it justified and how can we optimize it?`)}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer"
                        >
                          Analyze Spend
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>No unusual single expense spikes detected. Operating expenses are consistent.</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Strategic Growth Suggestions */}
          {activeInsightTab === "growth" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {insights.recommendations.map((rec, i) => (
                <div key={i} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 flex flex-col justify-between">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-xs text-slate-700 leading-normal">{rec}</p>
                  </div>
                  <div className="pt-2 border-t border-slate-200/60 flex justify-end">
                    <button
                      onClick={() => handleSendMessage(`Tell me more about recommendation #${i + 1}: "${rec}". Give me specific execution steps.`)}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                    >
                      <span>Get Step-by-Step Plan</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. Main Chat Interface */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col h-[650px] overflow-hidden">
        {/* Chat Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-2">
                <span>AI Business Advisor Chat</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-2">
                <span>Reading live SQLite database</span>
                <span>•</span>
                <span className="text-purple-600 font-medium">Gemini 3.8 Flash</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClearChat}
              title="Clear chat history"
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 bg-slate-50/30">
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white shadow-xs ${
                    isUser ? "bg-blue-600" : "bg-purple-600"
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                </div>

                {/* Content Bubble */}
                <div
                  className={`relative group rounded-2xl px-4 py-3 shadow-xs border ${
                    isUser
                      ? "bg-blue-600 text-white border-blue-600 rounded-tr-none"
                      : "bg-white text-slate-800 border-slate-200 rounded-tl-none"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        isUser ? "text-blue-100" : "text-purple-600"
                      }`}
                    >
                      {isUser ? "You" : "AI Business Assistant"}
                    </span>
                    <span
                      className={`text-[10px] ${
                        isUser ? "text-blue-200" : "text-slate-400"
                      }`}
                    >
                      {msg.timestamp}
                    </span>
                  </div>

                  {/* Body text */}
                  {isUser ? (
                    <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  ) : (
                    <div>{renderFormattedContent(msg.content)}</div>
                  )}

                  {/* Copy Button for Assistant responses */}
                  {!isUser && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <ShieldCheck className="w-3 h-3 text-emerald-500" />
                        <span>Validated against database records</span>
                      </div>
                      <button
                        onClick={() => handleCopyText(msg.id, msg.content)}
                        className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-600 font-medium">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Suggested follow-up buttons if present */}
                  {!isUser && msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Suggested Follow-Up:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.suggestedFollowUps.map((promptText, pIdx) => (
                          <button
                            key={pIdx}
                            onClick={() => handleSendMessage(promptText)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-700 border border-slate-200 transition-colors cursor-pointer text-left"
                          >
                            <span>{promptText}</span>
                            <ChevronRight className="w-3 h-3 shrink-0 opacity-60" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {loading && (
            <div className="flex gap-3 max-w-xl mr-auto">
              <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-white rounded-2xl rounded-tl-none px-4 py-3 border border-slate-200 shadow-xs flex items-center gap-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  AI Business Assistant is querying live SQLite records...
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompt Carousel */}
        <div className="px-4 py-2 border-t border-slate-100 bg-white flex items-center gap-2 overflow-x-auto text-xs no-scrollbar">
          <span className="text-[10px] font-bold uppercase text-slate-400 shrink-0">Quick Ask:</span>
          {[
            "What alerts do I have right now?",
            "Which products are selling fast?",
            "Are any products out of stock?",
            "मेरे active alerts क्या हैं?",
            "Summarize our net profit & margin",
            "Which items need restocking?",
            "Any unusual expenses?",
            "Who are our top suppliers and purchases?",
            "Who are our top customers?",
            "What is our inventory value?",
          ].map((prompt, pIdx) => (
            <button
              key={pIdx}
              onClick={() => handleSendMessage(prompt)}
              className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-purple-100 hover:text-purple-800 text-slate-600 text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer border border-slate-200/60"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Chat Input Bar */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!inputMessage.trim() || loading) return;
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1 flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (inputMessage.trim() && !loading) {
                      handleSendMessage();
                    }
                  }
                }}
                placeholder="Ask anything about sales, expenses, inventory, profits, or business suggestions..."
                disabled={loading}
                className="w-full text-xs sm:text-sm pl-4 pr-16 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
              />
              <div className="absolute right-2 flex items-center gap-1">
                <VoiceInputButton
                  size="sm"
                  onTranscript={(text) => {
                    setInputMessage((prev) => (prev ? `${prev} ${text}` : text));
                  }}
                  disabled={loading}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={!inputMessage.trim() || loading}
              className="inline-flex items-center justify-center min-w-[85px] gap-1.5 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Thinking...</span>
                </>
              ) : (
                <>
                  <span>Send</span>
                  <Send className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span>Server-side AI handling with secure @google/genai integration. Never exposes API keys.</span>
            <span>Press Enter to send</span>
          </div>
        </div>
      </div>
    </div>
  );
};

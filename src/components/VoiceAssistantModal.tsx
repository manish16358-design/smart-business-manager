import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Package,
  Receipt,
  DollarSign,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { SidebarTab } from "../types";
import { formatCurrency } from "../utils/formatters";

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: SidebarTab) => void;
  onRefreshData?: () => void;
  onOpenAlerts?: () => void;
}

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onRefreshData,
  onOpenAlerts,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [language, setLanguage] = useState<"en-IN" | "hi-IN">("en-IN");
  const [confirmationPending, setConfirmationPending] = useState<any>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      setTranscript("");
      setResponse(null);
      setConfirmationPending(null);
      setActionSuccess(null);
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    } else {
      // Auto start listening when modal opens
      startListening();
    }
  }, [isOpen]);

  const speakText = (text: string) => {
    if (!ttsEnabled || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === "hi-IN" ? "hi-IN" : "en-IN";
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("Speech synthesis error:", err);
    }
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setResponse({
        textResponse: "Speech recognition is not supported in this browser. Please use Google Chrome or Edge.",
      });
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = language;

      recognition.onstart = () => {
        setIsListening(true);
        setTranscript("");
        setResponse(null);
        setConfirmationPending(null);
        setActionSuccess(null);
      };

      recognition.onresult = (event: any) => {
        const spoken = event.results[0][0].transcript;
        if (spoken) {
          setTranscript(spoken);
          processVoiceCommand(spoken);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Voice assistant recognition error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Speech recognition start failed:", err);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const processVoiceCommand = async (commandText: string) => {
    setProcessing(true);
    try {
      const res = await fetch("/api/voice/process-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: commandText }),
      });
      const data = await res.json();
      if (data.success) {
        setResponse(data);
        if (data.spokenResponse) {
          speakText(data.spokenResponse);
        }

        // If it requires user confirmation before mutation (Safe Confirmation)
        if (data.requiresConfirmation && data.draftData) {
          setConfirmationPending(data);
        }
      } else {
        setResponse({ textResponse: data.error || "Could not understand the command." });
      }
    } catch (err: any) {
      console.error("Voice process error:", err);
      setResponse({ textResponse: "Failed to connect to the business assistant." });
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmationPending) return;
    setProcessing(true);
    try {
      const { draftType, draftData } = confirmationPending;
      if (draftType === "sale") {
        const res = await fetch("/api/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_name: draftData.customer_name || "Walk-in Customer",
            items: [
              {
                product_id: draftData.product_id,
                product_name: draftData.product_name,
                quantity: draftData.quantity,
                unit_price: draftData.unit_price,
                discount: 0,
                tax_rate: 0,
                total_price: draftData.quantity * draftData.unit_price,
              },
            ],
            subtotal: draftData.quantity * draftData.unit_price,
            discount: 0,
            tax_amount: 0,
            total_amount: draftData.quantity * draftData.unit_price,
            payment_method: draftData.payment_method || "Cash",
            payment_status: "Paid",
            sale_date: new Date().toISOString().split("T")[0],
          }),
        });
        const resData = await res.json();
        if (resData.success) {
          setActionSuccess(`Sale of ${draftData.quantity}x ${draftData.product_name} recorded successfully!`);
          speakText("Sale recorded and inventory updated.");
          onRefreshData?.();
        } else {
          alert(resData.error || "Failed to record sale.");
        }
      } else if (draftType === "expense") {
        const res = await fetch("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: draftData.title,
            category: draftData.category,
            amount: draftData.amount,
            payment_method: draftData.payment_method || "Cash",
            expense_date: draftData.expense_date || new Date().toISOString().split("T")[0],
          }),
        });
        const resData = await res.json();
        if (resData.success) {
          setActionSuccess(`Expense of ₹${draftData.amount} for ${draftData.category} logged successfully!`);
          speakText("Expense logged successfully.");
          onRefreshData?.();
        } else {
          alert(resData.error || "Failed to log expense.");
        }
      }
      setConfirmationPending(null);
    } catch (err: any) {
      alert("Error executing confirmed action: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-purple-50 via-indigo-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-200">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                Voice Business Assistant
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Phase 5 Voice Assistant • Speaks & executes verified operations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Audio Voice Readout Toggle */}
            <button
              type="button"
              onClick={() => {
                setTtsEnabled(!ttsEnabled);
                if (ttsEnabled && "speechSynthesis" in window) {
                  window.speechSynthesis.cancel();
                }
              }}
              title={ttsEnabled ? "Voice Audio Response ON" : "Voice Audio Response OFF"}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                ttsEnabled
                  ? "bg-purple-100 text-purple-700 border-purple-200"
                  : "bg-slate-100 text-slate-400 border-slate-200"
              }`}
            >
              {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Language Switcher */}
            <button
              type="button"
              onClick={() => {
                setLanguage((prev) => (prev === "en-IN" ? "hi-IN" : "en-IN"));
              }}
              className="px-2 py-1 text-xs font-bold rounded-xl bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-800 border border-slate-200 transition-colors cursor-pointer"
            >
              {language === "hi-IN" ? "हिंदी (HI)" : "English (IN)"}
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col items-center justify-center overflow-y-auto space-y-6">
          {/* Animated Big Microphone Button */}
          <div className="relative flex items-center justify-center py-4">
            {/* Ripple rings when listening */}
            {isListening && (
              <>
                <div className="absolute w-36 h-36 rounded-full bg-red-400/20 animate-ping pointer-events-none" />
                <div className="absolute w-28 h-28 rounded-full bg-purple-400/30 animate-pulse pointer-events-none" />
              </>
            )}

            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              className={`relative z-10 w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-xl cursor-pointer ${
                isListening
                  ? "bg-gradient-to-tr from-red-500 to-rose-600 text-white shadow-red-200 scale-105 ring-4 ring-red-300"
                  : processing
                  ? "bg-purple-600 text-white animate-spin shadow-purple-200"
                  : "bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-purple-200 hover:scale-105"
              }`}
            >
              {isListening ? (
                <Mic className="w-10 h-10 animate-bounce" />
              ) : processing ? (
                <RotateCcw className="w-10 h-10 animate-spin" />
              ) : (
                <Mic className="w-10 h-10" />
              )}
            </button>
          </div>

          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-slate-800">
              {isListening
                ? language === "hi-IN"
                  ? "सुन रहा हूँ... बोलिए (Listening in Hindi)"
                  : "Listening... Speak your command now"
                : processing
                ? "Processing your voice command..."
                : "Click microphone to speak"}
            </p>
            <p className="text-xs text-slate-500">
              Check sales, check inventory, profit, log expense, or ask any business question
            </p>
          </div>

          {/* Transcript Display */}
          {transcript && (
            <div className="w-full bg-purple-50/70 border border-purple-200/80 rounded-2xl p-3.5 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 block mb-1">
                You Spoke:
              </span>
              <p className="text-sm font-semibold text-slate-900 italic">
                "{transcript}"
              </p>
            </div>
          )}

          {/* Assistant Spoken / Text Response */}
          {response && (
            <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Assistant Response:</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                {response.textResponse || response.spokenResponse}
              </p>

              {response.action?.type === "navigate" && (
                <button
                  type="button"
                  onClick={() => {
                    onNavigateTab(response.action.tab);
                    onClose();
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  <span>Go to {response.action.tab.toUpperCase()}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {response.action?.type === "open_alerts" && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenAlerts?.();
                    onClose();
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Open Active Alerts</span>
                </button>
              )}
            </div>
          )}

          {/* Safe Confirmation Card for Mutations (Requirement: Clear confirmation before data-changing actions) */}
          {confirmationPending && (
            <div className="w-full bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-left space-y-3 shadow-md animate-in zoom-in-95">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <span>Confirmation Required Before Saving</span>
              </div>
              <p className="text-xs text-amber-900 font-medium">
                {confirmationPending.prompt}
              </p>
              <div className="bg-white/80 p-3 rounded-xl border border-amber-200 text-xs space-y-1">
                {confirmationPending.draftType === "sale" ? (
                  <>
                    <div><span className="font-semibold text-slate-600">Product:</span> {confirmationPending.draftData.product_name}</div>
                    <div><span className="font-semibold text-slate-600">Quantity:</span> {confirmationPending.draftData.quantity} units</div>
                    <div><span className="font-semibold text-slate-600">Price:</span> ₹{confirmationPending.draftData.unit_price} each</div>
                    <div><span className="font-semibold text-slate-600">Total:</span> ₹{(confirmationPending.draftData.quantity * confirmationPending.draftData.unit_price).toLocaleString('en-IN')}</div>
                  </>
                ) : (
                  <>
                    <div><span className="font-semibold text-slate-600">Category:</span> {confirmationPending.draftData.category}</div>
                    <div><span className="font-semibold text-slate-600">Amount:</span> ₹{confirmationPending.draftData.amount}</div>
                    <div><span className="font-semibold text-slate-600">Description:</span> {confirmationPending.draftData.title}</div>
                  </>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmationPending(null)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={processing}
                  onClick={handleConfirmAction}
                  className="px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirm & Save</span>
                </button>
              </div>
            </div>
          )}

          {/* Action Success Toast */}
          {actionSuccess && (
            <div className="w-full bg-emerald-50 border border-emerald-300 rounded-2xl p-3 flex items-center gap-2.5 text-emerald-800 text-xs font-bold animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* Quick Voice Suggestions Carousel */}
          <div className="w-full space-y-2 pt-2 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block text-center">
              Or Try Saying:
            </span>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {[
                "Check today's sales",
                "What is our net profit?",
                "Check stock of Ergonomic Office Chair",
                "Show low stock products",
                "Check active alerts",
                "Log expense 500 for tea",
                "Record sale of 1 Office Chair",
              ].map((cmd, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setTranscript(cmd);
                    processVoiceCommand(cmd);
                  }}
                  className="text-[11px] font-medium px-3 py-1.5 rounded-full bg-slate-100 hover:bg-purple-100 hover:text-purple-800 text-slate-700 border border-slate-200 transition-all cursor-pointer"
                >
                  "{cmd}"
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-[11px] text-slate-400">
          Voice recognition powered by Web Speech API • Operates directly on live SQLite database
        </div>
      </div>
    </div>
  );
};

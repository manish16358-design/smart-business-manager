import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Volume2, Globe } from "lucide-react";

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  placeholder?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  language?: "en-IN" | "en-US" | "hi-IN";
  disabled?: boolean;
}

// Declare SpeechRecognition interfaces for TypeScript
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onTranscript,
  className = "",
  size = "md",
  language = "en-IN",
  disabled = false,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [activeLang, setActiveLang] = useState<"en-IN" | "en-US" | "hi-IN">(language);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [statusTooltip, setStatusTooltip] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
    }
  }, []);

  const toggleListening = () => {
    if (disabled) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatusTooltip("Speech recognition not supported in this browser. Please type manually.");
      setTimeout(() => setStatusTooltip(null), 3500);
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = activeLang;

      recognition.onstart = () => {
        setIsListening(true);
        setStatusTooltip(activeLang === "hi-IN" ? "सुन रहा हूँ... बोलिए (Listening in Hindi)" : "Listening... Speak now");
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          onTranscript(transcript);
          setStatusTooltip(`Recognized: "${transcript}"`);
          setTimeout(() => setStatusTooltip(null), 2500);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        setIsListening(false);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setStatusTooltip("Microphone permission denied. Please allow microphone in browser.");
        } else if (event.error === "no-speech") {
          setStatusTooltip("No speech detected. Please try speaking again.");
        } else {
          setStatusTooltip(`Mic error: ${event.error}`);
        }
        setTimeout(() => setStatusTooltip(null), 3500);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setIsListening(false);
      setStatusTooltip("Could not start microphone.");
      setTimeout(() => setStatusTooltip(null), 3000);
    }
  };

  const sizeClasses = {
    sm: "w-7 h-7 p-1 text-xs",
    md: "w-8 h-8 p-1.5 text-sm",
    lg: "w-10 h-10 p-2 text-base",
  };

  const iconSizes = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={toggleListening}
        disabled={disabled}
        title={
          isListening
            ? "Click to stop listening"
            : !isSupported
            ? "Speech recognition not supported in this browser"
            : `Click to speak (${activeLang === "hi-IN" ? "Hindi" : "English"})`
        }
        className={`relative inline-flex items-center justify-center rounded-lg transition-all duration-200 cursor-pointer ${
          sizeClasses[size]
        } ${
          isListening
            ? "bg-red-500 text-white shadow-md shadow-red-200 animate-pulse ring-2 ring-red-400 ring-offset-1"
            : "bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-purple-700 border border-slate-200"
        } ${disabled ? "opacity-40 cursor-not-allowed" : ""} ${className}`}
      >
        {isListening ? (
          <Mic className={`${iconSizes[size]} animate-bounce`} />
        ) : (
          <Mic className={iconSizes[size]} />
        )}

        {/* Pulsing ring indicator while listening */}
        {isListening && (
          <span className="absolute -inset-1 rounded-lg border-2 border-red-400 animate-ping opacity-75 pointer-events-none" />
        )}
      </button>

      {/* Language Quick Toggle */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setActiveLang((prev) => (prev === "en-IN" ? "hi-IN" : "en-IN"));
          setStatusTooltip(activeLang === "en-IN" ? "Switched to Hindi (हिंदी)" : "Switched to English");
          setTimeout(() => setStatusTooltip(null), 2000);
        }}
        title={`Language: ${activeLang} (Click to toggle English/Hindi)`}
        className="ml-1 text-[10px] font-bold px-1 py-0.5 rounded bg-slate-100 hover:bg-purple-100 text-slate-500 hover:text-purple-700 uppercase border border-slate-200/60"
      >
        {activeLang === "hi-IN" ? "HI" : "EN"}
      </button>

      {/* Tooltip / Status Bubble */}
      {statusTooltip && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 px-2.5 py-1.5 bg-slate-900 text-white text-[11px] rounded-lg shadow-lg whitespace-nowrap pointer-events-none border border-slate-700 animate-in fade-in zoom-in-95">
          <div className="flex items-center gap-1.5">
            {isListening ? (
              <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
            ) : null}
            <span>{statusTooltip}</span>
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useRef } from "react";
import {
  Brain,
  LoaderCircle,
  RotateCcw,
  Send,
  Stethoscope,
  ChevronRight,
  User,
  ShieldCheck,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import usePageMeta from "../hooks/usePageMeta";
import { patientAPI } from "../utils/api";
import { useToast } from "../components/ToastProvider";

const QUICK_START_PROMPTS = [
  "Chest discomfort for 3 days",
  "Persistent skin itching",
  "Frequent stomach pain",
  "Severe headache",
];

const MODE_OPTIONS = [
  {
    value: "auto",
    label: "Auto",
    hint: "Use the default engine flow and fallback behavior.",
  },
  {
    value: "api",
    label: "API",
    hint: "Prefer model-driven response quality when available.",
  },
  {
    value: "fallback",
    label: "Fallback",
    hint: "Prefer conservative rule-based triage style.",
  },
];

const getInitialMessages = () => [
  {
    id: "welcome",
    role: "assistant",
    text: "Hello. I can help triage your concern and guide you to the most appropriate specialist. Please describe your main symptoms in a short sentence.",
    createdAt: Date.now(),
  },
];

export default function AiDoctorSuggestionPublic() {
  usePageMeta({
    title: "AI Symptom Guidance | VitaBridge",
    description: "Professional AI-driven specialist recommendations.",
  });

  const toast = useToast();
  const [messages, setMessages] = useState(getInitialMessages);
  const [draft, setDraft] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [suggestedDoctors, setSuggestedDoctors] = useState([]);
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [selectedMode, setSelectedMode] = useState("auto");

  const scrollRef = useRef(null);
  const sessionIdRef = useRef(
    globalThis.crypto?.randomUUID?.() ||
      `ai-session-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isAnalyzing]);

  const progressPercent = Math.min(
    100,
    Math.round((messages.filter((m) => m.role === "user").length / 3) * 100),
  );

  const handleSubmit = async () => {
    const text = draft.trim();
    if (!text || isAnalyzing) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text,
      createdAt: Date.now(),
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft("");
    setIsAnalyzing(true);

    try {
      const result = await patientAPI.getAiDoctorSuggestions({
        symptoms: nextMessages.find((m) => m.role === "user")?.text || text,
        conversation: nextMessages.map((m) => ({ role: m.role, text: m.text })),
        sessionId: sessionIdRef.current,
        mode: selectedMode,
      });

      const assistantText =
        result?.assistantMessage ||
        result?.nextQuestion ||
        "Analyzing context...";
      setMessages((prev) => [
        ...prev,
        { id: `ai-${Date.now()}`, role: "assistant", text: assistantText },
      ]);

      if (!result?.needsMoreInfo) {
        setAnalysis(result);
        setSuggestedDoctors(
          Array.isArray(result?.doctors) ? result.doctors : [],
        );
      }
    } catch {
      toast.error("Connection error. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setMessages(getInitialMessages());
    setAnalysis(null);
    setSuggestedDoctors([]);
    sessionIdRef.current =
      globalThis.crypto?.randomUUID?.() ||
      `ai-session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const RecommendationContent = () => (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">
        Clinical Recommendation
      </h2>
      {analysis ? (
        <div className="space-y-4">
          <div className="p-4 bg-primary-50 border border-primary-100 rounded-xl">
            <p className="text-xs font-bold text-primary-600 uppercase mb-1">
              Recommended Field
            </p>
            <p className="text-xl font-extrabold text-slate-900">
              {analysis.field}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase">
              Available Specialists
            </p>
            {suggestedDoctors.map((doc, idx) => (
              <Link
                key={idx}
                to={`/patient/find-doctor?doctorId=${doc.doctorId || doc.id}&book=1`}
                className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-primary-300 hover:shadow-md transition group"
              >
                <div>
                  <p className="text-sm font-bold text-slate-800 group-hover:text-primary-600">
                    {doc.name}
                  </p>
                  <p className="text-xs text-slate-500">{doc.specialization}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary-500" />
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="py-10 text-center">
          <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <Brain className="w-6 h-6 text-slate-300" />
          </div>
          <p className="text-sm text-slate-400">
            Complete the conversation to unlock recommendations.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <main className="page-shell">
      <section className="page-hero">
        <div className="page-hero-inner">
          <h1 className="page-title">Specialist Finder</h1>
          <p className="page-subtitle">
            Answer a few clinical questions to identify the most appropriate
            medical specialty.
          </p>
        </div>
      </section>

      <section className="section-shell">
        <div className="section-container">
          {showDisclaimer && (
            <div className="bg-slate-900 rounded-2xl p-4 mb-4 text-white shadow-lg relative flex items-start gap-3 lg:hidden">
              <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs text-slate-300 pr-6">
                <span className="font-bold text-white">
                  Medical Disclaimer:
                </span>{" "}
                This AI assistant provides specialty suggestions based on common
                clinical patterns. It is <strong>not</strong> a diagnosis. If
                you are experiencing a medical emergency, seek immediate medical
                attention.
              </div>
              <button
                onClick={() => setShowDisclaimer(false)}
                className="absolute top-3 right-3 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {analysis && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 lg:hidden">
              <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto relative animate-in slide-in-from-bottom-10">
                <button
                  onClick={() => setAnalysis(null)}
                  className="absolute right-4 top-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
                <RecommendationContent />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-[650px]">
              {/* Header */}
              <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Assessment Progress
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    {isAnalyzing ? "Assessing..." : "Conversation Active"}
                  </span>
                </div>
                <div className="w-48 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-600 transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-6"
              >
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex gap-4 ${m.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === "user" ? "bg-primary-100 text-primary-700" : "bg-slate-100 text-slate-600"}`}
                    >
                      {m.role === "user" ? (
                        <User className="w-4 h-4" />
                      ) : (
                        <Stethoscope className="w-4 h-4" />
                      )}
                    </div>
                    <div
                      className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed ${m.role === "user" ? "bg-primary-600 text-white rounded-tr-none" : "bg-slate-50 text-slate-800 rounded-tl-none border border-slate-100"}`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
                {isAnalyzing && (
                  <div className="flex gap-4 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                      <LoaderCircle className="w-4 h-4 animate-spin text-slate-400" />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-white border-t border-slate-100">
                <div className="mb-4">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Triage Mode
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {MODE_OPTIONS.map((mode) => (
                      <button
                        key={mode.value}
                        onClick={() => setSelectedMode(mode.value)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition ${
                          selectedMode === mode.value
                            ? "bg-primary-600 text-white border-primary-600"
                            : "bg-white text-slate-600 border-slate-200 hover:border-primary-400 hover:text-primary-600"
                        }`}
                        type="button"
                        title={mode.hint}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    {
                      MODE_OPTIONS.find((mode) => mode.value === selectedMode)
                        ?.hint
                    }
                  </p>
                </div>

                {messages.length < 3 && !analysis && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {QUICK_START_PROMPTS.map((p) => (
                      <button
                        key={p}
                        onClick={() => setDraft(p)}
                        className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-full hover:border-primary-400 hover:text-primary-600 transition"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <textarea
                    rows={2}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      (e.preventDefault(), handleSubmit())
                    }
                    placeholder="Type your response here..."
                    className="flex-1 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition resize-none text-sm"
                  />
                  <button
                    onClick={handleReset}
                    title="Reset Session"
                    className="p-3 text-slate-500 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 rounded-xl transition"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!draft.trim() || isAnalyzing}
                    className="p-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-40 transition"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="hidden lg:col-span-4 lg:block space-y-6">
              <div
                className={`transition-all duration-500 ${analysis ? "opacity-100" : "opacity-60"}`}
              >
                <RecommendationContent />
              </div>
              <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-slate-200">
                <div className="flex items-center gap-2 mb-3 text-amber-400">
                  <ShieldCheck className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-tighter">
                    Medical Disclaimer
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-slate-300">
                  This AI assistant provides specialty suggestions based on
                  common clinical patterns. It is <strong>not</strong> a
                  diagnosis. If you are experiencing a medical emergency, seek
                  immediate medical attention.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}

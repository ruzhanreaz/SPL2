import React, { useEffect, useState } from "react";
import { Phone, PhoneOff, Video, Mic } from "lucide-react";

const CallNotification = ({
  isOpen,
  callType = "video",
  callerName = "Incoming Call",
  promptMessage,
  onAccept,
  onDecline,
}) => {
  const [pulse, setPulse] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    // Pulsing animation
    const interval = setInterval(() => {
      setPulse((prev) => !prev);
    }, 800);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const isVideoCall = callType === "video";
  const resolvedPrompt =
    typeof promptMessage === "string" && promptMessage.trim()
      ? promptMessage.trim()
      : isVideoCall
        ? "Incoming video call"
        : "Incoming audio call";

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="call-notification-title"
    >
      <div className="w-full max-w-sm mx-auto">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl shadow-2xl overflow-hidden border border-slate-700/50">
          {/* Header with animated status */}
          <div className="relative px-6 pt-6 pb-8 text-center">
            {/* Animated background glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div
                className={`absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-gradient-to-b from-primary-500/20 to-transparent rounded-full blur-3xl transition-opacity duration-1000 ${pulse ? "opacity-100" : "opacity-30"}`}
              />
            </div>

            {/* Caller avatar with pulsing ring */}
            <div className="relative flex justify-center mb-4">
              <div
                className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${pulse ? "scale-100 opacity-100" : "scale-110 opacity-0"}`}
              >
                <div className="w-24 h-24 rounded-full border-2 border-primary-400/30" />
              </div>
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-primary-500/30">
                {(callerName || "TM")
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join("")}
              </div>
            </div>

            {/* Call type indicator */}
            <div className="inline-flex items-center gap-2 mb-3">
              {isVideoCall ? (
                <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-300 text-xs font-semibold">
                  <Video className="w-3 h-3" />
                  Video Call
                </div>
              ) : (
                <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
                  <Mic className="w-3 h-3" />
                  Audio Call
                </div>
              )}
            </div>

            {/* Caller name */}
            <h2
              id="call-notification-title"
              className="text-2xl font-bold text-white mb-2"
            >
              {callerName || "Unknown"}
            </h2>

            {/* Animated ringing indicator */}
            <div className="flex items-center justify-center gap-1">
              <span
                className={`inline-block w-2 h-2 rounded-full bg-red-500 transition-opacity duration-500 ${pulse ? "opacity-100" : "opacity-30"}`}
              />
              <p className="text-sm text-slate-300 font-medium">
                {resolvedPrompt}
              </p>
              <span
                className={`inline-block w-2 h-2 rounded-full bg-red-500 transition-opacity duration-500 ${pulse ? "opacity-100" : "opacity-30"}`}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="px-6 pb-6 flex items-center gap-4 justify-center">
            {/* Decline button */}
            <button
              type="button"
              onClick={onDecline}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-400 font-semibold transition-all duration-200 active:scale-95"
              title="Decline call"
              aria-label="Decline call"
            >
              <PhoneOff className="w-5 h-5" />
              <span>Decline</span>
            </button>

            {/* Accept button - larger and prominent */}
            <button
              type="button"
              onClick={onAccept}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold shadow-lg shadow-green-500/30 transition-all duration-200 active:scale-95 hover:scale-105"
              title="Accept call"
              aria-label="Accept call"
            >
              <Phone className="w-5 h-5" />
              <span>Accept</span>
            </button>
          </div>

          {/* Bottom info */}
          <div className="px-6 py-3 bg-slate-800/50 border-t border-slate-700/50 text-center text-xs text-slate-400">
            {isVideoCall
              ? "Tap Accept to join video call"
              : "Tap Accept to join audio call"}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallNotification;

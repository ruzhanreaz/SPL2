import React, { useEffect, useState } from "react";
import { LogIn, X } from "lucide-react";

const ParticipantJoinedNotification = ({
  isOpen,
  participantName = "Participant",
  callType = "video",
  headline = "Joined the room",
  statusText,
  footerText,
  onDismiss,
  autoDismissMs = 4000,
}) => {
  const [pulse, setPulse] = useState(true);
  const [isVisible, setIsVisible] = useState(isOpen);

  useEffect(() => {
    setIsVisible(isOpen);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const pulseInterval = setInterval(() => {
      setPulse((prev) => !prev);
    }, 600);

    const dismissTimer =
      autoDismissMs > 0
        ? setTimeout(() => {
            setIsVisible(false);
            onDismiss?.();
          }, autoDismissMs)
        : null;

    return () => {
      clearInterval(pulseInterval);
      if (dismissTimer) clearTimeout(dismissTimer);
    };
  }, [isOpen, autoDismissMs, onDismiss]);

  if (!isVisible) return null;

  const isVideo = callType === "video";
  const resolvedStatusText =
    typeof statusText === "string" && statusText.trim()
      ? statusText.trim()
      : "The consultation room is active.";
  const resolvedFooterText =
    typeof footerText === "string" && footerText.trim()
      ? footerText.trim()
      : isVideo
        ? "Video session is ready"
        : "Audio session is ready";

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-none"
      role="status"
      aria-live="polite"
      aria-label={`${participantName} joined the ${callType} call`}
    >
      <div className="w-full max-w-sm mx-auto pointer-events-auto">
        <div className="bg-gradient-to-br from-emerald-900 to-emerald-800 rounded-3xl shadow-2xl overflow-hidden border border-emerald-700/50 animate-bounce-in">
          {/* Header */}
          <div className="relative px-6 pt-6 pb-6 text-center">
            {/* Animated background glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div
                className={`absolute top-0 left-1/2 -translate-x-1/2 w-56 h-56 bg-gradient-to-b from-emerald-400/30 to-transparent rounded-full blur-3xl transition-opacity duration-700 ${pulse ? "opacity-100" : "opacity-40"}`}
              />
            </div>

            {/* Avatar with pulsing ring */}
            <div className="relative flex justify-center mb-4">
              <div
                className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${pulse ? "scale-100 opacity-100" : "scale-110 opacity-0"}`}
              >
                <div className="w-20 h-20 rounded-full border-2 border-emerald-400/40" />
              </div>
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-emerald-500/40">
                {(participantName || "P")
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join("")}
              </div>
            </div>

            {/* Join status */}
            <div className="flex items-center justify-center gap-2 mb-3">
              <LogIn className="w-4 h-4 text-emerald-300" />
              <p className="text-sm font-semibold text-emerald-200">
                {headline}
              </p>
            </div>

            {/* Participant name */}
            <h3 className="text-2xl font-bold text-white mb-2">
              {participantName}
            </h3>

            {/* Call type */}
            <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/30 border border-emerald-400/50 text-emerald-100 text-xs font-semibold">
              <span
                className={`inline-block w-2 h-2 rounded-full bg-emerald-300 transition-opacity duration-500 ${pulse ? "opacity-100" : "opacity-50"}`}
              />
              <span>{resolvedFooterText}</span>
            </div>
            <p className="mt-3 text-sm text-emerald-100/90 max-w-xs mx-auto leading-relaxed">
              {resolvedStatusText}
            </p>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-emerald-700/50 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 animate-pulse"
              style={{
                animation: `slideIn ${autoDismissMs}ms linear forwards`,
              }}
            />
          </div>

          {/* Close button (top right) */}
          <button
            type="button"
            onClick={() => {
              setIsVisible(false);
              onDismiss?.();
            }}
            className="absolute top-4 right-4 p-2 text-emerald-200 hover:text-white hover:bg-emerald-600/30 rounded-full transition-all duration-200"
            title="Dismiss"
            aria-label="Dismiss notification"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <style>{`
                @keyframes bounceIn {
                    0% {
                        opacity: 0;
                        transform: scale(0.9) translateY(-20px);
                    }
                    50% {
                        opacity: 1;
                    }
                    100% {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }

                @keyframes slideIn {
                    0% {
                        width: 100%;
                    }
                    100% {
                        width: 0;
                    }
                }

                .animate-bounce-in {
                    animation: bounceIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                }
            `}</style>
    </div>
  );
};

export default ParticipantJoinedNotification;

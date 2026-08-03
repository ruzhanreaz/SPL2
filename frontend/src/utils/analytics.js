const normalizePayload = (payload = {}) => {
  if (!payload || typeof payload !== "object") return {};
  return payload;
};

export const trackEvent = (eventName, payload = {}) => {
  if (!eventName) return;

  const safePayload = normalizePayload(payload);

  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", eventName, safePayload);
    return;
  }

  if (typeof window !== "undefined" && typeof window.plausible === "function") {
    window.plausible(eventName, { props: safePayload });
    return;
  }

  if (import.meta.env.DEV) {
    // Keep local visibility without breaking production when analytics is not installed.
    console.info("[analytics:event]", eventName, safePayload);
  }
};

// ════════════════════════════════════════════════════════
// UNIFIED UI SIZING SYSTEM - Use these everywhere in the app
// ════════════════════════════════════════════════════════

export const adminUi = {
  // ── BUTTONS - Standardized button sizes ──
  buttonXs:
    "inline-flex items-center justify-center gap-2 rounded-full px-2 py-1 text-xs font-semibold text-center leading-tight transition-colors",
  buttonSm:
    "inline-flex items-center justify-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-center leading-tight transition-colors",
  buttonMd:
    "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-center leading-tight transition-colors",
  buttonLg:
    "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-center leading-tight transition-colors",

  // ── TEXT SIZES - Standardized font hierarchy ──
  textH1: "text-3xl font-bold text-gray-900",
  textH2: "text-2xl font-bold text-gray-900",
  textH3: "text-xl font-bold text-gray-900",
  textH4: "text-lg font-semibold text-gray-900",
  textH5: "text-base font-semibold text-gray-900",
  textBody: "text-sm text-gray-600",
  textCaption: "text-xs text-gray-500",
  textLabel: "text-xs font-semibold text-gray-700",

  // ── CAPSULES/CHIPS - Standardized badge sizes ──
  capsuleXs:
    "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold text-center leading-tight",
  capsuleSm:
    "inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold text-center leading-tight",
  capsuleMd:
    "inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-semibold text-center leading-tight",
  capsuleLg:
    "inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold text-center leading-tight",

  // ── CAPSULE STATES ──
  capsuleActive: "border-primary-300 bg-primary-50 text-primary-700",
  capsuleIdle: "border-gray-300 bg-white text-gray-600 hover:bg-gray-50",

  // ── INPUT FIELDS - Standardized form inputs ──
  inputMd:
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100",
  inputLg:
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100",
  searchInput:
    "w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100",

  // ── CARDS ──
  pageCard: "rounded-2xl border border-gray-100 bg-white p-4 shadow-sm",
  cardMd: "rounded-xl border border-gray-100 bg-white p-4 shadow-sm",
  cardSm: "rounded-lg border border-gray-100 bg-white p-3 shadow-sm",

  // ── LEGACY/DEPRECATED (kept for backwards compatibility, but prefer new sizes above) ──
  capsuleButton:
    "inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-sm font-semibold text-center leading-tight transition-colors",
  actionButton:
    "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-center leading-tight transition-colors",
  actionButtonLg:
    "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-center leading-tight transition-colors",
  input:
    "w-full rounded-full border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100",
  statusChip:
    "inline-flex rounded-full border px-2 py-1 text-xs font-semibold text-center leading-tight",
  statChip:
    "inline-flex items-center justify-between gap-3 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm",
};

/**
 * UNIFIED UI SIZING SYSTEM
 *
 * Use these constants everywhere in the app for consistent sizing.
 * Replaces all inline style variations with standardized, maintainable classes.
 *
 * Import: import { uiSizes } from "@/constants/uiSizes";
 *
 * Examples:
 *   <button className={uiSizes.buttonMd}>Click Me</button>
 *   <h2 className={uiSizes.textH3}>Heading</h2>
 *   <span className={`${uiSizes.capsuleSm} border-primary-200 bg-primary-50 text-primary-700`}>Badge</span>
 *   <input className={uiSizes.inputMd} />
 */

export const uiSizes = {
  // ════════════════════════════════════════
  // BUTTON SIZES - Use for all interactive buttons
  // ════════════════════════════════════════
  buttonXs:
    "inline-flex items-center justify-center gap-2 rounded-full px-2 py-1 text-xs font-semibold text-center leading-tight transition-colors",
  buttonSm:
    "inline-flex items-center justify-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-center leading-tight transition-colors",
  buttonMd:
    "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-center leading-tight transition-colors",
  buttonLg:
    "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-center leading-tight transition-colors",
  buttonXlRounded:
    "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-base font-semibold text-center leading-tight transition-colors",

  // ════════════════════════════════════════
  // TEXT SIZES - Use for all typography
  // ════════════════════════════════════════
  textH1: "text-3xl font-bold text-gray-900",
  textH2: "text-2xl font-bold text-gray-900",
  textH3: "text-xl font-bold text-gray-900",
  textH4: "text-lg font-semibold text-gray-900",
  textH5: "text-base font-semibold text-gray-900",
  textBody: "text-sm text-gray-600",
  textBodyStrong: "text-sm font-semibold text-gray-900",
  textCaption: "text-xs text-gray-500",
  textCaptionStrong: "text-xs font-semibold text-gray-600",
  textLabel: "text-xs font-semibold text-gray-700 uppercase tracking-wide",

  // ════════════════════════════════════════
  // CAPSULES/CHIPS/BADGES - Use for status, tags, labels
  // ════════════════════════════════════════
  capsuleXs:
    "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold text-center leading-tight",
  capsuleSm:
    "inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold text-center leading-tight",
  capsuleMd:
    "inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-semibold text-center leading-tight",
  capsuleLg:
    "inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold text-center leading-tight",

  // Capsule state variants (add to any capsule class)
  capsuleActivePrimary: "border-primary-300 bg-primary-50 text-primary-700",
  capsuleActiveSuccess: "border-emerald-300 bg-emerald-50 text-emerald-700",
  capsuleActiveWarning: "border-amber-300 bg-amber-50 text-amber-700",
  capsuleActiveDanger: "border-red-300 bg-red-50 text-red-700",
  capsuleIdle: "border-gray-300 bg-white text-gray-600 hover:bg-gray-50",

  // ════════════════════════════════════════
  // INPUT/FORM FIELDS
  // ════════════════════════════════════════
  inputMd:
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100",
  inputLg:
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100",
  inputRounded:
    "w-full rounded-full border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100",
  inputSearch:
    "w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100",

  // ════════════════════════════════════════
  // CARDS
  // ════════════════════════════════════════
  cardXs: "rounded-lg border border-gray-100 bg-white p-2 shadow-sm",
  cardSm: "rounded-lg border border-gray-100 bg-white p-3 shadow-sm",
  cardMd: "rounded-xl border border-gray-100 bg-white p-4 shadow-sm",
  cardLg: "rounded-2xl border border-gray-100 bg-white p-6 shadow-sm",

  // ════════════════════════════════════════
  // ALERTS/NOTIFICATIONS
  // ════════════════════════════════════════
  alertXs: "rounded-lg border px-2 py-1 text-xs",
  alertSm: "rounded-lg border px-3 py-2 text-sm",
  alertMd: "rounded-lg border px-4 py-3 text-sm",
  alertLg: "rounded-xl border px-4 py-3 text-base",
};

// Export from adminUi for backwards compatibility
export { adminUi } from "./adminUi.js";

import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  Stethoscope,
  ClipboardList,
  Activity,
  Video,
  User,
  Inbox,
  MessageSquare,
  Receipt,
  Sparkles,
} from "lucide-react";

export const publicLinks = [
  { name: "About", href: "/about" },
  { name: "Our Services", href: "/services" },
  { name: "AI Doctor Suggestion", href: "/ai-doctor-suggestion" },
  { name: "Doctor List", href: "/doctors" },
  { name: "Contact Us", href: "/contact" },
];

/**
 * Role-specific navigation links used by both Navbar (mobile) and Sidebar.
 * Single source of truth — update here to change navigation everywhere.
 */
export const roleLinks = {
  ADMIN: [
    { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Users", href: "/admin/users", icon: Users },
    { name: "Appointments", href: "/admin/appointments", icon: Calendar },
    { name: "Payments", href: "/admin/payments", icon: Receipt },
    { name: "Daily Reports", href: "/admin/reports", icon: ClipboardList },
    { name: "Complaints", href: "/admin/complaints", icon: MessageSquare },
    { name: "My Profile", href: "/admin/profile", icon: User },
    { name: "Notifications", href: "/notifications", icon: Inbox },
  ],
  PATIENT: [
    { name: "Dashboard", href: "/patient/dashboard", icon: LayoutDashboard },
    { name: "Documents", href: "/patient/documents", icon: FileText },
    {
      name: "Health Insights",
      href: "/patient/health-analysis",
      icon: Activity,
    },
    { name: "Appointments", href: "/patient/appointments", icon: Calendar },
    { name: "Doctors", href: "/patient/find-doctor", icon: Stethoscope },
    {
      name: "AI Suggestion",
      href: "/patient/ai-doctor-suggestion",
      icon: Sparkles,
    },
    { name: "Complaints", href: "/patient/complaints", icon: MessageSquare },
    { name: "Consultation", href: "/patient/telemedicine", icon: Video },
    { name: "Profile", href: "/profile", icon: User },
    { name: "Notification", href: "/notifications", icon: Inbox },
  ],
  DOCTOR: [
    { name: "Dashboard", href: "/doctor/dashboard", icon: LayoutDashboard },
    // {
    //   name: "Consultation",
    //   href: "/consultation/12345", // TODO: Replace 12345 with dynamic patientId if possible
    //   icon: Stethoscope,
    // },
    { name: "Schedule", href: "/doctor/schedule", icon: Calendar },
    {
      name: "Appointments",
      href: "/doctor/appointments",
      icon: ClipboardList,
    },
    { name: "Live Queue", href: "/doctor/live-queue", icon: Activity },
    { name: "Telemedicine", href: "/doctor/telemedicine", icon: Video },
    { name: "Assistants", href: "/doctor/assistants", icon: Users },
    {
      name: "Reviews",
      href: "/doctor/reviews",
      icon: MessageSquare,
    },
    { name: "Profile", href: "/profile", icon: User },
    { name: "Notifications", href: "/notifications", icon: Inbox },
  ],
  ASSISTANT: [
    { name: "Dashboard", href: "/assistant/dashboard", icon: LayoutDashboard },
    { name: "Schedule", href: "/assistant/schedule", icon: Calendar },
    {
      name: "Appointments",
      href: "/assistant/appointments",
      icon: ClipboardList,
    },
    { name: "Live Queue", href: "/assistant/live-queue", icon: Users },
    { name: "Reviews", href: "/assistant/reviews", icon: MessageSquare },
    { name: "Profile", href: "/profile", icon: User },
    { name: "Notifications", href: "/notifications", icon: Inbox },
  ],
};

/**
 * Dashboard routes by role (for post-login redirects, etc.)
 */
export const dashboardRoutes = {
  ADMIN: "/admin/dashboard",
  PATIENT: "/patient/dashboard",
  DOCTOR: "/doctor/dashboard",
  ASSISTANT: "/assistant/dashboard",
};

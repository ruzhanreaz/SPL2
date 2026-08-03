import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { LogOut } from "lucide-react";
import { roleLinks } from "../constants/navigation";
import { useSidebarState } from "./SidebarStateContext";

const Sidebar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { isCollapsed, isMobileOpen, closeMobile } = useSidebarState();
  const [hasDocumentAccessAlert, setHasDocumentAccessAlert] = useState(false);

  useEffect(() => {
    const refreshFlag = () => {
      setHasDocumentAccessAlert(
        user?.role === "PATIENT" &&
          window.localStorage.getItem("patientDocAccessAttention") === "1",
      );
    };

    refreshFlag();
    window.addEventListener("storage", refreshFlag);
    window.addEventListener("patient-doc-access-updated", refreshFlag);

    return () => {
      window.removeEventListener("storage", refreshFlag);
      window.removeEventListener("patient-doc-access-updated", refreshFlag);
    };
  }, [user?.role]);

  const handleLogout = () => {
    closeMobile();
    logout();
    navigate("/");
  };

  // Role-specific navigation links (from shared constant)
  const links = roleLinks[user?.role] || [];

  const renderLink = (link, mobile = false) => {
    const Icon = link.icon;
    const hasAccessAlert =
      user?.role === "PATIENT" &&
      link.href === "/patient/documents" &&
      hasDocumentAccessAlert;
    const isActive =
      location.pathname === link.href ||
      (link.href !== links[0]?.href && location.pathname.startsWith(link.href));

    return (
      <Link
        key={link.href}
        to={link.href}
        onClick={mobile ? closeMobile : undefined}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm group relative ${
          isActive
            ? "bg-primary-50 text-primary-600 font-semibold"
            : hasAccessAlert
              ? "text-red-700 bg-red-50 hover:bg-red-100"
              : "text-gray-700 hover:bg-gray-100"
        }`}
        title={!mobile && isCollapsed ? link.name : ""}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        {(mobile || !isCollapsed) && (
          <span className="whitespace-nowrap">{link.name}</span>
        )}

        {/* Tooltip for collapsed desktop state */}
        {!mobile && isCollapsed && (
          <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
            {link.name}
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      <aside
        className={`hidden md:flex flex-col bg-gray-50 h-[calc(100vh-2.25rem)] fixed left-0 top-9 overflow-y-auto overflow-x-hidden transition-all duration-300 ${
          isCollapsed ? "w-16" : "w-44"
        }`}
      >
        <nav className="pt-8 px-2 pb-2 space-y-1 flex-1">
          {links.map((link) => renderLink(link))}
        </nav>

        {/* Logout Button at Bottom */}
        <div className="p-2">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors font-semibold text-sm group relative"
            title={isCollapsed ? "Logout" : ""}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span className="whitespace-nowrap">Logout</span>}

            {/* Tooltip for collapsed desktop state */}
            {isCollapsed && (
              <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                Logout
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile backdrop and drawer */}
      <>
        <button
          type="button"
          onClick={closeMobile}
          className={`md:hidden fixed inset-0 top-9 bg-black/25 z-40 transition-opacity duration-200 ease-out ${
            isMobileOpen
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          }`}
          aria-label="Close sidebar"
          aria-hidden={!isMobileOpen}
        />
        <aside
          className={`md:hidden fixed top-11 left-2 w-1/2 max-w-xs z-50 max-h-[calc(100vh-3.5rem)] bg-white border border-gray-200 rounded-xl shadow-xl flex flex-col overflow-y-auto transform origin-top transition-all duration-200 ease-out will-change-transform ${
            isMobileOpen
              ? "translate-y-0 scale-100 opacity-100 pointer-events-auto"
              : "-translate-y-2 scale-95 opacity-0 pointer-events-none"
          }`}
          aria-hidden={!isMobileOpen}
        >
          <nav className="pt-3 px-2 pb-2 space-y-1 flex-1">
            {links.map((link) => renderLink(link, true))}
          </nav>

          <div className="p-2 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors font-semibold text-sm"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              <span className="whitespace-nowrap">Logout</span>
            </button>
          </div>
        </aside>
      </>
    </>
  );
};

export default Sidebar;

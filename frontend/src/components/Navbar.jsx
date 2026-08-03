import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import NotificationBell from "./NotificationBell";
import ProfilePreviewModal from "./ProfilePreviewModal";
import BrandLogo from "./BrandLogo";
import { dashboardRoutes } from "../constants/navigation";
import { useSidebarState } from "./SidebarStateContext";
import { usePageTitle } from "./PageTitleContext";
import { roleLinks } from "../constants/navigation";
import AvatarCircle from "./AvatarCircle";

const Navbar = ({ links }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [notificationCloseSignal, setNotificationCloseSignal] = useState(0);
  const auth = useAuth();
  const location = useLocation();
  const { pageTitle } = usePageTitle();
  const { toggleCollapsed, toggleMobile, closeMobile } = useSidebarState();

  const isMobileViewport = () =>
    window.matchMedia("(max-width: 767px)").matches;

  // Determine home link based on authentication and role
  const getHomeLink = () => {
    if (!auth?.isAuthenticated) return "/";
    return dashboardRoutes[auth.user?.role] || "/";
  };

  const isRouteActive = (href) => {
    if (href === "/") return location.pathname === "/";
    return (
      location.pathname === href || location.pathname.startsWith(`${href}/`)
    );
  };

  const getFallbackTitle = () => {
    if (!auth?.isAuthenticated) return "";

    const roleLinksForUser = roleLinks[auth.user?.role] || [];
    const matchedLink = roleLinksForUser.find(
      (link) =>
        location.pathname === link.href ||
        location.pathname.startsWith(`${link.href}/`),
    );

    if (matchedLink) return matchedLink.name;

    if (location.pathname.startsWith("/profile")) return "Profile";
    if (location.pathname.startsWith("/notifications")) return "Notifications";
    if (location.pathname.startsWith("/payment/success"))
      return "Payment Successful";
    if (location.pathname.startsWith("/payment/failed"))
      return "Payment Failed";

    return "Dashboard";
  };

  const currentPageTitle = pageTitle || getFallbackTitle();

  const toggleSidebarMenu = () => {
    if (window.matchMedia("(min-width: 768px)").matches) {
      toggleCollapsed();
      return;
    }
    toggleMobile();
  };

  const handleProfileButtonClick = () => {
    if (!isMobileViewport()) {
      setProfileModalOpen(true);
      return;
    }

    setProfileModalOpen((prev) => {
      const next = !prev;
      if (next) {
        setNotificationCloseSignal((signal) => signal + 1);
        closeMobile();
      }
      return next;
    });
  };

  const handleNotificationOpenChange = (isOpen) => {
    if (!isMobileViewport() || !isOpen) {
      return;
    }
    setProfileModalOpen(false);
    closeMobile();
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between pl-2 pr-4 sm:pl-3 sm:pr-6 md:pl-4 md:pr-8 py-1.5 bg-gray-50">
      <div className="flex items-center gap-3">
        {auth?.isAuthenticated && (
          <button
            onClick={toggleSidebarMenu}
            className="p-2 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Toggle sidebar"
          >
            <Menu className="w-6 h-6" />
          </button>
        )}

        {auth?.isAuthenticated ? (
          <div className="flex items-center gap-2 min-w-0">
            <Link
              to={getHomeLink()}
              className="hidden md:flex items-center gap-2 group cursor-pointer shrink-0"
            >
              <BrandLogo
                className="w-5 h-5"
                strokeClassName="text-primary-600 group-hover:text-primary-700 transition-colors"
              />
              <span className="text-lg font-extrabold tracking-tight text-primary-600 group-hover:text-primary-700 transition-colors">
                VitaBridge
              </span>
            </Link>
            <div className="hidden md:block w-8 h-px bg-gray-300 shrink-0" />
            <p className="truncate text-base font-semibold text-gray-900 sm:text-lg">
              {currentPageTitle}
            </p>
          </div>
        ) : (
          <Link
            to={getHomeLink()}
            className="flex items-center gap-2 group cursor-pointer"
          >
            <BrandLogo
              className="w-5 h-5"
              strokeClassName="text-primary-600 group-hover:text-primary-700 transition-colors"
            />
            <span className="text-lg font-extrabold tracking-tight text-primary-600 transition-colors">
              VitaBridge
            </span>
          </Link>
        )}
      </div>

      {/* Not Authenticated - Show Navigation Links */}
      {!auth?.isAuthenticated && (
        <>
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className={`transition-colors font-medium text-sm ${isRouteActive("/") ? "text-primary-600" : "text-gray-600 hover:text-primary-600"}`}
            >
              Home
            </Link>
            {links &&
              links
                .filter((link) => link.href !== "/")
                .map((link, index) => (
                  <Link
                    key={index}
                    to={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`transition-colors font-medium text-sm ${isRouteActive(link.href) ? "text-primary-600" : "text-gray-600 hover:text-primary-600"}`}
                  >
                    {link.name}
                  </Link>
                ))}
          </div>

          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${isRouteActive("/login") ? "text-primary-700 bg-primary-50" : "text-gray-700 hover:bg-gray-100"}`}
            >
              Login
            </Link>
            <Link
              to="/register"
              className={`px-4 py-2 text-sm font-semibold rounded-md shadow-md transition-all ${isRouteActive("/register") ? "bg-primary-700 text-white" : "bg-primary-600 text-white hover:bg-primary-700"}`}
            >
              Sign Up
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-md text-gray-700 hover:bg-gray-100"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu-public"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>

          {/* Mobile Menu Dropdown */}
          {mobileMenuOpen && (
            <div
              id="mobile-menu-public"
              className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-lg"
            >
              <div className="flex flex-col p-4 space-y-2">
                <Link
                  to="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-2 rounded-md ${isRouteActive("/") ? "text-primary-700 bg-primary-50" : "text-gray-700 hover:bg-gray-50"}`}
                >
                  Home
                </Link>
                {links &&
                  links
                    .filter((link) => link.href !== "/")
                    .map((link, index) => (
                      <Link
                        key={index}
                        to={link.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`px-4 py-2 rounded-md ${isRouteActive(link.href) ? "text-primary-700 bg-primary-50" : "text-gray-700 hover:bg-gray-50"}`}
                      >
                        {link.name}
                      </Link>
                    ))}
                <div className="pt-2 border-t border-gray-200 space-y-2">
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-4 py-2 text-center rounded-md ${isRouteActive("/login") ? "text-primary-700 bg-primary-50" : "text-gray-700 hover:bg-gray-50"}`}
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-4 py-2 text-center rounded-md ${isRouteActive("/register") ? "bg-primary-700 text-white" : "bg-primary-600 text-white hover:bg-primary-700"}`}
                  >
                    Sign Up
                  </Link>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Authenticated - Show Icons Only */}
      {auth?.isAuthenticated && (
        <>
          <div className="flex items-center gap-4">
            {/* Notification Bell Component */}
            <NotificationBell
              closeSignal={notificationCloseSignal}
              onOpenChange={handleNotificationOpenChange}
            />

            {/* Profile Icon Button */}
            <button
              onClick={handleProfileButtonClick}
              className="p-2 rounded-full text-gray-600 hover:text-primary-600 hover:bg-gray-100 transition-colors group"
              aria-label="Profile"
              title="Profile"
            >
              <AvatarCircle
                profile={auth?.user}
                sizeClassName="w-8 h-8"
                textClassName="text-xs"
                className="group-hover:scale-[1.02] transition-transform"
                alt="Open profile"
              />
            </button>
          </div>

          {/* Profile Preview Modal */}
          <ProfilePreviewModal
            isOpen={profileModalOpen}
            onClose={() => setProfileModalOpen(false)}
          />
        </>
      )}
    </nav>
  );
};

export default Navbar;

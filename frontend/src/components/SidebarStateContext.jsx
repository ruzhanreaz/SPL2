import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const SidebarStateContext = createContext(null);

export const SidebarStateProvider = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("sidebarCollapsed")) ?? false;
    } catch {
      return false;
    }
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const value = useMemo(
    () => ({
      isCollapsed,
      setIsCollapsed,
      isMobileOpen,
      setIsMobileOpen,
      toggleCollapsed: () => setIsCollapsed((prev) => !prev),
      openMobile: () => setIsMobileOpen(true),
      closeMobile: () => setIsMobileOpen(false),
      toggleMobile: () => setIsMobileOpen((prev) => !prev),
    }),
    [isCollapsed, isMobileOpen],
  );

  return (
    <SidebarStateContext.Provider value={value}>
      {children}
    </SidebarStateContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useSidebarState = () => {
  const context = useContext(SidebarStateContext);
  if (!context) {
    throw new Error("useSidebarState must be used within SidebarStateProvider");
  }
  return context;
};

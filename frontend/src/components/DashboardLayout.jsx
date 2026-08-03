import React from "react";
import Sidebar from "./Sidebar";
import { useSidebarState } from "./SidebarStateContext";

const DashboardLayout = ({ children }) => {
  const { isCollapsed } = useSidebarState();

  return (
    <div className="flex min-h-screen bg-gray-50 overflow-x-hidden">
      <Sidebar />
      <main
        className={`flex-1 min-w-0 mt-9 p-2 sm:p-3 transition-all duration-300 ${
          isCollapsed ? "md:ml-16" : "md:ml-44"
        }`}
      >
        <div className="dashboard-content min-w-0 bg-white rounded-xl shadow-xl p-3 sm:p-4 md:p-5 min-h-[calc(100vh-3.75rem)] overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;

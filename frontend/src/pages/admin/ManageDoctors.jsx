import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import {
  UserPlus,
  Trash2,
  UserX,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreVertical,
} from "lucide-react";
import { doctorAPI } from "../../utils/api";
import { useAuth } from "../../auth/AuthProvider";
import { useToast } from "../../components/ToastProvider";
import { useConfirm } from "../../hooks/useConfirm.jsx";
import { adminUi } from "../../constants/adminUi";

const ManageDoctors = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { showConfirm, ConfirmDialog } = useConfirm();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortField, setSortField] = useState("lastName");
  const [sortOrder, setSortOrder] = useState("asc");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [contextMenu, setContextMenu] = useState({
    id: null,
    x: 0,
    y: 0,
    isActive: false,
  });
  const { token } = useAuth();
  const hasValidToken = !!token && token !== "null" && token !== "undefined";

  useEffect(() => {
    const handler = (e) => {
      if (
        !e.target.closest(".actions-menu") &&
        !e.target.closest(".context-menu")
      ) {
        setOpenMenuId(null);
      }
      if (!e.target.closest(".context-menu")) {
        setContextMenu({ id: null, x: 0, y: 0, isActive: false });
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchDoctors = useCallback(async () => {
    if (!hasValidToken) {
      setDoctors([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await doctorAPI.getAllDoctors(token);
      setDoctors(data);
    } catch (err) {
      setError(err.message || "Failed to load doctors");
      console.error("Error fetching doctors:", err);
    } finally {
      setLoading(false);
    }
  }, [hasValidToken, token]);

  useEffect(() => {
    if (!hasValidToken) return;
    fetchDoctors();
  }, [hasValidToken, fetchDoctors]);

  const handleAddDoctor = () => {
    navigate("/admin/doctors/add");
  };

  const handleDeleteDoctor = async (doctorId) => {
    showConfirm({
      title: "Delete Doctor",
      message:
        "Are you sure you want to delete this doctor? This action cannot be undone.",
      confirmText: "Delete",
      variant: "danger",
      onConfirm: async () => {
        try {
          await doctorAPI.deleteDoctor(doctorId, token);
          toast.success("Doctor deleted successfully");
          // Refresh the doctors list after successful deletion
          fetchDoctors();
        } catch (err) {
          toast.error(err.message || "Failed to delete doctor");
          console.error("Error deleting doctor:", err);
        }
      },
    });
  };

  const handleToggleStatus = async (doctorId) => {
    try {
      const updatedDoctor = await doctorAPI.toggleDoctorStatus(doctorId, token);
      // Update the local state with the updated doctor
      setDoctors(
        doctors.map((doctor) =>
          doctor.doctorId === doctorId ? updatedDoctor : doctor,
        ),
      );
      toast.success("Doctor status updated successfully");
    } catch (err) {
      toast.error(err.message || "Failed to toggle doctor status");
      console.error("Error toggling doctor status:", err);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="w-4 h-4" />
    ) : (
      <ArrowDown className="w-4 h-4" />
    );
  };

  const sortedDoctors = [...doctors].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];

    // Handle name sorting
    if (sortField === "name") {
      aValue = `${a.firstName} ${a.lastName}`.toLowerCase();
      bValue = `${b.firstName} ${b.lastName}`.toLowerCase();
    } else if (typeof aValue === "string") {
      aValue = (aValue || "").toLowerCase();
      bValue = (bValue || "").toLowerCase();
    }

    if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
    if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">Loading doctors...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64">
          <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm mb-4">
            {error}
          </p>
          <button
            onClick={fetchDoctors}
            className="rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
          >
            Retry
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div>
        {/* Header */}
        <div className="mb-4 md:mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 relative">
          <h1 className="app-page-title">App Doctors</h1>
          <button
            onClick={handleAddDoctor}
            className={`${adminUi.actionButton} self-end sm:self-auto bg-primary-600 text-white hover:bg-primary-700`}
          >
            <UserPlus className="w-4 h-4" />
            Add Doctor
          </button>
        </div>

        {/* Desktop Table View - Hidden on Mobile */}
        <div className="hidden lg:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden max-h-[500px] overflow-y-auto">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort("name")}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      Name {getSortIcon("name")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort("email")}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      Email {getSortIcon("email")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort("specialization")}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      Specialization {getSortIcon("specialization")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort("isActive")}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      Status {getSortIcon("isActive")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-12"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {doctors.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-4 py-6 text-center text-gray-500"
                    >
                      No doctors found. Click "Add Doctor" to add a new doctor.
                    </td>
                  </tr>
                ) : (
                  sortedDoctors.map((doctor) => (
                    <tr
                      key={doctor.doctorId}
                      className="hover:bg-gray-50 select-none"
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({
                          id: doctor.doctorId,
                          x: e.clientX,
                          y: e.clientY,
                          isActive: doctor.isActive,
                        });
                      }}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {doctor.firstName} {doctor.lastName}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-600">
                          {doctor.email}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-600">
                          {doctor.specialization || "N/A"}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-600">
                          {doctor.phoneNumber}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`${adminUi.statusChip} ${
                            doctor.isActive
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-red-200 bg-red-50 text-red-700"
                          }`}
                        >
                          {doctor.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-right">
                        <div className="actions-menu inline-block">
                          <button
                            onClick={(e) => {
                              const rect =
                                e.currentTarget.getBoundingClientRect();
                              setMenuPos({
                                top: rect.bottom + 4,
                                right: window.innerWidth - rect.right,
                              });
                              setOpenMenuId(
                                openMenuId === doctor.doctorId
                                  ? null
                                  : doctor.doctorId,
                              );
                            }}
                            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                          >
                            <MoreVertical className="w-5 h-5 text-gray-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Card View - Visible on Mobile/Tablet */}
        <div className="lg:hidden space-y-3 md:space-y-4">
          {doctors.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
              <p className="text-gray-500 mb-4">No doctors found.</p>
              <p className="text-sm text-gray-400">
                Click "Add Doctor" to add a new doctor.
              </p>
            </div>
          ) : (
            sortedDoctors.map((doctor) => (
              <div
                key={doctor.doctorId}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                {/* Doctor Info */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1">
                      Dr. {doctor.firstName} {doctor.lastName}
                    </h3>
                    <p className="text-sm text-gray-600 mb-1">
                      {doctor.specialization || "N/A"}
                    </p>
                  </div>
                  <span
                    className={`${adminUi.statusChip} ${
                      doctor.isActive
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-red-200 bg-red-50 text-red-700"
                    }`}
                  >
                    {doctor.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                {/* Contact Details */}
                <div className="space-y-1.5 mb-3 pb-3 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500 w-16">
                      Email:
                    </span>
                    <span className="text-sm text-gray-900 break-all">
                      {doctor.email}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500 w-16">
                      Phone:
                    </span>
                    <span className="text-sm text-gray-900">
                      {doctor.phoneNumber}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end">
                  <div className="actions-menu">
                    <button
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setMenuPos({
                          top: rect.bottom + 4,
                          right: window.innerWidth - rect.right,
                        });
                        setOpenMenuId(
                          openMenuId === doctor.doctorId
                            ? null
                            : doctor.doctorId,
                        );
                      }}
                      className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <MoreVertical className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {openMenuId !== null && (
        <div
          className="actions-menu fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[150px]"
          style={{ top: menuPos.top, right: menuPos.right }}
        >
          {(() => {
            const doctor = doctors.find((d) => d.doctorId === openMenuId);
            if (!doctor) return null;
            return (
              <>
                <button
                  onClick={() => {
                    handleToggleStatus(doctor.doctorId);
                    setOpenMenuId(null);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors rounded-t-lg ${doctor.isActive ? "text-orange-600" : "text-green-600"}`}
                >
                  <UserX className="w-4 h-4" />
                  {doctor.isActive ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() => {
                    handleDeleteDoctor(doctor.doctorId);
                    setOpenMenuId(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors rounded-b-lg"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </>
            );
          })()}
        </div>
      )}
      {contextMenu.id !== null && (
        <div
          className="context-menu fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[150px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={() => {
              handleToggleStatus(contextMenu.id);
              setContextMenu({ id: null, x: 0, y: 0, isActive: false });
            }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors rounded-t-lg ${contextMenu.isActive ? "text-orange-600" : "text-green-600"}`}
          >
            <UserX className="w-4 h-4" />
            {contextMenu.isActive ? "Deactivate" : "Activate"}
          </button>
          <button
            onClick={() => {
              handleDeleteDoctor(contextMenu.id);
              setContextMenu({ id: null, x: 0, y: 0, isActive: false });
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors rounded-b-lg"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      )}
      <ConfirmDialog />
    </DashboardLayout>
  );
};

export default ManageDoctors;

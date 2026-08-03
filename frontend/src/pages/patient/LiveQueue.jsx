import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users } from "lucide-react";
import DashboardLayout from "../../components/DashboardLayout";
import PageHeader from "../../components/ui/PageHeader";
import PageLoadingState from "../../components/ui/PageLoadingState";
import PageErrorState from "../../components/ui/PageErrorState";
import PageEmptyState from "../../components/ui/PageEmptyState";
import LiveQueueWidget from "../../components/LiveQueueWidget";
import { appointmentAPI } from "../../utils/api";
import { useAuth } from "../../auth/AuthProvider";

const PatientLiveQueue = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0];

  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await appointmentAPI.getPatientAppointments(token);
      setAppointments(data);
    } catch (err) {
      setError(err.message || "Failed to load queue data");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const queueAppointments = useMemo(
    () =>
      appointments.filter(
        (appointment) =>
          appointment.appointmentDate === today &&
          appointment.doctorId != null &&
          appointment.serialNumber != null &&
          [
            "PENDING",
            "CONFIRMED",
            "IN_PROGRESS",
            "PAYMENT_PENDING",
            "SCHEDULED",
          ].includes(appointment.status),
      ),
    [appointments, today],
  );

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoadingState message="Loading live queue..." />
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <PageErrorState message={error} onRetry={fetchAppointments} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div>
        <PageHeader
          title="Today's Live Queue"
          actions={
            <button
              type="button"
              onClick={() => navigate("/patient/appointments")}
              className="inline-flex items-center gap-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold px-4 py-2 rounded-full transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Appointments
            </button>
          }
        />

        {queueAppointments.length === 0 ? (
          <PageEmptyState
            icon={Users}
            title="No active appointments today"
            description="Book an appointment to track your queue position."
          />
        ) : (
          <div className="space-y-4">
            {queueAppointments.map((appointment) => (
              <div
                key={appointment.appointmentId}
                className="bg-white rounded-xl border border-gray-200 p-5"
              >
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Dr. {appointment.doctorName} ·{" "}
                  {appointment.appointmentType === "ONLINE"
                    ? "Online"
                    : "In-Person"}
                </p>
                <LiveQueueWidget
                  doctorId={appointment.doctorId}
                  date={appointment.appointmentDate || today}
                  role="patient"
                  patientSerialNumber={appointment.serialNumber}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PatientLiveQueue;

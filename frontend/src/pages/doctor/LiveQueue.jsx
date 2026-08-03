import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users } from "lucide-react";
import DashboardLayout from "../../components/DashboardLayout";
import PageHeader from "../../components/ui/PageHeader";
import PageEmptyState from "../../components/ui/PageEmptyState";
import LiveQueueWidget from "../../components/LiveQueueWidget";
import { useAuth } from "../../auth/AuthProvider";

const DoctorLiveQueue = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const today = useMemo(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().split("T")[0];
  }, []);

  const doctorId = useMemo(() => user?.doctorId ?? null, [user?.doctorId]);

  return (
    <DashboardLayout>
      <div>
        <PageHeader
          title="Today's Live Queue"
          actions={
            <button
              type="button"
              onClick={() => navigate("/doctor/appointments")}
              className="inline-flex items-center gap-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold px-4 py-2 rounded-full transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Appointments
            </button>
          }
        />

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          {doctorId ? (
            <LiveQueueWidget doctorId={doctorId} date={today} role="doctor" />
          ) : (
            <PageEmptyState
              icon={Users}
              title="No doctor queue available"
              description="Unable to determine doctor identity for queue view."
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DoctorLiveQueue;

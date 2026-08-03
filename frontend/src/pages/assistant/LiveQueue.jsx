import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Users } from "lucide-react";
import DashboardLayout from "../../components/DashboardLayout";
import PageHeader from "../../components/ui/PageHeader";
import PageLoadingState from "../../components/ui/PageLoadingState";
import PageErrorState from "../../components/ui/PageErrorState";
import PageEmptyState from "../../components/ui/PageEmptyState";
import LiveQueueWidget from "../../components/LiveQueueWidget";
import { queueAPI } from "../../utils/api";
import { useAuth } from "../../auth/AuthProvider";

const AssistantLiveQueue = () => {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [queueState, setQueueState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const today = useMemo(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().split("T")[0];
  }, []);

  const fetchQueue = useCallback(async () => {
    if (!token) {
      setQueueState(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await queueAPI.getAssistantTodayQueue(token);
      setQueueState(data || null);
    } catch (err) {
      setError(err.message || "Failed to load queue data");
      setQueueState(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const doctorId = queueState?.doctorId ?? null;
  const queueDate = queueState?.queueDate || today;

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
        <PageErrorState message={error} onRetry={fetchQueue} />
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
              onClick={() => navigate("/assistant/appointments")}
              className="inline-flex items-center gap-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold px-4 py-2 rounded-full transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Appointments
            </button>
          }
        />

        {!doctorId ? (
          <PageEmptyState
            icon={Users}
            title="No queue available"
            description="No assigned doctor queue was found for today."
          />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <LiveQueueWidget
              doctorId={doctorId}
              date={queueDate}
              role="assistant"
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AssistantLiveQueue;

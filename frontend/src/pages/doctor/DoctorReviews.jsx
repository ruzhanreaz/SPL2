import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { appointmentAPI, assistantAPI } from "../../utils/api";
import { useAuth } from "../../auth/AuthProvider";
import { Star, MessageSquare } from "lucide-react";

const DoctorReviews = ({ isAssistantMode = false }) => {
    const { token } = useAuth();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchReviews = useCallback(async () => {
        if (!token) {
            setItems([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError("");
            const appointments = await (isAssistantMode
                ? assistantAPI.getDoctorAppointments(token)
                : appointmentAPI.getDoctorAppointments(token));

            const list = (Array.isArray(appointments) ? appointments : [])
                .filter((appointment) => Number.isFinite(Number(appointment.rating)))
                .sort((left, right) => {
                    const leftTime = new Date(
                        left.ratedAt || `${left.appointmentDate}T${left.appointmentTime || "00:00:00"}`,
                    ).getTime();
                    const rightTime = new Date(
                        right.ratedAt || `${right.appointmentDate}T${right.appointmentTime || "00:00:00"}`,
                    ).getTime();
                    return rightTime - leftTime;
                });

            setItems(list);
        } catch (err) {
            setError(err.message || "Failed to load reviews");
        } finally {
            setLoading(false);
        }
    }, [isAssistantMode, token]);

    useEffect(() => {
        fetchReviews();
    }, [fetchReviews]);

    const averageRating = useMemo(() => {
        if (items.length === 0) return 0;
        const total = items.reduce(
            (sum, item) => sum + Number(item.rating || 0),
            0,
        );
        return total / items.length;
    }, [items]);

    const title = isAssistantMode ? "Doctor Reviews" : "My Reviews";

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                    <h1 className="app-page-title">{title}</h1>
                    <p className="mt-1 text-sm text-gray-600">
                        Patient feedback and ratings from completed appointments.
                    </p>
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700">
                        <Star className="h-4 w-4" />
                        {averageRating.toFixed(1)} average from {items.length} review
                        {items.length === 1 ? "" : "s"}
                    </div>
                </div>

                {loading ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
                        Loading reviews...
                    </div>
                ) : error ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        {error}
                    </div>
                ) : items.length === 0 ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
                        No reviews yet.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {items.map((item) => (
                            <article
                                key={item.appointmentId}
                                className="rounded-xl border border-gray-200 bg-white p-4"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-gray-900">
                                        {item.patientName || "Patient"}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {item.ratedAt
                                            ? new Date(item.ratedAt).toLocaleDateString("en-US", {
                                                year: "numeric",
                                                month: "short",
                                                day: "numeric",
                                            })
                                            : item.appointmentDate || ""}
                                    </p>
                                </div>
                                <p className="mt-1 text-sm font-semibold text-amber-700">
                                    {Number(item.rating) || 0}/5
                                </p>
                                <p className="mt-2 text-sm text-gray-700">
                                    {item.reviewText?.trim() || "No written comment."}
                                </p>
                                <p className="mt-2 inline-flex items-center gap-1 text-xs text-gray-500">
                                    <MessageSquare className="h-3.5 w-3.5" />
                                    Appointment #{item.appointmentId}
                                </p>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default DoctorReviews;

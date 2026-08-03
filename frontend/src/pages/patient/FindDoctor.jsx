import React, { useState, useEffect, useCallback, useRef } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import DashboardLayout from "../../components/DashboardLayout";
import BookAppointmentModal from "../../components/BookAppointmentModal";
import {
  Search,
  Stethoscope,
  MapPin,
  X,
  Phone,
  Mail,
  Calendar,
  Award,
  ChevronDown,
  Check,
  Clock,
  SlidersHorizontal,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { patientAPI, publicAPI } from "../../utils/api";
import { useToast } from "../../components/ToastProvider";
import { useAuth } from "../../auth/AuthProvider";
import StarRating from "../../components/StarRating";
import AvatarCircle from "../../components/AvatarCircle";

const getAverageRating = (doctor) => {
  const value = Number(doctor?.averageRating);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(5, value));
};

const getTotalRatings = (doctor) => {
  const value = Number(doctor?.totalRatings);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
};

const FindDoctor = () => {
  const toast = useToast();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [doctors, setDoctors] = useState([]);
  const [filteredDoctors, setFilteredDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [doctorSchedule, setDoctorSchedule] = useState(null);
  const [selectedDoctorReviews, setSelectedDoctorReviews] = useState([]);
  const [loadingSelectedDoctorReviews, setLoadingSelectedDoctorReviews] =
    useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [sortBy, setSortBy] = useState("name");
  const [specializationFilter, setSpecializationFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [doctorSchedules, setDoctorSchedules] = useState({});
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const filterBarRef = useRef(null);
  const liveAvailabilityClientRef = useRef(null);
  const selectedDoctorRef = useRef(null);
  const doctorsRef = useRef([]);

  const refreshDoctorSchedule = useCallback(
    async (doctorId) => {
      if (!doctorId || !token) {
        return;
      }

      try {
        const schedule = await patientAPI.getDoctorSchedule(doctorId, token);
        setDoctorSchedules((prev) => ({ ...prev, [doctorId]: schedule }));
        setDoctorSchedule((prevSchedule) => {
          if (
            !selectedDoctorRef.current ||
            selectedDoctorRef.current.doctorId !== doctorId
          ) {
            return prevSchedule;
          }
          return schedule;
        });
      } catch {
        setDoctorSchedules((prev) => ({ ...prev, [doctorId]: null }));
        setDoctorSchedule((prevSchedule) => {
          if (
            !selectedDoctorRef.current ||
            selectedDoctorRef.current.doctorId !== doctorId
          ) {
            return prevSchedule;
          }
          return null;
        });
      }
    },
    [token],
  );

  const refreshAllDoctorSchedules = useCallback(
    async (doctorList) => {
      if (!token || !doctorList || doctorList.length === 0) {
        return;
      }

      const results = await Promise.allSettled(
        doctorList.map(async (doctor) => {
          const schedule = await patientAPI.getDoctorSchedule(
            doctor.doctorId,
            token,
          );
          return { doctorId: doctor.doctorId, schedule };
        }),
      );

      const updates = {};
      results.forEach((result, idx) => {
        const doctorId = doctorList[idx].doctorId;
        updates[doctorId] =
          result.status === "fulfilled" ? result.value.schedule : null;
      });

      setDoctorSchedules((prev) => ({ ...prev, ...updates }));

      const selectedDoctorId = selectedDoctorRef.current?.doctorId;
      if (
        selectedDoctorId &&
        Object.prototype.hasOwnProperty.call(updates, selectedDoctorId)
      ) {
        setDoctorSchedule(updates[selectedDoctorId]);
      }
    },
    [token],
  );

  const refreshActiveDoctors = useCallback(async () => {
    if (!token) {
      return null;
    }

    try {
      const data = await patientAPI.getActiveDoctors(token);
      setDoctors(data);
      return data;
    } catch {
      // silent failure to avoid noisy toasts from background refresh
      return null;
    }
  }, [token]);

  const fetchDoctors = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await patientAPI.getActiveDoctors(token);
      // Data already contains only active doctors from the backend
      setDoctors(data);
      setFilteredDoctors(data);
    } catch (err) {
      setError(err.message || "Failed to load doctors");
      console.error("Error fetching doctors:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  useEffect(() => {
    selectedDoctorRef.current = selectedDoctor;
  }, [selectedDoctor]);

  useEffect(() => {
    let active = true;

    const loadSelectedDoctorReviews = async () => {
      if (!selectedDoctor?.doctorId) {
        setSelectedDoctorReviews([]);
        setLoadingSelectedDoctorReviews(false);
        return;
      }

      try {
        setLoadingSelectedDoctorReviews(true);
        const reviewData = await publicAPI.getDoctorReviews(
          selectedDoctor.doctorId,
        );
        if (active) {
          setSelectedDoctorReviews(Array.isArray(reviewData) ? reviewData : []);
        }
      } catch {
        if (active) {
          setSelectedDoctorReviews([]);
        }
      } finally {
        if (active) {
          setLoadingSelectedDoctorReviews(false);
        }
      }
    };

    loadSelectedDoctorReviews();
    return () => {
      active = false;
    };
  }, [selectedDoctor?.doctorId]);

  useEffect(() => {
    doctorsRef.current = doctors;
  }, [doctors]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const wsBaseUrl =
      import.meta.env.VITE_WS_URL ||
      `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;
    const wsUrl = `${wsBaseUrl.replace(/\/$/, "")}/ws-telemedicine`;
    const client = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: () => {},
      onConnect: () => {
        client.subscribe("/topic/doctor-availability", async (message) => {
          try {
            const payload = JSON.parse(message.body);
            if (payload?.doctorId) {
              await refreshDoctorSchedule(payload.doctorId);
            }
          } catch {
            // ignore malformed payloads
          }
          const latestDoctors = await refreshActiveDoctors();
          await refreshAllDoctorSchedules(latestDoctors || doctorsRef.current);
        });

        client.subscribe("/topic/doctors/status", async () => {
          const latestDoctors = await refreshActiveDoctors();
          await refreshAllDoctorSchedules(latestDoctors || doctorsRef.current);
        });
      },
    });

    client.activate();
    liveAvailabilityClientRef.current = client;

    return () => {
      client.deactivate();
      liveAvailabilityClientRef.current = null;
    };
  }, [
    token,
    refreshDoctorSchedule,
    refreshActiveDoctors,
    refreshAllDoctorSchedules,
  ]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const intervalId = setInterval(async () => {
      const latestDoctors = await refreshActiveDoctors();
      await refreshAllDoctorSchedules(latestDoctors || doctorsRef.current);
    }, 5000);

    return () => {
      clearInterval(intervalId);
    };
  }, [token, refreshActiveDoctors, refreshAllDoctorSchedules]);

  const toScheduleDayOfWeek = (date) => {
    const day = date.getDay(); // 0 (Sun) to 6 (Sat)
    return day === 0 ? 7 : day; // backend uses 1 (Mon) to 7 (Sun)
  };

  const toISODate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const isAvailableOnDate = useCallback((schedule, date) => {
    if (!schedule) return false;

    const dateKey = toISODate(date);
    const override = (schedule.scheduleOverrides || []).find(
      (entry) => entry.overrideDate === dateKey,
    );
    if (override) {
      return Boolean(override.isAvailable);
    }

    const dayOfWeek = toScheduleDayOfWeek(date);
    return (schedule.weeklySchedules || []).some(
      (slot) => slot.dayOfWeek === dayOfWeek && slot.isAvailable,
    );
  }, []);

  const hasAvailabilityWithinDays = useCallback(
    (schedule, startOffset, endOffset) => {
      if (!schedule) return false;

      const today = new Date();
      for (let offset = startOffset; offset <= endOffset; offset += 1) {
        const date = new Date(today);
        date.setDate(today.getDate() + offset);
        if (isAvailableOnDate(schedule, date)) {
          return true;
        }
      }

      return false;
    },
    [isAvailableOnDate],
  );

  const getAvailabilityBadge = (schedule) => {
    if (schedule === undefined) {
      return { text: "Checking schedule", dotClass: "bg-amber-300" };
    }

    if (!schedule) {
      return { text: "No upcoming slots", dotClass: "bg-red-300" };
    }

    const today = new Date();
    if (isAvailableOnDate(schedule, today)) {
      return { text: "Available today", dotClass: "bg-green-300" };
    }

    if (hasAvailabilityWithinDays(schedule, 1, 7)) {
      return { text: "Available this week", dotClass: "bg-yellow-300" };
    }

    return { text: "No upcoming slots", dotClass: "bg-red-300" };
  };

  const canBookFromSchedule = (schedule) => {
    if (!schedule) return false;

    const hasWeeklyAvailability = (schedule.weeklySchedules || []).some(
      (slot) => slot.isAvailable,
    );
    if (hasWeeklyAvailability) return true;

    const today = toISODate(new Date());
    return (schedule.scheduleOverrides || []).some(
      (override) => override.isAvailable && override.overrideDate >= today,
    );
  };

  const filterDoctors = useCallback(() => {
    let filtered = doctors;

    if (specializationFilter !== "all") {
      filtered = filtered.filter(
        (d) =>
          (d.specialization || "General Practice") === specializationFilter,
      );
    }

    if (locationFilter !== "all") {
      filtered = filtered.filter((d) => (d.location || "") === locationFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((doctor) => {
        const fullName = `${doctor.firstName} ${doctor.lastName}`.toLowerCase();
        const specialization = (doctor.specialization || "").toLowerCase();
        const location = (doctor.location || "").toLowerCase();
        return (
          fullName.includes(query) ||
          specialization.includes(query) ||
          location.includes(query)
        );
      });
    }

    if (availabilityFilter !== "all") {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 (Sun) to 6 (Sat)
      const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;

      const rangesByFilter = {
        today: [0, 0],
        tomorrow: [1, 1],
        next3: [0, 3],
        thisWeek: [0, daysUntilSunday],
        next7: [0, 7],
      };

      filtered = filtered.filter((doctor) => {
        const schedule = doctorSchedules[doctor.doctorId];
        if (!schedule) return false;
        const [startOffset, endOffset] = rangesByFilter[availabilityFilter] || [
          0, 7,
        ];
        return hasAvailabilityWithinDays(schedule, startOffset, endOffset);
      });
    }

    setFilteredDoctors(filtered);
  }, [
    searchQuery,
    doctors,
    specializationFilter,
    locationFilter,
    availabilityFilter,
    doctorSchedules,
    hasAvailabilityWithinDays,
  ]);

  const sortDoctors = useCallback(
    (doctorsToSort) => {
      return [...doctorsToSort].sort((a, b) => {
        let aValue, bValue;

        switch (sortBy) {
          case "name":
            aValue = `${a.firstName} ${a.lastName}`.toLowerCase();
            bValue = `${b.firstName} ${b.lastName}`.toLowerCase();
            break;
          case "specialization":
            aValue = (a.specialization || "").toLowerCase();
            bValue = (b.specialization || "").toLowerCase();
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return -1;
        if (aValue > bValue) return 1;
        return 0;
      });
    },
    [sortBy],
  );

  useEffect(() => {
    filterDoctors();
  }, [filterDoctors]);

  useEffect(() => {
    setFilteredDoctors((prev) => sortDoctors(prev));
  }, [sortBy, sortDoctors]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (doctors.length === 0) return;

    const missingDoctorIds = doctors
      .map((d) => d.doctorId)
      .filter(
        (doctorId) =>
          !Object.prototype.hasOwnProperty.call(doctorSchedules, doctorId),
      );

    if (missingDoctorIds.length === 0) return;

    let mounted = true;
    const loadSchedules = async () => {
      setAvailabilityLoading(true);
      const results = await Promise.allSettled(
        missingDoctorIds.map(async (doctorId) => {
          const schedule = await patientAPI.getDoctorSchedule(doctorId, token);
          return { doctorId, schedule };
        }),
      );

      if (!mounted) return;

      const updates = {};
      results.forEach((result, idx) => {
        const doctorId = missingDoctorIds[idx];
        if (result.status === "fulfilled") {
          updates[doctorId] = result.value.schedule;
        } else {
          updates[doctorId] = null;
        }
      });

      setDoctorSchedules((prev) => ({ ...prev, ...updates }));
      setAvailabilityLoading(false);
    };

    loadSchedules();

    return () => {
      mounted = false;
    };
  }, [doctors, doctorSchedules, token]);

  const handleCardClick = async (doctor) => {
    setSelectedDoctor(doctor);
    setDoctorSchedule(null);
    setScheduleLoading(true);
    try {
      const schedule = await patientAPI.getDoctorSchedule(
        doctor.doctorId,
        token,
      );
      setDoctorSchedule(schedule);
    } catch {
      // schedule unavailable — no-op, section will show fallback
    } finally {
      setScheduleLoading(false);
    }
  };

  const closeDoctorDetails = () => {
    setSelectedDoctor(null);
    setShowBookingModal(false);
    setSelectedDoctorReviews([]);
  };

  const closeBookingModal = () => {
    setShowBookingModal(false);
    setSelectedDoctor(null);
    setDoctorSchedule(null);
    setSelectedDoctorReviews([]);
  };

  const handleBookAppointment = async (doctor) => {
    let schedule = doctorSchedules[doctor.doctorId];

    if (schedule === undefined) {
      try {
        schedule = await patientAPI.getDoctorSchedule(doctor.doctorId, token);
        setDoctorSchedules((prev) => ({
          ...prev,
          [doctor.doctorId]: schedule,
        }));
      } catch {
        schedule = null;
        setDoctorSchedules((prev) => ({ ...prev, [doctor.doctorId]: null }));
      }
    }

    if (!canBookFromSchedule(schedule)) {
      toast.error("Booking is not available for this doctor right now.");
      return;
    }

    setSelectedDoctor(doctor);
    setShowBookingModal(true);
  };

  useEffect(() => {
    const doctorIdParam = searchParams.get("doctorId");
    const shouldBook = searchParams.get("book") === "1";

    if (!doctorIdParam || !shouldBook || doctors.length === 0 || !token) {
      return;
    }

    const doctorId = Number(doctorIdParam);
    if (!Number.isFinite(doctorId)) {
      return;
    }

    const matchedDoctor = doctors.find(
      (doctor) => doctor.doctorId === doctorId,
    );
    if (!matchedDoctor) {
      return;
    }

    handleBookAppointment(matchedDoctor);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("book");
    setSearchParams(nextParams, { replace: true });
  }, [doctors, token, searchParams, setSearchParams]);

  const handleBookingSuccess = (bookingResult) => {
    toast.success("Appointment booked successfully!");
    fetchDoctors();

    // Redirect users to their appointments after local booking completion.
    // Pay-now gateway callbacks are handled by the payment success route.
    closeBookingModal();
    navigate("/patient/appointments");
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-600">Loading doctors...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchDoctors}
            className="bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2 rounded-full"
          >
            Retry
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const uniqueSpecializations = [
    ...new Set(
      doctors
        .map((d) => d.specialization || "General Practice")
        .filter(Boolean),
    ),
  ].sort();

  const uniqueLocations = [
    ...new Set(doctors.map((d) => d.location).filter(Boolean)),
  ].sort();

  return (
    <DashboardLayout>
      <div>
        {/* Header */}
        <div className="mb-4 md:mb-6">
          <h1 className="app-page-title">My Doctors</h1>
        </div>

        {/* Filter Bar */}
        <div ref={filterBarRef} className="mb-4 md:mb-6">
          <div className="md:hidden">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search doctor"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-full focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setOpenDropdown(
                      openDropdown === "mobileSettings"
                        ? null
                        : "mobileSettings",
                    )
                  }
                  className={`h-9 w-9 rounded-full border inline-flex items-center justify-center transition-colors ${
                    specializationFilter !== "all" ||
                    locationFilter !== "all" ||
                    availabilityFilter !== "all" ||
                    sortBy !== "name"
                      ? "border-primary-300 bg-primary-50 text-primary-700"
                      : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                  aria-label="Open doctor filter settings"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </button>

                {openDropdown === "mobileSettings" && (
                  <div className="absolute top-full right-0 mt-2 w-[min(92vw,22rem)] bg-white border border-gray-200 rounded-xl shadow-lg z-20 p-3 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-2">
                        Filters
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={specializationFilter}
                          onChange={(e) =>
                            setSpecializationFilter(e.target.value)
                          }
                          className="border border-gray-300 rounded-lg px-2.5 py-2 text-xs text-gray-700 focus:ring-2 focus:ring-primary-500 outline-none"
                        >
                          <option value="all">Any specialization</option>
                          {uniqueSpecializations.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>

                        <select
                          value={locationFilter}
                          onChange={(e) => setLocationFilter(e.target.value)}
                          className="border border-gray-300 rounded-lg px-2.5 py-2 text-xs text-gray-700 focus:ring-2 focus:ring-primary-500 outline-none"
                        >
                          <option value="all">Any location</option>
                          {uniqueLocations.map((l) => (
                            <option key={l} value={l}>
                              {l}
                            </option>
                          ))}
                        </select>

                        <select
                          value={availabilityFilter}
                          onChange={(e) =>
                            setAvailabilityFilter(e.target.value)
                          }
                          className="col-span-2 border border-gray-300 rounded-lg px-2.5 py-2 text-xs text-gray-700 focus:ring-2 focus:ring-primary-500 outline-none"
                        >
                          <option value="all">Any availability</option>
                          <option value="today">Today</option>
                          <option value="tomorrow">Tomorrow</option>
                          <option value="next3">Next 3 days</option>
                          <option value="thisWeek">This week</option>
                          <option value="next7">Next 7 days</option>
                        </select>

                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value)}
                          className="col-span-2 border border-gray-300 rounded-lg px-2.5 py-2 text-xs text-gray-700 focus:ring-2 focus:ring-primary-500 outline-none"
                        >
                          <option value="name">Sort by Name</option>
                          <option value="specialization">
                            Sort by Specialization
                          </option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="hidden md:flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-0 w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name, specialization, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-full focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>

            {/* Filter chips */}
            <div className="flex gap-2 flex-wrap items-center">
              {/* Specialization */}
              <div className="relative">
                <button
                  onClick={() =>
                    setOpenDropdown(
                      openDropdown === "specialization"
                        ? null
                        : "specialization",
                    )
                  }
                  className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-full border whitespace-nowrap ${
                    specializationFilter !== "all"
                      ? "bg-primary-50 border-primary-300 text-primary-700"
                      : "border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {specializationFilter === "all"
                    ? "Specialization"
                    : specializationFilter}
                  {specializationFilter !== "all" ? (
                    <X
                      className="w-3.5 h-3.5 ml-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSpecializationFilter("all");
                      }}
                    />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
                {openDropdown === "specialization" && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[200px] py-1 max-h-60 overflow-y-auto">
                    {[
                      { value: "all", label: "Any specialization" },
                      ...uniqueSpecializations.map((s) => ({
                        value: s,
                        label: s,
                      })),
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setSpecializationFilter(opt.value);
                          setOpenDropdown(null);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${
                          specializationFilter === opt.value
                            ? "text-primary-600 font-medium"
                            : "text-gray-700"
                        }`}
                      >
                        {opt.label}
                        {specializationFilter === opt.value && (
                          <Check className="w-3.5 h-3.5" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Location */}
              <div className="relative">
                <button
                  onClick={() =>
                    setOpenDropdown(
                      openDropdown === "location" ? null : "location",
                    )
                  }
                  className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-full border whitespace-nowrap ${
                    locationFilter !== "all"
                      ? "bg-primary-50 border-primary-300 text-primary-700"
                      : "border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {locationFilter === "all" ? "Location" : locationFilter}
                  {locationFilter !== "all" ? (
                    <X
                      className="w-3.5 h-3.5 ml-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocationFilter("all");
                      }}
                    />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
                {openDropdown === "location" && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[180px] py-1 max-h-60 overflow-y-auto">
                    {[
                      { value: "all", label: "Any location" },
                      ...uniqueLocations.map((l) => ({ value: l, label: l })),
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setLocationFilter(opt.value);
                          setOpenDropdown(null);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${
                          locationFilter === opt.value
                            ? "text-primary-600 font-medium"
                            : "text-gray-700"
                        }`}
                      >
                        {opt.label}
                        {locationFilter === opt.value && (
                          <Check className="w-3.5 h-3.5" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Availability */}
              <div className="relative">
                <button
                  onClick={() =>
                    setOpenDropdown(
                      openDropdown === "availability" ? null : "availability",
                    )
                  }
                  className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-full border whitespace-nowrap ${
                    availabilityFilter !== "all"
                      ? "bg-primary-50 border-primary-300 text-primary-700"
                      : "border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {availabilityFilter === "all"
                    ? "Available"
                    : availabilityFilter === "today"
                      ? "Today"
                      : availabilityFilter === "tomorrow"
                        ? "Tomorrow"
                        : availabilityFilter === "next3"
                          ? "Next 3 days"
                          : availabilityFilter === "thisWeek"
                            ? "This week"
                            : "Next 7 days"}
                  {availabilityFilter !== "all" ? (
                    <X
                      className="w-3.5 h-3.5 ml-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAvailabilityFilter("all");
                      }}
                    />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
                {openDropdown === "availability" && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[190px] py-1">
                    {[
                      { value: "all", label: "Any availability" },
                      { value: "today", label: "Today" },
                      { value: "tomorrow", label: "Tomorrow" },
                      { value: "next3", label: "Next 3 days" },
                      { value: "thisWeek", label: "This week" },
                      { value: "next7", label: "Next 7 days" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setAvailabilityFilter(opt.value);
                          setOpenDropdown(null);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${
                          availabilityFilter === opt.value
                            ? "text-primary-600 font-medium"
                            : "text-gray-700"
                        }`}
                      >
                        {opt.label}
                        {availabilityFilter === opt.value && (
                          <Check className="w-3.5 h-3.5" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Sort */}
              <div className="relative">
                <button
                  onClick={() =>
                    setOpenDropdown(openDropdown === "sort" ? null : "sort")
                  }
                  className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 whitespace-nowrap"
                >
                  {sortBy === "name" ? "Name" : "Specialization"}
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {openDropdown === "sort" && (
                  <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[180px] py-1">
                    {[
                      { value: "name", label: "Sort by Name" },
                      {
                        value: "specialization",
                        label: "Sort by Specialization",
                      },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setSortBy(opt.value);
                          setOpenDropdown(null);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${
                          sortBy === opt.value
                            ? "text-primary-600 font-medium"
                            : "text-gray-700"
                        }`}
                      >
                        {opt.label}
                        {sortBy === opt.value && (
                          <Check className="w-3.5 h-3.5" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Doctor Cards Grid */}
        {filteredDoctors.length === 0 ? (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-12 text-center">
            <Stethoscope className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {searchQuery.trim() ||
              specializationFilter !== "all" ||
              locationFilter !== "all" ||
              availabilityFilter !== "all"
                ? "No doctors found matching your filters."
                : "No active doctors available at the moment."}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-gray-600">
              Found {filteredDoctors.length}{" "}
              {filteredDoctors.length === 1 ? "doctor" : "doctors"}
            </div>
            {availabilityLoading && availabilityFilter !== "all" && (
              <div className="mb-4 text-sm text-gray-500">
                Checking doctor availability...
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredDoctors.map((doctor) => {
                const badge = getAvailabilityBadge(
                  doctorSchedules[doctor.doctorId],
                );
                const canBookDoctor = canBookFromSchedule(
                  doctorSchedules[doctor.doctorId],
                );
                return (
                  <div
                    key={doctor.doctorId}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-primary-200 flex flex-col"
                  >
                    {/* Colored header band */}
                    <div className="bg-gradient-to-br from-primary-600 to-primary-500 px-5 pt-5 pb-7 relative">
                      <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-white/20 text-white border border-white/30">
                        <span
                          className={`w-1.5 h-1.5 rounded-full inline-block ${badge.dotClass}`}
                        ></span>
                        {badge.text}
                      </span>
                      <div className="flex items-center gap-3">
                        <AvatarCircle
                          profile={doctor}
                          sizeClassName="w-14 h-14"
                          textClassName="text-xl"
                          className="ring-2 ring-white/30 flex-shrink-0"
                          fallbackClassName="bg-white/20 text-white border border-white/30"
                          alt={
                            `Dr. ${doctor.firstName || ""} ${doctor.lastName || ""}`.trim() ||
                            "Doctor"
                          }
                        />
                        <div className="min-w-0">
                          <h3 className="text-white font-bold text-base leading-tight truncate">
                            Dr. {doctor.firstName} {doctor.lastName}
                          </h3>
                          <p className="text-primary-100 text-sm mt-0.5 truncate">
                            {doctor.specialization || "General Practice"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="px-5 pt-4 pb-5 flex-1 flex flex-col">
                      <div className="space-y-2.5 flex-1">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <StarRating
                            rating={Math.round(getAverageRating(doctor))}
                            size="sm"
                          />
                          <span className="font-medium text-amber-700">
                            {getAverageRating(doctor).toFixed(1)} (
                            {getTotalRatings(doctor)})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="truncate">
                            {doctor.location || "Location not specified"}
                          </span>
                        </div>
                        {doctor.yearOfExperience && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span>
                              {doctor.yearOfExperience} yrs experience
                            </span>
                          </div>
                        )}
                        {doctor.phoneNumber && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="truncate">
                              {doctor.phoneNumber}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="mt-4 pt-3 border-t border-gray-100 flex gap-2">
                        <button
                          onClick={() => handleBookAppointment(doctor)}
                          disabled={!canBookDoctor}
                          className={`flex-1 text-white text-sm font-semibold py-2 rounded-full ${
                            canBookDoctor
                              ? "bg-primary-600 hover:bg-primary-700"
                              : "bg-gray-400 cursor-not-allowed"
                          }`}
                        >
                          {canBookDoctor ? "Book" : "Unavailable"}
                        </button>
                        <button
                          onClick={() => handleCardClick(doctor)}
                          className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 rounded-full"
                          title="View full profile"
                        >
                          Profile
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Doctor Details Modal */}
      {selectedDoctor && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              showBookingModal ? closeBookingModal() : closeDoctorDetails();
            }
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl max-w-4xl w-full h-[85vh] max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            {!showBookingModal ? (
              <div className="h-full flex flex-col">
                {/* Gradient header banner */}
                <div className="bg-gradient-to-br from-primary-700 to-primary-500 px-6 pt-6 pb-8 relative">
                  <button
                    onClick={closeDoctorDetails}
                    className="absolute top-4 right-4 text-white/70 hover:text-white"
                  >
                    <X className="w-6 h-6" />
                  </button>
                  <div className="flex items-center gap-4">
                    <AvatarCircle
                      profile={selectedDoctor}
                      sizeClassName="w-20 h-20"
                      textClassName="text-3xl"
                      className="ring-4 ring-white/30 flex-shrink-0"
                      fallbackClassName="bg-white/20 text-white border border-white/30"
                      alt={
                        `Dr. ${selectedDoctor.firstName || ""} ${selectedDoctor.lastName || ""}`.trim() ||
                        "Doctor"
                      }
                    />
                    <div className="min-w-0">
                      <h2 className="text-2xl font-bold text-white leading-tight">
                        Dr. {selectedDoctor.firstName} {selectedDoctor.lastName}
                      </h2>
                      <p className="text-primary-100 mt-0.5">
                        {selectedDoctor.specialization || "General Practice"}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {(() => {
                          const badge = getAvailabilityBadge(doctorSchedule);
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 text-white text-xs rounded-full border border-white/30">
                              <span
                                className={`w-1.5 h-1.5 rounded-full inline-block ${badge.dotClass}`}
                              ></span>
                              {badge.text}
                            </span>
                          );
                        })()}
                        {selectedDoctor.consultationFee && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 text-white text-xs rounded-full border border-white/30">
                            <span className="font-semibold">৳</span>
                            {selectedDoctor.consultationFee} consultation fee
                          </span>
                        )}
                        {selectedDoctor.yearOfExperience && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 text-white text-xs rounded-full border border-white/30">
                            <Calendar className="w-3 h-3" />
                            {selectedDoctor.yearOfExperience} yrs exp.
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 text-white text-xs rounded-full border border-white/30">
                          Rating: {getAverageRating(selectedDoctor).toFixed(1)}{" "}
                          ({getTotalRatings(selectedDoctor)})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal body */}
                <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                  {/* Contact & Location */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      Contact & Location
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <div className="w-8 h-8 bg-primary-50 rounded-full flex items-center justify-center flex-shrink-0">
                          <Phone className="w-4 h-4 text-primary-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-gray-400">Phone</p>
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {selectedDoctor.phoneNumber || "Not provided"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <div className="w-8 h-8 bg-primary-50 rounded-full flex items-center justify-center flex-shrink-0">
                          <Mail className="w-4 h-4 text-primary-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-gray-400">Email</p>
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {selectedDoctor.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 border border-gray-100 sm:col-span-2">
                        <div className="w-8 h-8 bg-primary-50 rounded-full flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-4 h-4 text-primary-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-gray-400">Location</p>
                          <p className="text-sm font-medium text-gray-800">
                            {selectedDoctor.location || "Not specified"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Professional */}
                  {selectedDoctor.yearOfExperience && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        Professional Details
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedDoctor.yearOfExperience && (
                          <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 border border-gray-100">
                            <div className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0">
                              <Award className="w-4 h-4 text-green-600" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">
                                Experience
                              </p>
                              <p className="text-sm font-medium text-gray-800">
                                {selectedDoctor.yearOfExperience} years
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Reviews */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      Patient Reviews
                    </h3>

                    {loadingSelectedDoctorReviews ? (
                      <div className="text-sm text-gray-400 bg-gray-50 rounded-lg p-4 text-center border border-gray-100">
                        Loading reviews...
                      </div>
                    ) : selectedDoctorReviews.length === 0 ? (
                      <div className="text-sm text-gray-400 bg-gray-50 rounded-lg p-4 text-center border border-gray-100">
                        No reviews yet
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedDoctorReviews
                          .slice(0, 6)
                          .map((review, idx) => (
                            <div
                              key={`${review.appointmentId || "review"}-${idx}`}
                              className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-gray-800">
                                  {review.patientName || "Anonymous Patient"}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {review.ratedAt
                                    ? new Date(
                                        review.ratedAt,
                                      ).toLocaleDateString("en-US", {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric",
                                      })
                                    : ""}
                                </p>
                              </div>
                              <p className="mt-1 text-xs font-semibold text-amber-700">
                                Rating: {Number(review.rating) || 0}/5
                              </p>
                              <p className="mt-1 text-sm text-gray-700">
                                {review.reviewText?.trim() ||
                                  "No written comment."}
                              </p>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Weekly Availability */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Weekly Availability
                    </h3>
                    {scheduleLoading ? (
                      <div className="text-sm text-gray-400 py-4 text-center">
                        Loading schedule...
                      </div>
                    ) : (
                      (() => {
                        const DAY_NAMES = [
                          "Mon",
                          "Tue",
                          "Wed",
                          "Thu",
                          "Fri",
                          "Sat",
                          "Sun",
                        ];
                        const slots = doctorSchedule?.weeklySchedules ?? [];
                        const byDay = DAY_NAMES.map((name, i) => ({
                          name,
                          day: i + 1,
                          slots: slots.filter(
                            (s) => s.dayOfWeek === i + 1 && s.isAvailable,
                          ),
                        }));
                        const hasAny = byDay.some((d) => d.slots.length > 0);
                        if (!hasAny) {
                          return (
                            <div className="text-sm text-gray-400 bg-gray-50 rounded-lg p-4 text-center border border-gray-100">
                              No schedule published yet
                            </div>
                          );
                        }
                        return (
                          <div className="overflow-x-auto -mx-1 px-1">
                            <div className="grid grid-cols-7 gap-1 min-w-[560px]">
                              {byDay.map(({ name, slots: daySlots }) => (
                                <div
                                  key={name}
                                  className={`rounded-lg p-2 text-center flex flex-col items-center gap-1 border ${
                                    daySlots.length > 0
                                      ? "bg-primary-50 border-primary-200"
                                      : "bg-gray-50 border-gray-100"
                                  }`}
                                >
                                  <span
                                    className={`text-xs font-semibold ${daySlots.length > 0 ? "text-primary-700" : "text-gray-400"}`}
                                  >
                                    {name}
                                  </span>
                                  {daySlots.length > 0 ? (
                                    daySlots.map((s, idx) => (
                                      <span
                                        key={idx}
                                        className="text-xs text-primary-600 leading-tight whitespace-nowrap"
                                      >
                                        {s.startTime}–{s.endTime}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-xs text-gray-300">
                                      —
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                </div>

                {/* Profile footer action (aligned with booking subview action position) */}
                <div className="border-t border-gray-100 px-6 py-4 bg-white">
                  {(() => {
                    const canBookDoctor = canBookFromSchedule(doctorSchedule);
                    return (
                      <button
                        onClick={() => handleBookAppointment(selectedDoctor)}
                        disabled={scheduleLoading || !canBookDoctor}
                        className={`w-full text-white font-semibold py-3 rounded-xl text-sm ${
                          !scheduleLoading && canBookDoctor
                            ? "bg-primary-600 hover:bg-primary-700"
                            : "bg-gray-400 cursor-not-allowed"
                        }`}
                      >
                        {scheduleLoading
                          ? "Checking availability..."
                          : canBookDoctor
                            ? "Book"
                            : "Booking Not Available"}
                      </button>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <BookAppointmentModal
                doctor={selectedDoctor}
                onClose={closeBookingModal}
                onSuccess={handleBookingSuccess}
                isEmbedded
              />
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default FindDoctor;

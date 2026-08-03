import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { getPublicStats } from "../utils/api";
import Footer from "../components/Footer";
import usePageMeta from "../hooks/usePageMeta";
import { trackEvent } from "../utils/analytics";

/* ── Feature data ── */
const features = [
  {
    title: "Online Consultations",
    body: "Connect with verified doctors via chat, audio, or video — from anywhere.",
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
        />
      </svg>
    ),
  },
  {
    title: "Smart Health Records",
    body: "Upload medical reports, track history, and access prescriptions anytime.",
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
        />
      </svg>
    ),
  },
  {
    title: "E-Prescriptions",
    body: "Receive digital prescriptions and track your medication history effortlessly.",
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75"
        />
      </svg>
    ),
  },
];

const howItWorks = [
  {
    step: "1",
    title: "Search Doctor",
    desc: "Find the right specialist for your needs",
  },
  {
    step: "2",
    title: "Book Appointment",
    desc: "Choose your preferred time slot",
  },
  {
    step: "3",
    title: "Get Consultation",
    desc: "Connect via video, audio, or chat",
  },
];

const DEFAULT_STATS = [
  { number: "...", label: "Verified Doctors" },
  { number: "...", label: "Happy Patients" },
  { number: "24/7", label: "Online Support" },
  { number: "100%", label: "Secure & Private" },
];

const Home = () => {
  usePageMeta({
    title: "VitaBridge | Digital Healthcare Platform",
    description:
      "Book appointments with verified doctors, consult online, and manage health records securely with VitaBridge.",
  });

  const [stats, setStats] = useState(DEFAULT_STATS);

  useEffect(() => {
    let isActive = true;

    getPublicStats()
      .then((data) => {
        if (!isActive) return;
        setStats([
          { number: `${data.doctorCount}+`, label: "Verified Doctors" },
          { number: `${data.patientCount}+`, label: "Happy Patients" },
          { number: "24/7", label: "Online Support" },
          { number: "100%", label: "Secure & Private" },
        ]);
      })
      .catch(() => {
        // keep defaults on error
      });

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div className="page-shell">
      {/* ── Hero Section ── */}
      <section className="bg-primary-600">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:py-20 md:py-24 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            {/* Left content */}
            <div className="text-white">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium fade-in">
                <span className="h-2 w-2 rounded-full bg-success-400 animate-pulse" />
                Trusted Healthcare Platform
              </div>

              <h1 className="mt-6 text-4xl font-extrabold leading-tight sm:text-5xl md:text-6xl">
                Your Health,
                <br />
                <span className="text-accent-300">Connected</span> Digitally
              </h1>

              <p className="mt-5 max-w-lg text-lg text-white/80 leading-relaxed">
                Book appointments with verified doctors, consult online via
                video or chat, and manage your health records — all in one
                place.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/doctors"
                  className="btn-secondary bg-white px-6 py-3 font-bold text-primary-700"
                  onClick={() =>
                    trackEvent("home_find_doctor_click", { section: "hero" })
                  }
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  Find a Doctor
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 rounded-lg border-2 border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
                  onClick={() =>
                    trackEvent("home_create_account_click", { section: "hero" })
                  }
                >
                  Create Account
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                    />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Right - Visual element */}
            <div className="hidden lg:flex items-center justify-center">
              <div className="relative">
                <div className="h-80 w-80 rounded-full bg-white/10 flex items-center justify-center">
                  <div className="h-60 w-60 rounded-full bg-white/10 flex items-center justify-center">
                    <div className="text-center">
                      <svg
                        className="mx-auto h-20 w-20 text-white/80"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                        />
                      </svg>
                      <p className="mt-3 text-xl font-bold text-white">
                        VitaBridge
                      </p>
                      <p className="text-sm text-white/60">
                        Healthcare, Reimagined
                      </p>
                    </div>
                  </div>
                </div>
                {/* Floating cards */}
                <div
                  className="hidden lg:block absolute -left-10.5 top-8 rounded-lg border border-gray-100 bg-white p-3 shadow-lg fade-in"
                  style={{ animationDelay: "200ms" }}
                >
                  <div className="flex items-center gap-1.5">
                    <div className="h-8 w-8 rounded-full bg-success-100 flex items-center justify-center">
                      <svg
                        className="h-4 w-4 text-success-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-800">
                        Appointment Booked
                      </p>
                      <p className="text-[10px] text-gray-500">
                        Dr. Emam Hassan — 2:00 PM
                      </p>
                    </div>
                  </div>
                </div>
                <div
                  className="hidden lg:block absolute -right-7 bottom-6 rounded-lg border border-gray-100 bg-white p-3 shadow-lg fade-in"
                  style={{ animationDelay: "400ms" }}
                >
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-info-100 flex items-center justify-center">
                      <svg
                        className="h-4 w-4 text-info-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-800">
                        Video Consultation
                      </p>
                      <p className="text-[10px] text-gray-500">
                        Live with your doctor
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section className="bg-primary-700">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-extrabold text-white sm:text-3xl">
                  {s.number}
                </div>
                <div className="mt-1 text-sm text-white/60">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="bg-white section-shell sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              How It Works
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-gray-500">
              Get started in 3 simple steps
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {howItWorks.map((item, i) => (
              <div
                key={item.step}
                className="text-center fade-in"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-xl font-bold text-white">
                  {item.step}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section className="bg-gray-50 section-shell sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center">
            <span className="inline-block rounded-full bg-primary-100 px-4 py-1.5 text-xs font-semibold text-primary-700">
              Features
            </span>
            <h2 className="mt-4 text-3xl font-bold text-gray-900 sm:text-4xl">
              Why Choose <span className="text-primary-600">VitaBridge</span>?
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-gray-500">
              A simple workflow for appointments, consultations, records, and
              payments — designed for real-world clinics.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:gap-8 md:grid-cols-3">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="group card-surface card-hover fade-in"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary-50 text-primary-600 transition-colors duration-300 group-hover:bg-primary-100">
                  {f.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section className="bg-white section-shell sm:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            Ready to Get Started?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-gray-500">
            Join thousands of patients who trust VitaBridge for their healthcare
            needs.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/register"
              className="btn-primary w-full px-8 font-bold sm:w-auto"
              onClick={() =>
                trackEvent("home_create_account_click", { section: "cta" })
              }
            >
              Create Free Account
            </Link>
            <Link
              to="/doctors"
              className="btn-secondary w-full px-8 sm:w-auto"
              onClick={() =>
                trackEvent("home_browse_doctors_click", { section: "cta" })
              }
            >
              Browse Doctors
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Home;

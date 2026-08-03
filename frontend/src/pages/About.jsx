import Footer from "../components/Footer";
import usePageMeta from "../hooks/usePageMeta";

const cards = [
  {
    title: "Secure & Private",
    text: "End-to-end encryption and HIPAA-compliant security ensure your health data remains private and protected.",
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
          d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
        />
      </svg>
    ),
  },
  {
    title: "Expert Care Team",
    text: "Connect with verified, experienced healthcare professionals who are dedicated to your well-being.",
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
          d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
        />
      </svg>
    ),
  },
  {
    title: "Smart Technology",
    text: "AI-powered insights and seamless integrations make healthcare management faster and more efficient.",
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
          d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
        />
      </svg>
    ),
  },
];

export default function About() {
  usePageMeta({
    title: "About VitaBridge | Connected Healthcare",
    description:
      "Learn about VitaBridge's mission, secure healthcare platform, expert care team, and patient-first digital services.",
  });

  return (
    <main className="page-shell">
      {/* Header */}
      <section className="page-hero">
        <div className="page-hero-inner">
          <h1 className="page-title">
            About <span className="text-white">VitaBridge</span>
          </h1>
          <p className="page-subtitle">
            A comprehensive digital healthcare platform connecting patients,
            doctors, and healthcare teams through secure, intelligent
            technology.
          </p>
        </div>
      </section>

      {/* Cards */}
      <section className="section-shell bg-gray-50">
        <div className="section-container">
          <div className="grid gap-5 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => (
              <div key={c.title} className="group card-surface card-hover">
                <div className="icon-chip mb-4 transition-colors group-hover:bg-primary-100">
                  {c.icon}
                </div>
                <h3 className="text-base font-semibold text-gray-900">
                  {c.title}
                </h3>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                  {c.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="section-shell bg-white">
        <div className="section-container">
          <div className="rounded-xl bg-primary-50 p-8 sm:p-10 border border-primary-100">
            <h2 className="text-2xl font-bold text-gray-900">Our Mission</h2>
            <p className="mt-4 text-base leading-relaxed text-gray-600">
              At VitaBridge, we believe healthcare should be accessible,
              efficient, and patient-centered. Our platform bridges the gap
              between patients and healthcare providers, making it easier to
              manage appointments, medical records, and consultations — all in
              one secure place.
            </p>
            <p className="mt-3 text-base leading-relaxed text-gray-600">
              We empower patients to take control of their health journey while
              providing doctors and medical staff with powerful tools to deliver
              exceptional care. Together, we're building the future of
              healthcare.
            </p>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}

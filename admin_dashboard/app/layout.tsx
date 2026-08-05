import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://attendance-dashboard.up.railway.app"),
  title: {
    default: "GeoAttend Attendance System — Admin Dashboard",
    template: "%s | GeoAttend",
  },
  description:
    "GeoAttend is a geofencing-based attendance management system for universities. Track student attendance with GPS geofences, manage courses, classrooms, lecturers and sessions from one dashboard.",
  keywords: [
    "attendance system",
    "geofencing",
    "student attendance",
    "university attendance",
    "classroom management",
    "GeoAttend",
  ],
  openGraph: {
    title: "GeoAttend Attendance System",
    description:
      "Geofencing-based attendance management for universities — sessions, classrooms and student check-ins.",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

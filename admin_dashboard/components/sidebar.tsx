"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  GraduationCap,
  MapPin,
  BookOpen,
  UserSquare2,
  Users,
  Shield,
  FileSpreadsheet,
  UserCircle,
  PlayCircle,
  History,
  Clock,
  LineChart,
  AlertTriangle,
  Download,
  Upload,
  UserRound,
} from "lucide-react";

import { cn } from "@/lib/utils";

type SidebarProps = {
  role: "admin" | "lecturer" | "hod";
  open: boolean;
  onNavigate?: () => void;
};

const adminLinks = [
  { title: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: BarChart3 }] },
  {
    title: "Management",
    items: [
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/groups", label: "Groups", icon: Shield },
      { href: "/admin/departments", label: "Departments", icon: Building2 },
      { href: "/admin/courses", label: "Courses", icon: BookOpen },
      { href: "/admin/classrooms", label: "Classrooms", icon: MapPin },
      { href: "/admin/lecturers", label: "Lecturers", icon: UserRound },
    ],
  },
  {
    title: "Tools",
    items: [{ href: "/admin/users/import", label: "Import Users", icon: FileSpreadsheet }],
  },
  { title: "Account", items: [{ href: "/admin/profile", label: "Profile", icon: UserCircle }] },
];

const lecturerLinks = [
  { title: "Overview", items: [{ href: "/lecturer", label: "Dashboard", icon: BarChart3 }] },
  {
    title: "Sessions",
    items: [
      { href: "/lecturer/sessions", label: "My Sessions", icon: Clock },
      { href: "/lecturer/start", label: "Start Session", icon: PlayCircle },
      { href: "/lecturer/history", label: "History", icon: History },
    ],
  },
  { title: "Account", items: [{ href: "/lecturer/profile", label: "Profile", icon: UserCircle }] },
];

const hodLinks = [
  { title: "Overview", items: [{ href: "/hod", label: "Dashboard", icon: BarChart3 }] },
  {
    title: "Reports",
    items: [
      { href: "/hod/reports", label: "Session Reports", icon: LineChart },
      { href: "/hod/compliance", label: "Compliance", icon: AlertTriangle },
    ],
  },
  {
    title: "Export",
    items: [
      { href: "/hod/export", label: "Download Reports", icon: Download },
      { href: "/hod/upload", label: "Upload Ledger", icon: Upload },
    ],
  },
  { title: "Account", items: [{ href: "/hod/profile", label: "Profile", icon: UserCircle }] },
];

const roleMap = {
  admin: { label: "Admin Console", links: adminLinks },
  lecturer: { label: "Lecturer Dashboard", links: lecturerLinks },
  hod: { label: "HOD Dashboard", links: hodLinks },
};

export function Sidebar({ role, open, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const config = roleMap[role];

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-72 -translate-x-full border-r border-slate-200 bg-white shadow-xl transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none",
        open && "translate-x-0",
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b px-6">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">A</div>
        <div>
          <p className="font-semibold">Attendance System</p>
          <p className="text-xs text-muted-foreground">{config.label}</p>
        </div>
      </div>
      <nav className="space-y-6 p-4">
        {config.links.map((group) => (
          <div key={group.title}>
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{group.title}</p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950",
                      active && "bg-primary/10 text-primary shadow-sm",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}

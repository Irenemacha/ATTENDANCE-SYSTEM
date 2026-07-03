"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FileSpreadsheet, Shield, UserCircle, Users } from "lucide-react";

import { cn } from "@/lib/utils";

const groups = [
  {
    title: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: BarChart3 }],
  },
  {
    title: "Administration",
    items: [
      { href: "/users", label: "Users", icon: Users },
      { href: "/groups", label: "Groups", icon: Shield },
      { href: "/users/import", label: "Import Users", icon: FileSpreadsheet },
    ],
  },
  {
    title: "Account",
    items: [{ href: "/profile", label: "Profile", icon: UserCircle }],
  },
];

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();

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
          <p className="text-xs text-muted-foreground">Admin Console</p>
        </div>
      </div>
      <nav className="space-y-6 p-4">
        {groups.map((group) => (
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

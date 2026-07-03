"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { BarChart3, FileSpreadsheet, LogOut, Shield, UserCircle, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api, clearSession, getStoredUser, User } from "@/lib/api";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/users", label: "Users", icon: Users },
  { href: "/groups", label: "Groups", icon: Shield },
  { href: "/users/import", label: "Import", icon: FileSpreadsheet },
  { href: "/profile", label: "Profile", icon: UserCircle },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(getStoredUser());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api
      .get<User>("/auth/me/")
      .then((response) => {
        if (!response.data.is_staff && !response.data.is_superuser) {
          clearSession();
          router.replace("/login");
          return;
        }
        localStorage.setItem("user", JSON.stringify(response.data));
        setUser(response.data);
        setReady(true);
      })
      .catch(() => {
        clearSession();
        router.replace("/login");
      });
  }, [router]);

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-r bg-card p-4">
        <div className="mb-6">
          <p className="text-lg font-semibold">Attendance Admin</p>
          <p className="text-sm text-muted-foreground">{user?.username}</p>
        </div>
        <nav className="grid gap-1">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted",
                  pathname === item.href && "bg-muted font-medium",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Button
          className="mt-6 w-full"
          variant="outline"
          onClick={() => {
            clearSession();
            router.replace("/login");
          }}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </aside>
      <main className="p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

import { LoadingSkeleton } from "@/components/loading-skeleton";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { api, clearSession, getStoredUser, getRoleHomePath, User } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

export function HODShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) {
      router.replace("/login");
      return;
    }
    api
      .get<User>("/auth/me/")
      .then((response) => {
        const u = response.data;
        const groups = u.groups.map((g) => g.toLowerCase());
        if (!groups.includes("hod")) {
          clearSession();
          router.replace(getRoleHomePath(u));
          return;
        }
        setUser(u);
        setReady(true);
      })
      .catch(() => {
        clearSession();
        router.replace("/login");
      });
  }, [router, setUser]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <LoadingSkeleton className="hidden h-[calc(100vh-3rem)] lg:block" />
          <div className="space-y-6">
            <LoadingSkeleton className="h-16" />
            <LoadingSkeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[288px_1fr]">
      {sidebarOpen && <button className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}
      <Sidebar role="hod" open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
      <div className="min-w-0">
        <Topbar user={user} onMenu={() => setSidebarOpen(true)} />
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

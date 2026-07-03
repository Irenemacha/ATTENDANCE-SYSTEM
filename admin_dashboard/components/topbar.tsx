"use client";

import { Bell, LogOut, Menu, Moon, Search } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearSession, User } from "@/lib/api";

function initials(user: User | null) {
  const label = user?.full_name || user?.username || "Admin";
  return label
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function Topbar({ user, onMenu }: { user: User | null; onMenu: () => void }) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Button size="icon" variant="ghost" className="lg:hidden" onClick={onMenu} aria-label="Open navigation">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="relative hidden flex-1 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="max-w-md rounded-full bg-slate-50 pl-9" placeholder="Search users, groups, permissions" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="icon" variant="ghost" aria-label="Toggle theme">
            <Moon className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </Button>
          <div className="hidden items-center gap-3 rounded-full border bg-white py-1 pl-1 pr-3 shadow-sm sm:flex">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {initials(user)}
            </div>
            <div className="leading-tight">
              <p className="text-sm font-medium">{user?.full_name || user?.username}</p>
              <p className="text-xs text-muted-foreground">{user?.role_display}</p>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Logout"
            onClick={() => {
              clearSession();
              router.replace("/login");
            }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}

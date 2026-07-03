"use client";

import { useEffect, useState } from "react";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, User } from "@/lib/api";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    api.get<User>("/auth/me/").then((response) => setUser(response.data));
  }, []);

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-muted-foreground">Current authenticated admin user.</p>
      </div>
      <Card className="max-w-2xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>{user?.full_name || user?.username || "Loading..."}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <p><span className="font-medium">Username:</span> {user?.username}</p>
          <p><span className="font-medium">Email:</span> {user?.email || "not yet"}</p>
          <p><span className="font-medium">Role:</span> {user?.role_display || "not yet"}</p>
          <div className="flex gap-2">
            {(user?.groups.length ? user.groups : ["not yet"]).map((group) => <Badge key={group}>{group}</Badge>)}
          </div>
          <p><span className="font-medium">Staff:</span> {user?.is_staff ? "Yes" : "No"}</p>
          <p><span className="font-medium">Superuser:</span> {user?.is_superuser ? "Yes" : "No"}</p>
        </CardContent>
      </Card>
    </AdminShell>
  );
}

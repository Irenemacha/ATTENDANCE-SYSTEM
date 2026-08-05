"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, getRoleHomePath, saveSession, User } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await api.post<{ access: string; refresh: string; user: User }>("/auth/login/", {
        username,
        password,
      });
      const user = response.data.user;
      const groups = user.groups.map((g) => g.toLowerCase());

      if (groups.includes("lecturer") || groups.includes("hod")) {
        login(response.data.access, response.data.refresh, user);
        router.replace(getRoleHomePath(user));
        return;
      }

      if (!user.is_staff && !user.is_superuser) {
        setError("Access denied. Contact an administrator.");
        return;
      }

      login(response.data.access, response.data.refresh, user);
      router.replace(getRoleHomePath(user));
    } catch {
      setError("Invalid username or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md border-slate-200 shadow-xl">
        <CardHeader className="items-center text-center">
          <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">Attendance System</CardTitle>
          <p className="text-sm text-muted-foreground">Sign in to your dashboard</p>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={submit}>
            <Input placeholder="Username" value={username} onChange={(event) => setUsername(event.target.value)} />
            <Input
              placeholder="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button disabled={loading}>{loading ? "Signing in..." : "Login"}</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, saveSession, User } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
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
      if (!response.data.user.is_staff && !response.data.user.is_superuser) {
        setError("Only staff users can access the admin dashboard.");
        return;
      }
      saveSession(response.data.access, response.data.refresh, response.data.user);
      router.replace("/dashboard");
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
          <CardTitle className="text-2xl">Admin Login</CardTitle>
          <p className="text-sm text-muted-foreground">Staff and superusers only</p>
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

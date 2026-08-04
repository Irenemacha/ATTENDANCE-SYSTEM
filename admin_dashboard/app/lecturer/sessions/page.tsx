"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, PlayCircle, StopCircle, Users } from "lucide-react";

import { LecturerShell } from "@/components/lecturer-shell";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

type SessionInfo = {
  session_id: number;
  course: string;
  subject: string;
  date: string;
  active: boolean;
  total_students: number;
  present: number;
  late: number;
  absent: number;
  percentage: number;
};

export default function LecturerSessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<SessionInfo | null>(null);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  async function load() {
    try {
      const res = await api.get<{ sessions: SessionInfo[] }>("/attendance/lecturer/dashboard/");
      const data = res.data?.sessions ?? [];
      setSessions(data);
      const active = data.find((s) => s.active);
      setActiveSession(active ?? null);
    } catch {
      // ignore
    }
    setLoading(false);
  }

  async function endSession(sessionId: number) {
    if (!confirm("End this session?")) return;
    await api.post("/attendance/end-session/", { session_id: sessionId });
    await load();
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <LecturerShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Sessions</h1>
          <p className="text-muted-foreground">Manage your active and past sessions.</p>
        </div>
        <Button onClick={() => router.push("/lecturer/start")}>
          <PlayCircle className="mr-2 h-4 w-4" /> Start New Session
        </Button>
      </div>

      {activeSession && (
        <Card className="mb-6 border-emerald-200 bg-emerald-50 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-800">
              <div className="h-3 w-3 animate-pulse rounded-full bg-emerald-500" />
              Active Session
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div><p className="text-sm text-emerald-700">Course</p><p className="text-lg font-semibold">{activeSession.course}</p></div>
              <div><p className="text-sm text-emerald-700">Subject</p><p className="text-lg font-semibold">{activeSession.subject}</p></div>
              <div><p className="text-sm text-emerald-700">Present / Total</p><p className="text-lg font-semibold">{activeSession.present} / {activeSession.total_students}</p></div>
              <div className="flex items-end">
                <Button variant="destructive" onClick={() => endSession(activeSession.session_id)}>
                  <StopCircle className="mr-2 h-4 w-4" /> End Session
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? <LoadingSkeleton className="h-64" /> : (
        <div className="grid gap-4">
          {sessions.length === 0 ? (
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <Clock className="h-12 w-12 text-muted-foreground" />
                <p className="text-lg font-medium">No sessions yet</p>
                <p className="text-sm text-muted-foreground">Start your first session to see it here.</p>
                <Button onClick={() => router.push("/lecturer/start")}>
                  <PlayCircle className="mr-2 h-4 w-4" /> Start Session
                </Button>
              </CardContent>
            </Card>
          ) : sessions.map((s) => (
            <Card key={s.session_id} className="border-slate-200 shadow-sm">
              <CardContent className="flex items-center justify-between py-4">
                <div className="grid gap-1">
                  <p className="font-semibold">{s.course} - {s.subject}</p>
                  <p className="text-sm text-muted-foreground">{formatDate(s.date)}</p>
                  <div className="flex gap-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {s.total_students}</span>
                    <span className="text-emerald-600">{s.present} present</span>
                    <span className="text-amber-600">{s.late} late</span>
                    <span className="text-red-600">{s.absent} absent</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Attendance</p>
                    <p className={`text-lg font-bold ${s.percentage >= 75 ? "text-emerald-600" : s.percentage >= 50 ? "text-amber-600" : "text-red-600"}`}>
                      {s.percentage}%
                    </p>
                  </div>
                  {s.active && (
                    <Button size="sm" variant="destructive" onClick={() => endSession(s.session_id)}>
                      <StopCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </LecturerShell>
  );
}

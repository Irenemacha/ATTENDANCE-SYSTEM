"use client";

import { useEffect, useState } from "react";
import { BarChart3, BookOpen, Users, AlertTriangle, Clock } from "lucide-react";

import { HODShell } from "@/components/hod-shell";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, HODDashboard } from "@/lib/api";

export default function HODDashboardPage() {
  const [data, setData] = useState<HODDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<HODDashboard>("/attendance/hod/dashboard/")
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <HODShell>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <LoadingSkeleton key={i} className="h-28" />)}
        </div>
      </HODShell>
    );
  }

  const metrics = data ? [
    { label: "Total Sessions", value: data.total_sessions, icon: BookOpen },
    { label: "Active Sessions", value: data.active_sessions, icon: Clock },
    { label: "Total Attendance", value: data.total_attendance, icon: Users },
    { label: "Low Attendance Alerts", value: data.low_attendance_alerts?.length ?? 0, icon: AlertTriangle },
  ] : [];

  return (
    <HODShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">HOD Dashboard</h1>
        <p className="text-muted-foreground">Department: {data?.department ?? "Loading..."}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => <StatCard key={m.label} {...m} />)}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader><CardTitle>Course Attendance</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data?.courses?.map((c) => (
              <div key={c.course} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">{c.course}</p>
                  <p className="text-sm text-muted-foreground">{c.total_sessions} sessions</p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${c.percentage >= 75 ? "text-emerald-600" : c.percentage >= 50 ? "text-amber-600" : "text-red-600"}`}>
                    {c.percentage}%
                  </p>
                  <p className="text-xs text-muted-foreground">{c.present}/{c.total_attendance}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader><CardTitle>Low Attendance Alerts</CardTitle></CardHeader>
            <CardContent>
              {data?.low_attendance_alerts?.length ? data.low_attendance_alerts.map((alert, i) => (
                <div key={i} className="mb-2 flex items-center justify-between rounded-lg border border-red-100 bg-red-50 p-3">
                  <div>
                    <p className="font-medium text-red-800">{alert.course}</p>
                    <p className="text-sm text-red-600">{alert.lecturer}</p>
                  </div>
                  <Badge className="bg-red-100 text-red-700">{alert.percentage}%</Badge>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">No low attendance alerts.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader><CardTitle>Delay Analysis</CardTitle></CardHeader>
            <CardContent>
              {data?.delay_analysis?.length ? data.delay_analysis.map((d, i) => (
                <div key={i} className="mb-2 flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{d.lecturer}</p>
                    <p className="text-sm text-muted-foreground">{d.late_starts} late starts</p>
                  </div>
                  <Badge>{d.average_delay_minutes} min avg</Badge>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">No delay data available.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </HODShell>
  );
}

"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Clock, UserRound } from "lucide-react";

import { HODShell } from "@/components/hod-shell";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, HODDashboard } from "@/lib/api";

export default function HODCompliancePage() {
  const [data, setData] = useState<HODDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<HODDashboard>("/attendance/hod/dashboard/")
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <HODShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Compliance Monitoring</h1>
        <p className="text-muted-foreground">Track low attendance and late starts across your department.</p>
      </div>

      {loading ? <LoadingSkeleton className="h-64" /> : (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Low Attendance Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data?.low_attendance_alerts?.length ? data.low_attendance_alerts.map((alert, i) => (
                <div key={i} className="rounded-lg border border-red-100 bg-red-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-red-800">{alert.course}</p>
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <UserRound className="h-3 w-3" /> {alert.lecturer}
                      </p>
                    </div>
                    <Badge className="bg-red-100 text-red-700 text-base">{alert.percentage}%</Badge>
                  </div>
                  {alert.percentage < 50 && (
                    <p className="mt-2 text-sm font-medium text-red-700">⚠ Critical - Immediate attention required</p>
                  )}
                </div>
              )) : (
                <div className="rounded-lg border bg-emerald-50 p-4 text-emerald-700">
                  <p className="font-medium">All sessions have good attendance</p>
                  <p className="text-sm">No low attendance alerts to display.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" />
                Late Start Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data?.delay_analysis?.length ? data.delay_analysis.map((d, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">{d.lecturer}</p>
                    <p className="text-sm text-muted-foreground">{d.late_starts} late start{d.late_starts !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-amber-600">{d.average_delay_minutes}m</p>
                    <p className="text-xs text-muted-foreground">avg delay</p>
                  </div>
                </div>
              )) : (
                <div className="rounded-lg border bg-emerald-50 p-4 text-emerald-700">
                  <p className="font-medium">No late start issues</p>
                  <p className="text-sm">All sessions started on time.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm xl:col-span-2">
            <CardHeader>
              <CardTitle>Compliance Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border bg-white p-4 text-center">
                  <p className="text-3xl font-bold text-emerald-600">{data?.courses?.filter((c) => c.percentage >= 75).length ?? 0}</p>
                  <p className="text-sm text-muted-foreground">Courses Compliant (&ge;75%)</p>
                </div>
                <div className="rounded-xl border bg-white p-4 text-center">
                  <p className="text-3xl font-bold text-amber-600">{data?.courses?.filter((c) => c.percentage >= 50 && c.percentage < 75).length ?? 0}</p>
                  <p className="text-sm text-muted-foreground">Courses At Risk (50-74%)</p>
                </div>
                <div className="rounded-xl border bg-white p-4 text-center">
                  <p className="text-3xl font-bold text-red-600">{data?.courses?.filter((c) => c.percentage < 50).length ?? 0}</p>
                  <p className="text-sm text-muted-foreground">Courses Critical (&lt;50%)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </HODShell>
  );
}

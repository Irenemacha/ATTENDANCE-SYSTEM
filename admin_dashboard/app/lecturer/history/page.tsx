"use client";

import { useEffect, useState } from "react";
import { History, Users, Download } from "lucide-react";

import { LecturerShell } from "@/components/lecturer-shell";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
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

export default function LecturerHistoryPage() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ sessions: SessionInfo[] }>("/attendance/lecturer/dashboard/")
      .then((res) => setSessions((res.data?.sessions ?? []).filter((s) => !s.active)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }

  async function downloadReport(sessionId: number) {
    try {
      const res = await api.get(`/attendance/session-report/${sessionId}/`);
      const records = (res.data as any)?.records ?? [];
      const csv = [
        ["Student ID", "Name", "Registration", "Status", "Check In", "Check Out"],
        ...records.map((r: any) => [r.student_id, r.name, r.registration, r.status, r.check_in ?? "", r.check_out ?? ""]),
      ].map((row) => row.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `session-${sessionId}-report.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }

  return (
    <LecturerShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Session History</h1>
        <p className="text-muted-foreground">View past sessions and attendance records.</p>
      </div>

      {loading ? <LoadingSkeleton className="h-64" /> : sessions.length === 0 ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <History className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">No past sessions</p>
            <p className="text-sm text-muted-foreground">Completed sessions will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="pt-6">
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Course</Th>
                  <Th>Subject</Th>
                  <Th>Total</Th>
                  <Th>Present</Th>
                  <Th>Late</Th>
                  <Th>Absent</Th>
                  <Th>%</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.session_id}>
                    <Td>{formatDate(s.date)}</Td>
                    <Td className="font-medium">{s.course}</Td>
                    <Td>{s.subject}</Td>
                    <Td>{s.total_students}</Td>
                    <Td><Badge className="bg-emerald-50 text-emerald-700">{s.present}</Badge></Td>
                    <Td><Badge className="bg-amber-50 text-amber-700">{s.late}</Badge></Td>
                    <Td><Badge className="bg-red-50 text-red-700">{s.absent}</Badge></Td>
                    <Td><span className={`font-semibold ${s.percentage >= 75 ? "text-emerald-600" : s.percentage >= 50 ? "text-amber-600" : "text-red-600"}`}>{s.percentage}%</span></Td>
                    <Td>
                      <Button size="sm" variant="outline" onClick={() => downloadReport(s.session_id)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      )}
    </LecturerShell>
  );
}

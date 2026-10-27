"use client";

import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, History, Search } from "lucide-react";

import { LecturerShell } from "@/components/lecturer-shell";
import { EmptyState } from "@/components/empty-state";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [exporting, setExporting] = useState(false);

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

  const filtered = sessions.filter((s) => {
    const day = s.date?.slice(0, 10) ?? "";
    if (startDate && day < startDate) return false;
    if (endDate && day > endDate) return false;

    const q = search.trim().toLowerCase();
    if (!q) return true;
    const pct = String(s.percentage);
    const rawDate = s.date?.toLowerCase() ?? "";
    const prettyDate = formatDate(s.date).toLowerCase();
    return (
      s.course?.toLowerCase().includes(q) ||
      s.subject?.toLowerCase().includes(q) ||
      rawDate.includes(q) ||
      prettyDate.includes(q) ||
      pct === q ||
      `${pct}%` === q
    );
  });

  function downloadFile(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportRows() {
    return [
      ["Date", "Course", "Subject", "Total", "Present", "Late", "Absent", "Percentage"],
      ...filtered.map((s) => [
        s.date, s.course, s.subject, s.total_students, s.present, s.late, s.absent, s.percentage,
      ]),
    ];
  }

  function downloadSessions(format: "csv" | "excel") {
    setExporting(true);
    const run = async () => {
      const rows = exportRows();
      if (format === "excel") {
        const XLSX = await import("xlsx");
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Sessions");
        const out = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        downloadFile(
          new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
          "session-history.xlsx",
        );
      } else {
        const csv = rows
          .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
          .join("\n");
        downloadFile(new Blob([csv], { type: "text/csv" }), "session-history.csv");
      }
    };
    run().catch(() => {}).finally(() => setExporting(false));
  }

  async function downloadReport(sessionId: number) {
    try {
      const res = await api.get(`/attendance/session-report/${sessionId}/`);
      const records = (res.data as any)?.records ?? [];
      const csv = [
        ["Student ID", "Name", "Registration", "Status", "Check In", "Check Out"],
        ...records.map((r: any) => [r.student_id, r.name, r.registration, r.status, r.check_in ?? "", r.check_out ?? ""]),
      ].map((row) => row.join(",")).join("\n");
      downloadFile(new Blob([csv], { type: "text/csv" }), `session-${sessionId}-report.csv`);
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
            <div className="mb-4 grid gap-3 lg:grid-cols-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by course, subject, date, or %"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <input
                  type="date"
                  className="flex h-10 rounded-xl border bg-background px-3 text-sm"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  title="From date"
                />
                <input
                  type="date"
                  className="flex h-10 rounded-xl border bg-background px-3 text-sm"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  title="To date"
                />
                <Button size="sm" variant="outline" onClick={() => downloadSessions("csv")} disabled={filtered.length === 0}>
                  <Download className="mr-2 h-4 w-4" /> Export CSV
                </Button>
                <Button size="sm" variant="outline" onClick={() => downloadSessions("excel")} disabled={filtered.length === 0 || exporting}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Excel
                </Button>
              </div>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon={History}
                title="No sessions found"
                description="Adjust your search or date range."
              />
            ) : (
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
                  {filtered.map((s) => (
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
            )}
          </CardContent>
        </Card>
      )}
    </LecturerShell>
  );
}

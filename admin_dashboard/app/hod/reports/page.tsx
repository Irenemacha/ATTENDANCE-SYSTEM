"use client";

import { useEffect, useState } from "react";
import { LineChart, Download, Search } from "lucide-react";

import { HODShell } from "@/components/hod-shell";
import { EmptyState } from "@/components/empty-state";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { api, HODReportResponse, HODReportSession } from "@/lib/api";

type ReportOverview = {
  total_sessions: number;
  total_records: number;
  total_attended: number;
  overall_percentage: number;
};

export default function HODReportsPage() {
  const [sessions, setSessions] = useState<HODReportSession[]>([]);
  const [department, setDepartment] = useState<string | null>(null);
  const [overview, setOverview] = useState<ReportOverview | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  function load() {
    setLoading(true);
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    api.get<HODReportResponse>("/attendance/hod/report/", { params })
      .then((res) => {
        setSessions(res.data?.sessions ?? []);
        setDepartment(res.data?.department ?? null);
        setOverview(res.data?.overview);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [startDate, endDate]);

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
    });
  }

  const filtered = sessions.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const pct = String(s.percentage);
    const rawDate = s.date?.toLowerCase() ?? "";
    const prettyDate = formatDate(s.date).toLowerCase();
    return (
      s.course?.toLowerCase().includes(q) ||
      s.subject?.toLowerCase().includes(q) ||
      s.lecturer?.toLowerCase().includes(q) ||
      rawDate.includes(q) ||
      prettyDate.includes(q) ||
      pct === q ||
      `${pct}%` === q
    );
  });

  function downloadCSV() {
    const header = ["Course", "Course Code", "Subject", "Lecturer", "Date", "Total", "Present", "Late", "Absent", "Attended", "Percentage"];
    const body = filtered.map((s) => [
      s.course, s.course_code, s.subject, s.lecturer, s.date,
      s.total, s.present, s.late, s.absent, s.attended, s.percentage,
    ]);
    const csv = [header, ...body].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${department || "department"}-session-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <HODShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Session Reports</h1>
          <p className="text-muted-foreground">
            {department ? `${department} session attendance` : "Department session attendance"} — search by date, name, or %.
          </p>
        </div>
        <Button onClick={downloadCSV} disabled={filtered.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      {overview && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Sessions" value={overview.total_sessions} icon={LineChart} />
          <StatCard label="Students (records)" value={overview.total_records} icon={LineChart} />
          <StatCard label="Attended" value={overview.total_attended} icon={LineChart} />
          <StatCard label="Overall Attendance" value={`${overview.overall_percentage}%`} icon={LineChart} />
        </div>
      )}

      <Card className="mt-6 border-slate-200 shadow-sm">
        <CardContent className="pt-6">
          <div className="mb-4 grid gap-3 lg:grid-cols-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by course, subject, lecturer, date, or %"
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
            </div>
          </div>

          {loading ? <LoadingSkeleton className="h-64" /> : filtered.length === 0 ? (
            <EmptyState icon={LineChart} title="No reports found" description="Adjust your search or wait for session data." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Course</Th>
                  <Th>Subject</Th>
                  <Th>Lecturer</Th>
                  <Th>Date</Th>
                  <Th>Total</Th>
                  <Th>Present</Th>
                  <Th>Late</Th>
                  <Th>Absent</Th>
                  <Th>%</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.session_id}>
                    <Td className="font-medium">
                      {s.course} <span className="font-mono text-muted-foreground">({s.course_code})</span>
                    </Td>
                    <Td>{s.subject}</Td>
                    <Td>{s.lecturer}</Td>
                    <Td>{formatDate(s.date)}</Td>
                    <Td>{s.total}</Td>
                    <Td><Badge className="bg-emerald-50 text-emerald-700">{s.present}</Badge></Td>
                    <Td><Badge className="bg-amber-50 text-amber-700">{s.late}</Badge></Td>
                    <Td><Badge className="bg-red-50 text-red-700">{s.absent}</Badge></Td>
                    <Td>
                      <span className={`font-semibold ${s.percentage >= 75 ? "text-emerald-600" : "text-amber-600"}`}>
                        {s.percentage}%
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </HODShell>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Download, LineChart, Search } from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { api, AdminReportOverview, AdminReportSession, Course, User } from "@/lib/api";

export default function AdminReportsPage() {
  const [overview, setOverview] = useState<AdminReportOverview | null>(null);
  const [sessions, setSessions] = useState<AdminReportSession[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [lecturerFilter, setLecturerFilter] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<{ overview: AdminReportOverview; sessions: AdminReportSession[] }>("/attendance/admin-report/").catch(() => null),
      api.get<Course[]>("/courses/").catch(() => ({ data: [] })),
      api.get<{ results?: User[] }>("/user-management/users/?group=Lecturer&page_size=100").catch(() => ({ data: { results: [] } })),
    ]).then(([report, c]) => {
      if (report?.data) {
        setOverview(report.data.overview);
        setSessions(report.data.sessions ?? []);
      }
      setCourses(Array.isArray(c.data) ? c.data : (c.data as any)?.results ?? []);
      setLoading(false);
    });
  }, []);

  const filtered = sessions.filter((s) => {
    const query = search.toLowerCase();
    const matchesSearch =
      !query ||
      s.course.toLowerCase().includes(query) ||
      s.subject.toLowerCase().includes(query) ||
      s.lecturer.toLowerCase().includes(query);
    const matchesCourse = !courseFilter || s.course_code === courseFilter;
    const matchesLecturer = !lecturerFilter || s.lecturer === lecturerFilter;
    return matchesSearch && matchesCourse && matchesLecturer;
  });

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
    });
  }

  function downloadCSV() {
    const csv = [
      ["Course", "Subject", "Lecturer", "Date", "Total", "Present", "Late", "Absent", "Percentage"],
      ...filtered.map((s) => [
        s.course, s.subject, s.lecturer, s.date, s.total, s.present, s.late, s.absent, s.percentage,
      ]),
    ].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "attendance-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <AdminShell>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <LoadingSkeleton key={i} className="h-28" />)}
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Attendance Reports</h1>
          <p className="text-muted-foreground">System-wide session attendance across all lecturers.</p>
        </div>
        <Button onClick={downloadCSV} disabled={filtered.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      {overview && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Sessions" value={overview.total_sessions} icon={LineChart} />
          <StatCard label="Active Sessions" value={overview.active_sessions} icon={LineChart} />
          <StatCard label="Attendance Records" value={overview.total_records} icon={LineChart} />
          <StatCard label="Overall Attendance" value={`${overview.overall_percentage}%`} icon={LineChart} />
        </div>
      )}

      <Card className="mt-6 border-slate-200 shadow-sm">
        <CardHeader><CardTitle>Sessions</CardTitle></CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-52">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search course, subject, or lecturer"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="flex h-10 rounded-xl border bg-background px-3 text-sm"
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
            >
              <option value="">All courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.code}>{c.name} ({c.code})</option>
              ))}
            </select>
            <select
              className="flex h-10 rounded-xl border bg-background px-3 text-sm"
              value={lecturerFilter}
              onChange={(e) => setLecturerFilter(e.target.value)}
            >
              <option value="">All lecturers</option>
              {[...new Set(sessions.map((s) => s.lecturer))].map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={LineChart}
              title="No sessions found"
              description="Adjust your filters or wait for sessions to start."
            />
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
                  <Th>Status</Th>
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
                    <Td>
                      <Badge className={s.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}>
                        {s.active ? "Active" : "Ended"}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}

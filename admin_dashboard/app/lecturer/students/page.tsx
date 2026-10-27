"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, GraduationCap, LineChart, Search } from "lucide-react";

import { LecturerShell } from "@/components/lecturer-shell";
import { EmptyState } from "@/components/empty-state";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { api, StudentAttendance, StudentAttendanceResponse } from "@/lib/api";

type CourseOption = {
  id: number;
  name: string;
  code: string;
  subjects: { id: number; name: string; code: string }[];
};

export default function LecturerStudentsPage() {
  const [rows, setRows] = useState<StudentAttendance[]>([]);
  const [scope, setScope] = useState<{ course?: string; course_code?: string; subject?: string | null }>({});
  const [summary, setSummary] = useState({ total_students: 0, average_percentage: 0, critical_students: 0, total_sessions: 0 });
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const [courseId, setCourseId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get<CourseOption[]>("/attendance/lecturer/scope/")
      .then((res) => {
        const list = res.data ?? [];
        setCourses(list);
        if (list.length > 0) setCourseId(String(list[0].id));
      })
      .catch(() => setCourses([]));
  }, []);

  useEffect(() => {
    if (!courseId) { setLoading(false); return; }
    setLoading(true);
    setError("");
    const params: Record<string, string> = { course_id: courseId };
    if (subjectId) params.subject_id = subjectId;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    api
      .get<StudentAttendanceResponse>("/attendance/lecturer/students/", { params })
      .then((res) => {
        setRows(res.data?.students ?? []);
        setScope({ course: res.data?.course, course_code: res.data?.course_code, subject: res.data?.subject });
        setSummary({
          total_students: res.data?.summary?.total_students ?? 0,
          average_percentage: res.data?.summary?.average_percentage ?? 0,
          critical_students: res.data?.summary?.critical_students ?? 0,
          total_sessions: res.data?.summary?.total_sessions ?? 0,
        });
      })
      .catch((err) => {
        setRows([]);
        setError(err?.response?.data?.detail || "Unable to load student attendance.");
      })
      .finally(() => setLoading(false));
  }, [courseId, subjectId, startDate, endDate]);

  const subjectOptions = useMemo(
    () => courses.find((c) => String(c.id) === courseId)?.subjects ?? [],
    [courses, courseId],
  );

  const filtered = rows.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const pct = String(s.percentage);
    return (
      s.name?.toLowerCase().includes(q) ||
      s.registration?.toLowerCase().includes(q) ||
      pct === q ||
      `${pct}%` === q ||
      s.status?.toLowerCase() === q
    );
  });

  function downloadCSV() {
    const header = ["Name", "Registration", "Course", "Course Code", "Subject", "Attended", "Total Sessions", "Percentage", "Status"];
    const body = filtered.map((s) => [
      s.name, s.registration, s.course ?? "", s.course_code ?? "", scope.subject ?? "",
      s.attended, s.total_sessions, s.percentage, s.status,
    ]);
    const csv = [header, ...body].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${scope.course_code || "course"}-student-attendance.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadExcel() {
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const rows: (string | number)[][] = [
        ["Name", "Registration", "Course", "Course Code", "Subject", "Attended", "Total Sessions", "Percentage", "Status"],
        ...filtered.map((s) => [
          s.name, s.registration, s.course ?? "", s.course_code ?? "", scope.subject ?? "",
          s.attended, s.total_sessions, s.percentage, s.status,
        ]),
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Student Attendance");
      const out = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${scope.course_code || "course"}-student-attendance.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  if (courses.length === 0 && !loading) {
    return (
      <LecturerShell>
        <EmptyState
          icon={GraduationCap}
          title="No courses assigned"
          description="You are not assigned to any course yet."
        />
      </LecturerShell>
    );
  }

  return (
    <LecturerShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Student Attendance</h1>
          <p className="text-muted-foreground">
            {scope.course
              ? `${scope.subject ? `${scope.subject} · ` : ""}${scope.course} (${scope.course_code})`
              : "All students in your course and subject"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadExcel} disabled={filtered.length === 0 || exporting}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> {exporting ? "Exporting..." : "Export Excel"}
          </Button>
          <Button onClick={downloadCSV} disabled={filtered.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Students" value={summary.total_students} icon={GraduationCap} />
        <StatCard label="Average Attendance" value={`${summary.average_percentage}%`} icon={LineChart} />
        <StatCard label="Sessions Considered" value={summary.total_sessions} icon={LineChart} />
        <StatCard label="Critical (below 75%)" value={summary.critical_students} icon={GraduationCap} />
      </div>

      <Card className="mt-6 border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Students</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 lg:grid-cols-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by name, reg no, or % (e.g. 75)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <select
                className="flex h-10 rounded-xl border bg-background px-3 text-sm"
                value={courseId}
                onChange={(e) => { setCourseId(e.target.value); setSubjectId(""); }}
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
              <select
                className="flex h-10 rounded-xl border bg-background px-3 text-sm"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
              >
                <option value="">All subjects</option>
                {subjectOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
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

          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

          {loading ? (
            <LoadingSkeleton className="h-64" />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="No students found"
              description="Adjust your filters or search terms."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Reg No</Th>
                  <Th>Attended</Th>
                  <Th>Total</Th>
                  <Th>%</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.student_id}>
                    <Td className="font-medium">{s.name}</Td>
                    <Td className="font-mono">{s.registration}</Td>
                    <Td>{s.attended}</Td>
                    <Td>{s.total_sessions}</Td>
                    <Td>
                      <span className={`font-semibold ${s.percentage >= 75 ? "text-emerald-600" : s.percentage >= 50 ? "text-amber-600" : "text-red-600"}`}>
                        {s.percentage}%
                      </span>
                    </Td>
                    <Td>
                      <Badge className={s.status === "Fine" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}>
                        {s.status}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </LecturerShell>
  );
}

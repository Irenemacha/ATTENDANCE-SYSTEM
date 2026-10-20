"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, MapPin } from "lucide-react";

import { HODShell } from "@/components/hod-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, HODReportResponse, StudentAttendanceResponse } from "@/lib/api";

type Sheet = { name: string; rows: (string | number)[][] };

function toCSV(rows: (string | number)[][]) {
  return rows
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function HODExportPage() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  async function buildSheets(): Promise<Sheet[]> {
    const params: Record<string, string> = {};
    if (fromDate) params.start_date = fromDate;
    if (toDate) params.end_date = toDate;

    const [reportRes, studentsRes] = await Promise.all([
      api.get<HODReportResponse>("/attendance/hod/report/", { params }),
      api.get<StudentAttendanceResponse>("/attendance/hod/students/", { params }),
    ]);

    const sessionRows: (string | number)[][] = [
      ["Course", "Course Code", "Subject", "Lecturer", "Date", "Total", "Present", "Late", "Absent", "Attended", "Percentage"],
      ...(reportRes.data?.sessions ?? []).map((s) => [
        s.course, s.course_code, s.subject, s.lecturer, s.date,
        s.total, s.present, s.late, s.absent, s.attended, s.percentage,
      ]),
    ];

    const studentRows: (string | number)[][] = [
      ["Name", "Reg No", "Course", "Attended", "Total Sessions", "Percentage"],
      ...(studentsRes.data?.students ?? []).map((s) => [
        s.name, s.registration ?? "", s.course ?? "", s.attended, s.total_sessions, s.percentage,
      ]),
    ];

    return [
      { name: "Sessions", rows: sessionRows },
      { name: "Students", rows: studentRows },
    ];
  }

  async function run(format: "csv" | "excel") {
    setExporting(true);
    setError("");
    try {
      const sheets = await buildSheets();
      if (format === "excel") {
        const XLSX = await import("xlsx");
        const wb = XLSX.utils.book_new();
        for (const sheet of sheets) {
          XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet.rows), sheet.name);
        }
        const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        download(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "department-attendance-report.xlsx");
      } else {
        const csv = sheets.map((s) => `# ${s.name}\n${toCSV(s.rows)}`).join("\n\n");
        download(new Blob([csv], { type: "text/csv" }), "department-attendance-report.csv");
      }
    } catch {
      setError("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <HODShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Download Reports</h1>
        <p className="text-muted-foreground">Export department session and student attendance reports.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader><CardTitle>Filter by Date Range</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <label className="text-sm font-medium">From</label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div className="grid gap-1">
                <label className="text-sm font-medium">To</label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Leave dates empty to export all available data.</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader><CardTitle>Export Options</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> Scoped to your department.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button className="w-full" disabled={exporting} onClick={() => run("csv")}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {exporting ? "Exporting..." : "Download CSV"}
            </Button>
            <Button className="w-full" variant="outline" disabled={exporting} onClick={() => run("excel")}>
              <Download className="mr-2 h-4 w-4" />
              {exporting ? "Exporting..." : "Download Excel"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </HODShell>
  );
}

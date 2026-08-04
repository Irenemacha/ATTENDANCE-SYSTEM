"use client";

import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, Calendar } from "lucide-react";

import { HODShell } from "@/components/hod-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

export default function HODExportPage() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [exporting, setExporting] = useState(false);

  async function exportReport(format: "csv" | "excel") {
    setExporting(true);
    try {
      const params: Record<string, string> = {};
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;

      const res = await api.get("/attendance/report/", { params, responseType: "blob" });
      const blob = new Blob([res.data], {
        type: format === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance-report.${format === "csv" ? "csv" : "xlsx"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // fallback: generate from JSON
      const res = await api.get("/attendance/report/", { params: { from_date: fromDate, to_date: toDate } });
      const data = res.data as { sessions?: any[] };
      const sessions = data?.sessions ?? [];
      const csv = [
        ["Course", "Lecturer", "Date", "Total", "Present", "Absent", "Percentage"],
        ...sessions.map((s: any) => [s.course, s.lecturer, s.date, s.total, s.present, s.absent, s.percentage]),
      ].map((row) => row.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "attendance-report.csv";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <HODShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Download Reports</h1>
        <p className="text-muted-foreground">Export attendance reports as CSV or Excel.</p>
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
            <Button className="w-full" disabled={exporting} onClick={() => exportReport("csv")}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {exporting ? "Exporting..." : "Download CSV"}
            </Button>
            <Button className="w-full" variant="outline" disabled={exporting} onClick={() => exportReport("excel")}>
              <Download className="mr-2 h-4 w-4" />
              {exporting ? "Exporting..." : "Download Excel"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </HODShell>
  );
}

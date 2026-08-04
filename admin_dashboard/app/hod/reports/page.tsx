"use client";

import { useEffect, useState } from "react";
import { LineChart, Download, Search } from "lucide-react";

import { HODShell } from "@/components/hod-shell";
import { EmptyState } from "@/components/empty-state";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { api } from "@/lib/api";

type ReportSession = {
  session_id: number;
  course: string;
  lecturer: string;
  date: string;
  total: number;
  present: number;
  absent: number;
  percentage: number;
};

export default function HODReportsPage() {
  const [sessions, setSessions] = useState<ReportSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get("/attendance/report/")
      .then((res) => {
        const data = res.data as { sessions?: ReportSession[] };
        setSessions(data?.sessions ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
    });
  }

  const filtered = sessions.filter((s) =>
    !search || s.course.toLowerCase().includes(search.toLowerCase()) || s.lecturer.toLowerCase().includes(search.toLowerCase())
  );

  function downloadCSV() {
    const csv = [
      ["Course", "Lecturer", "Date", "Total", "Present", "Absent", "Percentage"],
      ...filtered.map((s) => [s.course, s.lecturer, s.date, s.total, s.present, s.absent, s.percentage]),
    ].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "attendance-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <HODShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Session Reports</h1>
          <p className="text-muted-foreground">View and export attendance reports.</p>
        </div>
        <Button onClick={downloadCSV}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-6">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by course or lecturer" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {loading ? <LoadingSkeleton className="h-64" /> : filtered.length === 0 ? (
            <EmptyState icon={LineChart} title="No reports found" description="Adjust your search or wait for session data." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Course</Th>
                  <Th>Lecturer</Th>
                  <Th>Date</Th>
                  <Th>Total</Th>
                  <Th>Present</Th>
                  <Th>Absent</Th>
                  <Th>%</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.session_id}>
                    <Td className="font-medium">{s.course}</Td>
                    <Td>{s.lecturer}</Td>
                    <Td>{formatDate(s.date)}</Td>
                    <Td>{s.total}</Td>
                    <Td><Badge className="bg-emerald-50 text-emerald-700">{s.present}</Badge></Td>
                    <Td><Badge className="bg-red-50 text-red-700">{s.absent}</Badge></Td>
                    <Td><span className={`font-semibold ${s.percentage >= 75 ? "text-emerald-600" : "text-amber-600"}`}>{s.percentage}%</span></Td>
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

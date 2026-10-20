"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { api, TimetableUploadSummary } from "@/lib/api";

const EXPECTED_COLUMNS = [
  { name: "course_code", example: "CS01", note: "Must match an existing course code" },
  { name: "lecturer", example: "jdoe", note: "Username of a lecturer account" },
  { name: "day", example: "MON", note: "MON-SUN or full day name" },
  { name: "start_time", example: "09:00", note: "24-hour format" },
  { name: "end_time", example: "11:00", note: "Must be after start_time" },
  { name: "room", example: "LH-101", note: "Room name or number" },
];

export default function UploadTimetablePage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<TimetableUploadSummary | null>(null);
  const [fileErrors, setFileErrors] = useState<string[]>([]);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setSummary(null);
    setFileErrors([]);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await api.post<TimetableUploadSummary>("/courses/timetable/upload/", form);
      setSummary(response.data);
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.errors?.length) {
        setFileErrors(data.errors.flatMap((item: { errors: string[] }) => item.errors));
      } else {
        setFileErrors([data?.detail || "Upload failed. Check the file and try again."]);
      }
    } finally {
      setUploading(false);
    }
  }

  const success = summary && summary.errors.length === 0;
  const partial = summary && summary.errors.length > 0;

  return (
    <AdminShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Upload Timetable</h1>
          <p className="text-muted-foreground">Upload an Excel file to create timetable entries in bulk.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/timetable">
            <ArrowLeft className="h-4 w-4" /> Back to Timetable
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader><CardTitle>Select Excel File</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center hover:bg-muted/50">
              <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">
                {file ? file.name : "Click to select Excel file"}
              </span>
              <span className="text-xs text-muted-foreground">.xlsx files only</span>
              <input
                type="file"
                accept=".xlsx,.xlsm"
                className="hidden"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setSummary(null);
                  setFileErrors([]);
                }}
              />
            </label>

            {fileErrors.length > 0 && (
              <div className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                {fileErrors.map((message, index) => (
                  <p key={index} className="flex items-start gap-2 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {message}
                  </p>
                ))}
              </div>
            )}

            <Button className="w-full" disabled={!file || uploading} onClick={handleUpload}>
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading..." : "Upload Timetable"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader><CardTitle>Expected Format</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <thead>
                <tr>
                  <Th>Column</Th>
                  <Th>Example</Th>
                  <Th>Notes</Th>
                </tr>
              </thead>
              <tbody>
                {EXPECTED_COLUMNS.map((column) => (
                  <tr key={column.name}>
                    <Td className="font-mono text-sm">{column.name}</Td>
                    <Td className="font-mono text-sm">{column.example}</Td>
                    <Td className="text-muted-foreground">{column.note}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <p className="mt-3 text-xs text-muted-foreground">
              The first row must contain the column names. Rows that fail validation are skipped and
              reported below; valid rows are still created.
            </p>
          </CardContent>
        </Card>
      </div>

      {(summary || fileErrors.length > 0) && (
        <Card className="mt-6 border-slate-200 shadow-sm">
          <CardHeader><CardTitle>Upload Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {success && (
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                Timetable processed successfully. {summary!.created_count} new{" "}
                {summary!.created_count === 1 ? "entry" : "entries"} created.
              </div>
            )}
            {partial && (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <AlertCircle className="h-4 w-4" />
                Some rows could not be imported. Valid rows were still created.
              </div>
            )}

            {summary && (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                    {summary.created_count} created
                  </Badge>
                  <Badge className="bg-sky-50 text-sky-700 hover:bg-sky-100">
                    {summary.updated_count} updated
                  </Badge>
                  <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-100">
                    {summary.skipped_count} skipped
                  </Badge>
                  <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200">
                    {summary.total_rows} rows in file
                  </Badge>
                </div>

                {summary.errors.length > 0 && (
                  <Table>
                    <thead>
                      <tr>
                        <Th>Row</Th>
                        <Th>Problems</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.errors.map((item, index) => (
                        <tr key={index}>
                          <Td className="font-mono">{item.row ?? "-"}</Td>
                          <Td className="text-destructive">{item.errors.join(" ")}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </>
            )}

            <Button asChild variant="outline">
              <Link href="/admin/timetable">View Timetable</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </AdminShell>
  );
}

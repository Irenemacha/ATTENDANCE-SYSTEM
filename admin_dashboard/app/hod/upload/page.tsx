"use client";

import { useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";

import { HODShell } from "@/components/hod-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

export default function HODUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function uploadLedger() {
    if (!file) return;
    setUploading(true);
    setError("");
    setSuccess("");
    try {
      const form = new FormData();
      form.append("file", file);
      // The ERP integration endpoint - adjust as needed
      await api.post("/students/dashboard/", form);
      setSuccess("Ledger uploaded successfully to the ERP system.");
      setFile(null);
    } catch {
      setError("Upload failed. Check the file format and try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <HODShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Upload Finalized Ledger</h1>
        <p className="text-muted-foreground">Upload finalized attendance ledgers to the university ERP system.</p>
      </div>

      <Card className="max-w-xl border-slate-200 shadow-sm">
        <CardHeader><CardTitle>Upload Ledger</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center hover:bg-muted/50">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium">{file ? file.name : "Click to select Excel/CSV file"}</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(""); setSuccess(""); }} />
          </label>

          <div className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
            <p className="font-medium">ERP Integration</p>
            <p>The finalized ledger will be sent to the university ERP system via the configured API.</p>
          </div>

          {error && <div className="flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" />{error}</div>}
          {success && <div className="flex items-center gap-2 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" />{success}</div>}

          <Button className="w-full" disabled={!file || uploading} onClick={uploadLedger}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            {uploading ? "Uploading..." : "Upload to ERP"}
          </Button>
        </CardContent>
      </Card>
    </HODShell>
  );
}

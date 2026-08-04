"use client";

import { useState } from "react";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown>[] | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handlePreview() {
    if (!file) return;
    setLoading(true);
    setError("");
    setSuccess("");
    const form = new FormData();
    form.append("file", file);
    try {
      const response = await api.post("/user-management/users/import/preview/", form);
      setPreview(response.data as Record<string, unknown>[]);
    } catch {
      setError("Failed to preview file. Check format.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("update_existing", "true");
      form.append("allow_partial", "true");
      await api.post("/user-management/users/import/commit/", form);
      setSuccess("Users imported successfully!");
      setPreview(null);
    } catch {
      setError("Import failed. Check file data.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Import Users</h1>
        <p className="text-muted-foreground">Bulk import users from Excel file.</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader><CardTitle>Upload File</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center hover:bg-muted/50">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">{file ? file.name : "Click to select Excel file"}</span>
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            {error && <div className="flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" />{error}</div>}
            {success && <div className="flex items-center gap-2 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" />{success}</div>}
            <div className="flex gap-2">
              <Button disabled={!file || loading} onClick={handlePreview}><FileSpreadsheet className="h-4 w-4" /> Preview</Button>
              <Button disabled={!preview || loading} onClick={handleCommit}><Upload className="h-4 w-4" /> Import</Button>
            </div>
          </CardContent>
        </Card>
        {preview && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader><CardTitle>Preview ({preview.length} rows)</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto text-sm">
                <pre className="max-h-96 overflow-auto rounded bg-muted p-4">{JSON.stringify(preview.slice(0, 10), null, 2)}</pre>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminShell>
  );
}

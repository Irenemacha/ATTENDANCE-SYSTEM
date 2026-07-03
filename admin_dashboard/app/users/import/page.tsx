"use client";

import { ChangeEvent, useState } from "react";
import { Upload } from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { api } from "@/lib/api";

type PreviewRow = {
  row: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  groups: string[];
  reg_number: string;
  course_code: string;
  year_of_study: string | number | null;
  errors: string[];
};

export default function ImportUsersPage() {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [errors, setErrors] = useState<unknown[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  async function preview(nextFile: File) {
    setFile(nextFile);
    setSummary(null);
    setLoading(true);
    const data = new FormData();
    data.append("file", nextFile);
    try {
      const response = await api.post<{ rows: PreviewRow[]; errors: unknown[] }>("/user-management/users/import/preview/", data);
      setRows(response.data.rows);
      setErrors(response.data.errors);
    } finally {
      setLoading(false);
    }
  }

  async function commit() {
    if (!file) return;
    setLoading(true);
    const data = new FormData();
    data.append("file", file);
    const response = await api.post<Record<string, unknown>>("/user-management/users/import/commit/", data);
    setSummary(response.data);
    setLoading(false);
  }

  const hasErrors = errors.length > 0 || rows.some((row) => row.errors.length > 0);

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Import Users</h1>
        <p className="text-muted-foreground">Upload Excel users, preview validation, then commit.</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center hover:bg-muted">
            <Upload className="mb-2 h-8 w-8" />
            <span className="font-medium">{file ? file.name : "Choose Excel file"}</span>
            <input
              className="hidden"
              type="file"
              accept=".xlsx,.xlsm"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const nextFile = event.target.files?.[0];
                if (nextFile) preview(nextFile);
              }}
            />
          </label>
          {loading && <p className="mt-4 text-sm text-muted-foreground">Working...</p>}
          {errors.length > 0 && <p className="mt-4 text-sm text-destructive">File validation errors were found.</p>}
          {rows.length > 0 && (
            <>
              <div className="mt-6 overflow-x-auto">
                <Table>
                  <thead>
                    <tr>
                      <Th>Row</Th>
                      <Th>Username</Th>
                      <Th>Name</Th>
                      <Th>Email</Th>
                      <Th>Groups</Th>
                      <Th>Student fields</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.row}>
                        <Td>{row.row}</Td>
                        <Td>{row.username}</Td>
                        <Td>{`${row.first_name} ${row.last_name}`}</Td>
                        <Td>{row.email}</Td>
                        <Td>{row.groups.join(", ") || "not yet"}</Td>
                        <Td>{[row.reg_number, row.course_code, row.year_of_study].filter(Boolean).join(" / ")}</Td>
                        <Td>
                          {row.errors.length ? (
                            <div className="grid gap-1 text-destructive">
                              {row.errors.map((error) => (
                                <span key={error}>{error}</span>
                              ))}
                            </div>
                          ) : (
                            <Badge>Ready</Badge>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              <Button className="mt-4" disabled={hasErrors || loading} onClick={commit}>
                Confirm import
              </Button>
            </>
          )}
          {summary && (
            <pre className="mt-6 overflow-auto rounded-md bg-muted p-4 text-sm">{JSON.stringify(summary, null, 2)}</pre>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}

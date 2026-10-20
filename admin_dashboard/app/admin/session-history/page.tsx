"use client";

import { useEffect, useState } from "react";
import { History, Search } from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { api, SessionChangeLog } from "@/lib/api";

const CHANGE_TYPES = [
  { value: "START", label: "Session Started" },
  { value: "OVERRIDE", label: "Override / Rescheduled" },
  { value: "END", label: "Session Ended" },
  { value: "AUTO_CLOSE", label: "Auto Closed" },
  { value: "TIMETABLE_CHANGE", label: "Timetable Changed" },
];

const CHANGE_TYPE_STYLES: Record<string, string> = {
  START: "bg-emerald-50 text-emerald-700",
  OVERRIDE: "bg-amber-50 text-amber-700",
  END: "bg-slate-100 text-slate-600",
  AUTO_CLOSE: "bg-sky-50 text-sky-700",
  TIMETABLE_CHANGE: "bg-violet-50 text-violet-700",
};

export default function SessionHistoryPage() {
  const [logs, setLogs] = useState<SessionChangeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  useEffect(() => {
    api
      .get<SessionChangeLog[]>("/attendance/session-history/")
      .then((res) => setLogs(Array.isArray(res.data) ? res.data : []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = logs.filter((log) => {
    const query = search.toLowerCase();
    const matchesSearch =
      !query ||
      log.course.toLowerCase().includes(query) ||
      log.subject.toLowerCase().includes(query) ||
      log.lecturer.toLowerCase().includes(query) ||
      (log.reason || "").toLowerCase().includes(query);
    const matchesType = !typeFilter || log.change_type === typeFilter;
    return matchesSearch && matchesType;
  });

  function formatDateTime(value: string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleString("en-US", {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Session Change History</h1>
        <p className="text-muted-foreground">
          Audit trail of the original timetable, actual session times, who made each change, the reason, and when.
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-52">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search course, subject, lecturer, or reason"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="flex h-10 rounded-xl border bg-background px-3 text-sm"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All changes</option>
              {CHANGE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <LoadingSkeleton className="h-64" />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={History}
              title="No changes recorded"
              description="Session starts, overrides, endings, and timetable edits will appear here."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Session</Th>
                  <Th>Change</Th>
                  <Th>Original Time</Th>
                  <Th>Actual Time</Th>
                  <Th>Changed By</Th>
                  <Th>Reason</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={log.id}>
                    <Td className="whitespace-nowrap text-sm">{formatDateTime(log.changed_at)}</Td>
                    <Td>
                      <div className="font-medium">{log.course}</div>
                      <div className="text-xs text-muted-foreground">
                        {log.subject} · {log.lecturer}
                      </div>
                    </Td>
                    <Td>
                      <Badge className={CHANGE_TYPE_STYLES[log.change_type] ?? "bg-slate-100 text-slate-600"}>
                        {log.change_type_display}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap font-mono text-xs">
                      {log.original_start_time || log.original_end_time ? (
                        <>
                          {formatDateTime(log.original_start_time)}
                          <br />
                          {log.original_end_time ? `to ${formatDateTime(log.original_end_time)}` : ""}
                        </>
                      ) : (
                        "-"
                      )}
                    </Td>
                    <Td className="whitespace-nowrap font-mono text-xs">
                      {log.actual_start_time || log.actual_end_time ? (
                        <>
                          {formatDateTime(log.actual_start_time)}
                          <br />
                          {log.actual_end_time ? `to ${formatDateTime(log.actual_end_time)}` : ""}
                        </>
                      ) : (
                        "-"
                      )}
                    </Td>
                    <Td>{log.changed_by}</Td>
                    <Td className="text-muted-foreground">{log.reason || "-"}</Td>
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

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Upload } from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { api, Course, TimetableEntry } from "@/lib/api";
import { TIMETABLE_DAYS, dayLabel, formatTime } from "@/lib/timetable";

export default function TimetablePage() {
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [dayFilter, setDayFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<TimetableEntry[]>("/courses/timetable/").catch(() => ({ data: [] })),
      api.get<Course[]>("/courses/").catch(() => ({ data: [] })),
    ]).then(([t, c]) => {
      setEntries(Array.isArray(t.data) ? t.data : []);
      setCourses(Array.isArray(c.data) ? c.data : (c.data as any)?.results ?? []);
      setLoading(false);
    });
  }, []);

  const filtered = entries.filter(
    (entry) =>
      (!dayFilter || entry.day === dayFilter) &&
      (!courseFilter || entry.course === Number(courseFilter)),
  );

  return (
    <AdminShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Timetable</h1>
          <p className="text-muted-foreground">View the weekly class timetable.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/timetable/manage">
              <CalendarDays className="h-4 w-4" /> Manage
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/timetable/upload">
              <Upload className="h-4 w-4" /> Upload Timetable
            </Link>
          </Button>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap gap-3">
            <select
              className="flex h-10 rounded-xl border bg-background px-3 text-sm"
              value={dayFilter}
              onChange={(e) => setDayFilter(e.target.value)}
            >
              <option value="">All days</option>
              {TIMETABLE_DAYS.map((d) => (
                <option key={d.code} value={d.code}>{d.label}</option>
              ))}
            </select>
            <select
              className="flex h-10 rounded-xl border bg-background px-3 text-sm"
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
            >
              <option value="">All courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>

          {loading ? (
            <LoadingSkeleton className="h-64" />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No timetable entries"
              description="Upload an Excel file or add entries from the Manage page."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Day</Th>
                  <Th>Course</Th>
                  <Th>Lecturer</Th>
                  <Th>Time</Th>
                  <Th>Room</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr key={entry.id}>
                    <Td>
                      <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200">
                        {dayLabel(entry.day)}
                      </Badge>
                    </Td>
                    <Td className="font-medium">
                      {entry.course_name} <span className="font-mono text-muted-foreground">({entry.course_code})</span>
                    </Td>
                    <Td>{entry.lecturer_username}</Td>
                    <Td className="font-mono">
                      {formatTime(entry.start_time)} - {formatTime(entry.end_time)}
                    </Td>
                    <Td>{entry.room}</Td>
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

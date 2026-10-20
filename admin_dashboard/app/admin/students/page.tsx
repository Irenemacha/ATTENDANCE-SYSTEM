"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Search } from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { api, Course, User } from "@/lib/api";

export default function StudentsPage() {
  const [students, setStudents] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<{ results?: User[] }>("/user-management/users/?group=Student&page_size=100").catch(() => ({ data: { results: [] } })),
      api.get<Course[]>("/courses/").catch(() => ({ data: [] })),
    ]).then(([s, c]) => {
      setStudents(Array.isArray(s.data) ? s.data : (s.data as any)?.results ?? []);
      setCourses(Array.isArray(c.data) ? c.data : (c.data as any)?.results ?? []);
      setLoading(false);
    });
  }, []);

  const filtered = students.filter((student) => {
    const query = search.toLowerCase();
    const profile = student.profile;
    const matchesSearch =
      !query ||
      (student.full_name || student.username).toLowerCase().includes(query) ||
      student.username.toLowerCase().includes(query) ||
      (profile.reg_number || "").toLowerCase().includes(query);
    const matchesCourse = !courseFilter || profile.course === courseFilter;
    return matchesSearch && matchesCourse;
  });

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Students</h1>
        <p className="text-muted-foreground">View all registered students and their programme details.</p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-52">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search name, username, or reg number"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="flex h-10 rounded-xl border bg-background px-3 text-sm"
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
            >
              <option value="">All courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.name}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>

          {loading ? (
            <LoadingSkeleton className="h-64" />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="No students found"
              description="Create student users or adjust your filters."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Student</Th>
                  <Th>Reg Number</Th>
                  <Th>Course</Th>
                  <Th>Department</Th>
                  <Th>Year</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((student) => (
                  <tr key={student.id}>
                    <Td className="font-medium">
                      {student.full_name || student.username}{" "}
                      <span className="font-mono text-muted-foreground">({student.username})</span>
                    </Td>
                    <Td className="font-mono">{student.profile.reg_number || "-"}</Td>
                    <Td>
                      {student.profile.course ? (
                        <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200">
                          {student.profile.course}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </Td>
                    <Td className="text-muted-foreground">{student.profile.department || "-"}</Td>
                    <Td className="font-mono">{student.profile.year_of_study ?? "-"}</Td>
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

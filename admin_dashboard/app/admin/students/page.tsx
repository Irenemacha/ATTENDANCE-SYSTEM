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

type AdminAttendanceRow = {
  student_id: number;
  username?: string | null;
  name: string;
  registration: string;
  course: string | null;
  course_id?: number | null;
  course_code?: string | null;
  department?: string | null;
  year_of_study?: number | null;
  email?: string | null;
  attended?: number;
  total_sessions?: number;
  percentage?: number;
  status?: string;
};

type StudentRow = AdminAttendanceRow;

function userToRow(student: User): StudentRow {
  const profile = student.profile;
  return {
    student_id: student.id,
    username: student.username,
    name: student.full_name || student.username,
    registration: profile.reg_number || "-",
    course: profile.course ?? null,
    department: profile.department ?? null,
    year_of_study: profile.year_of_study ?? null,
  };
}

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [percentagesAvailable, setPercentagesAvailable] = useState(false);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [attendance, courseResponse] = await Promise.all([
        api
          .get<{ students: AdminAttendanceRow[] }>("/attendance/admin/students/")
          .then((res) => res.data)
          .catch(() => null),
        api.get<Course[]>("/courses/").catch(() => null),
      ]);

      if (cancelled) return;

      const courseData = Array.isArray(courseResponse?.data)
        ? courseResponse.data
        : (courseResponse?.data as { results?: Course[] } | undefined)?.results ?? [];
      setCourses(courseData);

      if (attendance && Array.isArray(attendance.students)) {
        setStudents(attendance.students);
        setPercentagesAvailable(true);
        setLoading(false);
        return;
      }

      // Older backend deployments do not expose the admin attendance endpoint
      // yet. Fall back to the user list so the page keeps working.
      const users = await api
        .get<{ results?: User[] } | User[]>(
          "/user-management/users/?group=Student&page_size=100"
        )
        .then((res) => res.data)
        .catch(() => null);

      if (cancelled) return;

      const userData = Array.isArray(users) ? users : users?.results ?? [];
      setStudents(userData.map(userToRow));
      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = students.filter((student) => {
    const query = search.toLowerCase();
    const matchesSearch =
      !query ||
      student.name.toLowerCase().includes(query) ||
      (student.username || "").toLowerCase().includes(query) ||
      (student.registration || "").toLowerCase().includes(query);

    const selectedCourse = courses.find((course) => String(course.id) === courseFilter);
    const matchesCourse =
      !courseFilter ||
      (student.course_id != null && String(student.course_id) === courseFilter) ||
      (student.course_id == null && student.course === selectedCourse?.name);

    return matchesSearch && matchesCourse;
  });

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Students</h1>
        <p className="text-muted-foreground">
          View all registered students, their programme details, and attendance percentage.
        </p>
        {!loading && students.length > 0 && !percentagesAvailable ? (
          <p className="mt-2 text-xs text-amber-600">
            Attendance summaries are unavailable from this backend deployment. Showing the student directory instead.
          </p>
        ) : null}
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
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
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
                  <Th>Attendance</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((student) => (
                  <tr key={student.student_id}>
                    <Td className="font-medium">
                      {student.name}{" "}
                      {student.username ? (
                        <span className="font-mono text-muted-foreground">({student.username})</span>
                      ) : null}
                    </Td>
                    <Td className="font-mono">{student.registration || "-"}</Td>
                    <Td>
                      {student.course ? (
                        <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200">
                          {student.course}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </Td>
                    <Td className="text-muted-foreground">{student.department || "-"}</Td>
                    <Td className="font-mono">{student.year_of_study ?? "-"}</Td>
                    <Td>
                      {typeof student.percentage === "number" ? (
                        <div className="flex items-baseline gap-2">
                          <span
                            className={`font-semibold ${
                              student.percentage >= 75
                                ? "text-emerald-600"
                                : student.percentage >= 50
                                  ? "text-amber-600"
                                  : "text-red-600"
                            }`}
                          >
                            {student.percentage}%
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {student.attended}/{student.total_sessions} sessions
                          </span>
                        </div>
                      ) : (
                        "-"
                      )}
                    </Td>
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

"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, BookOpen, Building2, MapPin, UserCheck, UserRound, Users } from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, Classroom, Course, Department, Group, User } from "@/lib/api";

type PaginatedUsers = { count?: number; results?: User[] };

function unwrapUsers(payload: PaginatedUsers | User[] | undefined): User[] {
  if (Array.isArray(payload)) return payload;
  return payload?.results ?? [];
}

export default function AdminDashboardPage() {
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [studentCount, setStudentCount] = useState(0);
  const [lecturerCount, setLecturerCount] = useState(0);
  const [groups, setGroups] = useState<Group[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [apiOnline, setApiOnline] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const safe = <T,>(promise: Promise<{ data: T }>) =>
      promise
        .then((response) => ({ ok: true as const, data: response.data }))
        .catch(() => ({ ok: false as const }));

    Promise.all([
      safe(api.get<PaginatedUsers | User[]>("/user-management/users/", { params: { page_size: 5, ordering: "-id" } })),
      safe(api.get<PaginatedUsers>("/user-management/users/", { params: { page_size: 1 } })),
      safe(api.get<PaginatedUsers>("/user-management/users/", { params: { group: "Student", page_size: 1 } })),
      safe(api.get<PaginatedUsers>("/user-management/users/", { params: { group: "Lecturer", page_size: 1 } })),
      safe(api.get<Group[]>("/user-management/groups/")),
      safe(api.get<Course[]>("/courses/")),
      safe(api.get<Classroom[]>("/courses/classrooms/")),
      safe(api.get<Department[]>("/departments/")),
    ]).then(([recent, total, students, lecturers, groupRes, courseRes, classroomRes, deptRes]) => {
      if (cancelled) return;

      setApiOnline(
        [recent, total, students, lecturers, groupRes, courseRes, classroomRes, deptRes].every(
          (result) => result.ok,
        ),
      );

      if (recent.ok) setRecentUsers(unwrapUsers(recent.data));
      if (total.ok) setTotalUsers(total.data?.count ?? 0);
      if (students.ok) setStudentCount(students.data?.count ?? 0);
      if (lecturers.ok) setLecturerCount(lecturers.data?.count ?? 0);
      if (groupRes.ok) setGroups(Array.isArray(groupRes.data) ? groupRes.data : []);
      if (courseRes.ok) setCourses(Array.isArray(courseRes.data) ? courseRes.data : []);
      if (classroomRes.ok) setClassrooms(Array.isArray(classroomRes.data) ? classroomRes.data : []);
      if (deptRes.ok) setDepartments(Array.isArray(deptRes.data) ? deptRes.data : []);

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const metrics = useMemo(() => {
    const gpsClassrooms = classrooms.filter(
      (classroom) => classroom.latitude !== null && classroom.longitude !== null,
    ).length;
    return [
      { label: "Total Users", value: totalUsers, icon: Users },
      { label: "Students", value: studentCount, icon: UserCheck },
      { label: "Lecturers", value: lecturerCount, icon: UserRound },
      { label: "Departments", value: departments.length, icon: Building2 },
      { label: "Courses", value: courses.length, icon: BookOpen },
      { label: "GPS Classrooms", value: gpsClassrooms, icon: MapPin },
      { label: "Groups", value: groups.length, icon: Activity },
    ];
  }, [totalUsers, studentCount, lecturerCount, groups, courses, classrooms, departments]);

  if (loading) {
    return (
      <AdminShell>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => <LoadingSkeleton key={i} className="h-28" />)}
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">System overview and structural data management.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => <StatCard key={m.label} {...m} />)}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader><CardTitle>Recent Users</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {recentUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users found.</p>
            ) : recentUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-xl border bg-white p-3">
                <div>
                  <p className="font-medium">{u.full_name || u.username}</p>
                  <p className="text-sm text-muted-foreground">{u.email || u.username}</p>
                </div>
                <Badge>{u.role_display}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader><CardTitle>System Status</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`rounded-xl border p-4 ${
                apiOnline
                  ? "bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              <p className="font-medium">{apiOnline ? "API Connected" : "API Connection Issue"}</p>
              <p className="text-sm">
                {apiOnline
                  ? "JWT auth active. All dashboard endpoints are responding."
                  : "One or more dashboard endpoints did not respond. Confirm the deployed backend is running the latest main branch."}
              </p>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">GPS-enabled Classrooms</p>
              <p className="text-2xl font-bold">
                {classrooms.filter((c) => c.latitude !== null && c.longitude !== null).length} / {classrooms.length}
              </p>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Courses per Department</p>
              <div className="space-y-2">
                {departments.map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-sm">
                    <span>{d.name}</span>
                    <Badge>{courses.filter((c) => c.department === d.id).length}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}

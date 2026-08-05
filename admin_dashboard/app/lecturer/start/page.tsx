"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { PlayCircle, MapPin, Navigation } from "lucide-react";

import { LecturerShell } from "@/components/lecturer-shell";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, Classroom, Course } from "@/lib/api";

const SessionMap = dynamic(() => import("@/components/session-map"), { ssr: false });

export default function StartSessionPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<{ id: number; name: string }[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const [selectedCourse, setSelectedCourse] = useState<number | "">("");
  const [selectedSubject, setSelectedSubject] = useState<number | "">("");
  const [selectedClassroom, setSelectedClassroom] = useState<number | "">("");
  const [radius, setRadius] = useState("30");
  const [isOverride, setIsOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<Course[]>("/courses/").catch(() => ({ data: [] })),
      api.get<Classroom[]>("/courses/classrooms/").catch(() => ({ data: [] })),
    ]).then(([c, cl]) => {
      setCourses(Array.isArray(c.data) ? c.data : (c.data as any)?.results ?? []);
      setClassrooms(Array.isArray(cl.data) ? cl.data : []);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      api.get(`/subjects/?course_id=${selectedCourse}`).then((res) => {
        const data = Array.isArray(res.data) ? res.data : (res.data as any)?.results ?? [];
        setSubjects(data as { id: number; name: string }[]);
      }).catch(() => setSubjects([]));
    } else {
      setSubjects([]);
    }
  }, [selectedCourse]);

  useEffect(() => {
    const cr = classrooms.find((c) => c.id === selectedClassroom);
    if (cr?.radius_meters) setRadius(cr.radius_meters.toString());
  }, [selectedClassroom, classrooms]);

  const selectedClassroomData = classrooms.find((c) => c.id === selectedClassroom);

  async function startSession(e: FormEvent) {
    e.preventDefault();
    if (!selectedCourse || !selectedSubject || !selectedClassroom) {
      setError("Please select course, subject, and classroom.");
      return;
    }
    setStarting(true);
    setError("");
    try {
      const cr = classrooms.find((c) => c.id === selectedClassroom);
      const payload: Record<string, unknown> = {
        course_id: selectedCourse,
        subject_id: selectedSubject,
        classroom_id: selectedClassroom,
        latitude: cr?.latitude,
        longitude: cr?.longitude,
        radius: parseFloat(radius) || 30,
      };
      if (isOverride) {
        payload.is_override = true;
        payload.override_reason = overrideReason;
      }
      await api.post("/attendance/start-session/", payload);
      router.push("/lecturer/sessions");
    } catch (err: any) {
      const backendMsg = err?.response?.data?.error || err?.response?.data?.detail;
      setError(backendMsg || "Failed to start session. Check your inputs.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <LecturerShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Start New Session</h1>
        <p className="text-muted-foreground">Select course, classroom, and configure geofence settings.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader><CardTitle>Session Configuration</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={startSession}>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Programme (Course)</label>
                <select
                  className="flex h-10 w-full rounded-xl border bg-background px-3 text-sm"
                  value={selectedCourse}
                  onChange={(e) => { setSelectedCourse(Number(e.target.value) || ""); setSelectedSubject(""); }}
                >
                  <option value="">Select programme</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                </select>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Subject</label>
                <select
                  className="flex h-10 w-full rounded-xl border bg-background px-3 text-sm"
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(Number(e.target.value) || "")}
                  disabled={!selectedCourse}
                >
                  <option value="">Select subject</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Classroom</label>
                <select
                  className="flex h-10 w-full rounded-xl border bg-background px-3 text-sm"
                  value={selectedClassroom}
                  onChange={(e) => setSelectedClassroom(Number(e.target.value) || "")}
                >
                  <option value="">Select classroom</option>
                  {classrooms.map((cr) => (
                    <option key={cr.id} value={cr.id}>
                      {cr.room_name} ({cr.room_number}) {cr.latitude ? "📍" : "❌"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Geofence Radius (meters)</label>
                <Input type="number" value={radius} onChange={(e) => setRadius(e.target.value)} min={5} />
              </div>

              <div className="grid gap-2 rounded-lg border p-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={isOverride}
                    onChange={(e) => setIsOverride(e.target.checked)}
                    className="h-4 w-4"
                  />
                  No timetable for this slot (override)
                </label>
                {isOverride && (
                  <Input
                    placeholder="Reason (e.g. postponed/replacement class)"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                  />
                )}
              </div>

              {selectedClassroomData && (
                <div className="rounded-lg border bg-muted/50 p-3 text-sm">
                  <p className="flex items-center gap-2 font-medium">
                    <MapPin className="h-4 w-4 text-primary" />
                    {selectedClassroomData.room_name}
                  </p>
                  {selectedClassroomData.latitude ? (
                    <p className="mt-1 text-muted-foreground">
                      <Navigation className="mr-1 inline h-3 w-3" />
                      {selectedClassroomData.latitude?.toFixed(6)}, {selectedClassroomData.longitude?.toFixed(6)}
                    </p>
                  ) : (
                    <p className="mt-1 text-amber-600">No GPS coordinates set for this classroom.</p>
                  )}
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button disabled={starting || !selectedCourse || !selectedSubject || !selectedClassroom}>
                <PlayCircle className="mr-2 h-4 w-4" />
                {starting ? "Starting..." : "Start Session"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader><CardTitle>Classroom Map</CardTitle></CardHeader>
          <CardContent>
            {selectedClassroomData?.latitude && selectedClassroomData?.longitude ? (
              <SessionMap
                latitude={selectedClassroomData.latitude}
                longitude={selectedClassroomData.longitude}
                radius={parseFloat(radius) || 30}
              />
            ) : (
              <div className="flex h-[400px] items-center justify-center rounded-lg bg-muted">
                <div className="text-center text-muted-foreground">
                  <MapPin className="mx-auto mb-2 h-8 w-8" />
                  <p>Select a classroom with GPS coordinates</p>
                  <p className="text-sm">to view its location on the map</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </LecturerShell>
  );
}

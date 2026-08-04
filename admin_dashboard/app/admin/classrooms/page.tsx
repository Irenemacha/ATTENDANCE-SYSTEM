"use client";

import { FormEvent, useEffect, useState } from "react";
import { MapPin, Plus, Pencil, Trash2, Wifi, Navigation } from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { api, Classroom } from "@/lib/api";

export default function ClassroomsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [gpsDialog, setGpsDialog] = useState<Classroom | null>(null);
  const [editing, setEditing] = useState<Classroom | null>(null);
  const [roomName, setRoomName] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState("20");
  const [error, setError] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<Classroom[]>("/courses/classrooms/");
      setClassrooms(Array.isArray(res.data) ? res.data : []);
    } catch {
      setClassrooms([]);
    }
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setRoomName(""); setRoomNumber(""); setLatitude(""); setLongitude(""); setRadius("20");
    setError(""); setDialogOpen(true);
  }

  function openEdit(c: Classroom) {
    setEditing(c);
    setRoomName(c.room_name); setRoomNumber(c.room_number);
    setLatitude(c.latitude?.toString() ?? "");
    setLongitude(c.longitude?.toString() ?? "");
    setRadius(c.radius_meters.toString());
    setError(""); setDialogOpen(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setError("");
    const payload: Record<string, unknown> = {
      room_name: roomName,
      room_number: roomNumber,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      radius_meters: parseInt(radius) || 20,
    };
    try {
      if (editing) {
        await api.patch(`/courses/classrooms/${editing.id}/`, payload);
      } else {
        await api.post("/courses/classrooms/", payload);
      }
      setDialogOpen(false);
      await load();
    } catch { setError("Failed to save classroom."); }
  }

  async function remove(c: Classroom) {
    if (!confirm(`Delete ${c.room_name}?`)) return;
    await api.delete(`/courses/classrooms/${c.id}/`);
    await load();
  }

  async function saveGps() {
    if (!gpsDialog) return;
    try {
      await api.patch(`/courses/classrooms/${gpsDialog.id}/`, {
        latitude: parseFloat(latitude) || null,
        longitude: parseFloat(longitude) || null,
        radius_meters: parseInt(radius) || 20,
      });
      setGpsDialog(null);
      await load();
    } catch { setError("Failed to update GPS."); }
  }

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Classrooms</h1>
          <p className="text-muted-foreground">Manage classrooms and GPS coordinates.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Classroom</Button>
      </div>
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-6">
          {loading ? <LoadingSkeleton className="h-64" /> : classrooms.length === 0 ? (
            <EmptyState icon={MapPin} title="No classrooms" description="Add a classroom to get started." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Room</Th>
                  <Th>Number</Th>
                  <Th>GPS</Th>
                  <Th>Radius</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {classrooms.map((c) => (
                  <tr key={c.id}>
                    <Td className="font-medium">{c.room_name}</Td>
                    <Td>{c.room_number}</Td>
                    <Td>
                      {c.latitude && c.longitude ? (
                        <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                          <Navigation className="mr-1 h-3 w-3" /> {c.latitude.toFixed(4)}, {c.longitude.toFixed(4)}
                        </Badge>
                      ) : (
                        <Badge>Not set</Badge>
                      )}
                    </Td>
                    <Td>{c.radius_meters}m</Td>
                    <Td>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="outline" onClick={() => { setGpsDialog(c); setLatitude(c.latitude?.toString() ?? ""); setLongitude(c.longitude?.toString() ?? ""); setRadius(c.radius_meters.toString()); }}>
                          <MapPin className="h-4 w-4" /> GPS
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => remove(c)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Classroom" : "Add Classroom"}</DialogTitle></DialogHeader>
          <form className="grid gap-3" onSubmit={submit}>
            <Input placeholder="Room name (e.g. Lecture Hall A)" value={roomName} onChange={(e) => setRoomName(e.target.value)} />
            <Input placeholder="Room number (e.g. LH-101)" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Latitude" type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
              <Input placeholder="Longitude" type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
            </div>
            <Input placeholder="Radius (meters)" type="number" value={radius} onChange={(e) => setRadius(e.target.value)} />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button>{editing ? "Save" : "Create"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!gpsDialog} onOpenChange={() => setGpsDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>GPS Setup - {gpsDialog?.room_name}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Latitude" type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
              <Input placeholder="Longitude" type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
            </div>
            <Input placeholder="Radius (meters)" type="number" value={radius} onChange={(e) => setRadius(e.target.value)} />
            <p className="text-xs text-muted-foreground">These coordinates are the source of truth for geofencing during sessions.</p>
            <Button onClick={saveGps}><MapPin className="h-4 w-4" /> Save GPS</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

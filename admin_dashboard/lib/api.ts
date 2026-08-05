import axios from "axios";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://attendance-system-production-21e3.up.railway.app/api/";

export type User = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  groups: string[];
  role_display: string;
  is_staff: boolean;
  is_superuser: boolean;
  profile: {
    profile_type: string;
    reg_number: string | null;
    full_name: string;
    email: string;
    phone_number: string | null;
    course: string | null;
    department: string | null;
    year_of_study: number | null;
  };
};

export type Group = {
  id: number;
  name: string;
  permissions: number[];
};

export type Permission = {
  id: number;
  name: string;
  codename: string;
  app_label: string;
  model: string;
};

export type Department = {
  id: number;
  name: string;
};

export type Course = {
  id: number;
  name: string;
  code: string;
  department: number;
  department_name?: string;
  subjects?: Subject[];
};

export type Subject = {
  id: number;
  name: string;
  code: string;
  course: number;
};

export type Classroom = {
  id: number;
  room_name: string;
  room_number: string;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
};

export type SessionSummary = {
  session_id: number;
  course: string;
  subject: string;
  date: string;
  active: boolean;
  total_students: number;
  present: number;
  late: number;
  absent: number;
  percentage: number;
};

export type AttendanceRecord = {
  student_id: number;
  name: string;
  registration: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
};

export type HODDashboard = {
  department: string;
  total_sessions: number;
  active_sessions: number;
  total_attendance: number;
  low_attendance_alerts: Array<{
    session_id: number;
    course: string;
    lecturer: string;
    percentage: number;
  }>;
  delay_analysis: Array<{
    lecturer: string;
    late_starts: number;
    average_delay_minutes: number;
  }>;
  courses: Array<{
    course: string;
    total_sessions: number;
    total_attendance: number;
    present: number;
    percentage: number;
  }>;
};

export const api = axios.create({
  baseURL: API_BASE_URL.endsWith("/") ? API_BASE_URL : `${API_BASE_URL}/`,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry && typeof window !== "undefined") {
      const refreshToken = localStorage.getItem("refresh");
      if (!refreshToken) {
        clearSession();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve) => {
          addRefreshSubscriber((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh/`, { refresh: refreshToken });
        const newAccess = response.data.access;
        localStorage.setItem("access", newAccess);
        onRefreshed(newAccess);
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest);
      } catch {
        clearSession();
        window.location.href = "/login";
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export function saveSession(access: string, refresh: string, user: User) {
  localStorage.setItem("access", access);
  localStorage.setItem("refresh", refresh);
  localStorage.setItem("user", JSON.stringify(user));
}

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  return raw ? (JSON.parse(raw) as User) : null;
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
  localStorage.removeItem("user");
}

export function getRoleHomePath(user: User): string {
  const groups = user.groups.map((g) => g.toLowerCase());
  if (groups.includes("hod")) return "/hod";
  if (groups.includes("lecturer")) return "/lecturer";
  return "/admin";
}

import axios from "axios";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://attendance-system-production-5479.up.railway.app/api";

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
    reg_number?: string | null;
    full_name?: string;
    email?: string;
    phone_number?: string | null;
    course?: string | null;
    course_id?: number | null;
    department: string | null;
    department_id?: number | null;
    year_of_study?: number | null;
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
  course_name?: string;
  course_code?: string;
};

export type Enrollment = {
  id: number;
  student: number;
  student_username: string;
  student_name: string;
  reg_number: string | null;
  course: number;
  course_name: string;
  course_code: string;
};

export type AdminReportSession = {
  session_id: number;
  course: string;
  course_code: string;
  subject: string;
  lecturer: string;
  date: string;
  active: boolean;
  is_override: boolean;
  total: number;
  present: number;
  late: number;
  absent: number;
  attended: number;
  percentage: number;
};

export type AdminReportOverview = {
  total_sessions: number;
  active_sessions: number;
  total_records: number;
  total_present: number;
  overall_percentage: number;
};

export type Classroom = {
  id: number;
  room_name: string;
  room_number: string;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
};

export type TimetableEntry = {
  id: number;
  course: number;
  course_code: string;
  course_name: string;
  lecturer: number;
  lecturer_username: string;
  day: string;
  start_time: string;
  end_time: string;
  room: string;
};

export type TimetableUploadSummary = {
  message: string;
  total_rows: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  errors: Array<{ row: number | null; errors: string[] }>;
};

export type Holiday = {
  id?: number;
  name: string;
  date: string;
};

export type Semester = {
  id: number;
  name: string;
  academic_year: string;
  start_date: string;
  end_date: string;
  teaching_weeks: number;
  is_current: boolean;
  holidays: Holiday[];
};

export type SessionChangeLog = {
  id: number;
  session_id: number;
  course: string;
  course_code: string;
  subject: string;
  lecturer: string;
  change_type: string;
  change_type_display: string;
  original_start_time: string | null;
  original_end_time: string | null;
  actual_start_time: string | null;
  actual_end_time: string | null;
  reason: string | null;
  changed_by: string;
  changed_at: string;
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
  department: string | null;
  total_sessions: number;
  active_sessions: number;
  total_attendance: number;
  total_students?: number;
  low_attendance_alerts: Array<{
    session_id: number;
    course: string;
    subject?: string;
    lecturer: string;
    total_students?: number;
    attended?: number;
    percentage: number;
  }>;
  delay_analysis: Array<{
    session_id?: number;
    course?: string;
    subject?: string;
    lecturer: string;
    issue?: string;
    late_starts?: number;
    average_delay_minutes?: number;
  }>;
  courses: Array<{
    course: string;
    course_code?: string;
    total_sessions: number;
    total_attendance?: number;
    total_students?: number;
    attended?: number;
    present?: number;
    percentage: number;
  }>;
};

export type StudentAttendance = {
  student_id: number;
  name: string;
  registration: string;
  course: string | null;
  course_code: string | null;
  department?: string | null;
  year_of_study?: number | null;
  attended: number;
  total_sessions: number;
  percentage: number;
  status: "Fine" | "Critical" | string;
};

export type StudentAttendanceSummary = {
  total_students: number;
  average_percentage: number;
  critical_students?: number;
  total_sessions?: number;
};

export type StudentAttendanceResponse = {
  department?: string | null;
  course?: string;
  course_code?: string;
  subject?: string | null;
  subject_id?: number | null;
  students: StudentAttendance[];
  summary: StudentAttendanceSummary;
};

export type HODReportSession = {
  session_id: number;
  course: string;
  course_code: string;
  subject: string;
  lecturer: string;
  date: string;
  active: boolean;
  is_override: boolean;
  total: number;
  present: number;
  late: number;
  absent: number;
  attended: number;
  percentage: number;
};

export type HODReportResponse = {
  department: string | null;
  sessions: HODReportSession[];
  overview?: {
    total_sessions: number;
    total_records: number;
    total_attended: number;
    overall_percentage: number;
  };
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

const AUTH_PATHS = ["/auth/login/", "/auth/refresh/"];

function isAuthPath(url?: string) {
  if (!url) return false;
  const path = url.replace(API_BASE_URL, "");
  return AUTH_PATHS.some((authPath) => path.includes(authPath));
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (isAuthPath(originalRequest?.url)) {
      return Promise.reject(error);
    }
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

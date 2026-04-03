const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

export type TeacherSession = {
  id: number;
  formation_title: string;
  label: string;
  start_date: string;
  campus_label: string;
  seat_capacity: number;
  enrolled_count: number;
  teacher_name: string;
  status: string;
};

export type TeacherOverview = {
  assigned_sessions_count: number;
  planned_sessions_count: number;
  open_sessions_count: number;
  total_students_count: number;
  next_session_label: string | null;
  sessions: TeacherSession[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let detail: unknown;
    try {
      detail = await response.json();
    } catch {
      detail = await response.text();
    }

    const message =
      typeof detail === "object" &&
      detail !== null &&
      "detail" in detail &&
      typeof detail.detail === "string"
        ? detail.detail
        : `HTTP ${response.status}`;

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function fetchTeacherOverview(): Promise<TeacherOverview> {
  return request<TeacherOverview>("/teacher/overview");
}

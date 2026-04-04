import { apiRequest } from "./apiClient";

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

export async function fetchTeacherOverview(): Promise<TeacherOverview> {
  return apiRequest<TeacherOverview>("/teacher/overview");
}

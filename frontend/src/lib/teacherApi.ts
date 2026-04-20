import { apiRequest } from "./apiClient";

// ── Overview ────────────────────────────────────────────────────────────────

export type TeacherSession = {
  id: number;
  formation_title: string;
  formation_image?: string;
  format_type: string;
  label: string;
  start_date: string;
  end_date: string;
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

// ── Quiz ─────────────────────────────────────────────────────────────────────

export type QuizStatus = "draft" | "active" | "closed";
export type ResourceType = "pdf" | "link" | "video" | "image";

export type QuizQuestion = {
  id: number;
  order_index: number;
  text: string;
  options: string[];
  correct_index: number;
};

export type QuizView = {
  id: number;
  session_id: number;
  course_day_id: number | null;
  title: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
  status: QuizStatus;
  questions: QuizQuestion[];
  created_at: string;
};

export type QuizCreate = {
  title: string;
  course_day_id?: number | null;
  scheduled_at?: string | null;
  duration_minutes?: number | null;
  questions: Array<{
    order_index?: number;
    text: string;
    options: string[];
    correct_index: number;
  }>;
};

export type QuizUpdate = {
  title?: string;
  course_day_id?: number | null;
  scheduled_at?: string | null;
  duration_minutes?: number | null;
  status?: QuizStatus;
};

export type QuizAttemptStudent = {
  enrollment_id: number;
  student_name: string;
  attempt_number: number;
  score_pct: number;
  submitted_at: string;
};

export type QuizResults = {
  quiz_id: number;
  title: string;
  total_students: number;
  attempts: QuizAttemptStudent[];
};

export async function fetchSessionQuizzes(sessionId: number): Promise<QuizView[]> {
  return apiRequest<QuizView[]>(`/teacher/sessions/${sessionId}/quizzes`);
}

export async function createQuiz(sessionId: number, payload: QuizCreate): Promise<QuizView> {
  return apiRequest<QuizView>(`/teacher/sessions/${sessionId}/quizzes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateQuiz(quizId: number, payload: QuizUpdate): Promise<QuizView> {
  return apiRequest<QuizView>(`/teacher/quizzes/${quizId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteQuiz(quizId: number): Promise<void> {
  await apiRequest<void>(`/teacher/quizzes/${quizId}`, { method: "DELETE" });
}

export async function fetchQuizResults(quizId: number): Promise<QuizResults> {
  return apiRequest<QuizResults>(`/teacher/quizzes/${quizId}/results`);
}

// ── Resources ────────────────────────────────────────────────────────────────

export type ResourceView = {
  id: number;
  session_id: number;
  course_day_id: number | null;
  title: string;
  resource_type: ResourceType;
  url: string;
  published_at: string | null;
  created_at: string;
};

export type ResourceCreate = {
  title: string;
  course_day_id?: number | null;
  resource_type: ResourceType;
  url: string;
  published_at?: string | null;
};

export async function fetchSessionResources(sessionId: number): Promise<ResourceView[]> {
  return apiRequest<ResourceView[]>(`/teacher/sessions/${sessionId}/resources`);
}

export async function createResource(sessionId: number, payload: ResourceCreate): Promise<ResourceView> {
  return apiRequest<ResourceView>(`/teacher/sessions/${sessionId}/resources`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteResource(resourceId: number): Promise<void> {
  await apiRequest<void>(`/teacher/resources/${resourceId}`, { method: "DELETE" });
}

export type TeacherUploadedAsset = {
  filename: string;
  path: string;
  public_url: string;
  content_type: string;
  size: number;
};

export async function uploadTeacherAsset(file: File): Promise<TeacherUploadedAsset> {
  const params = new URLSearchParams({ filename: file.name });
  // 5 minutes timeout for large video uploads
  return apiRequest<TeacherUploadedAsset>(`/teacher/uploads?${params.toString()}`, {
    method: "POST",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
    timeoutMs: 5 * 60 * 1000,
  });
}

// ── Assignments ──────────────────────────────────────────────────────────────

export type AssignmentView = {
  id: number;
  session_id: number;
  course_day_id: number | null;
  title: string;
  instructions: string;
  due_date: string;
  is_final_project: boolean;
  submissions_count: number;
  created_at: string;
};

export type AssignmentSubmission = {
  id: number;
  enrollment_id: number;
  student_name: string;
  file_url: string;
  submitted_at: string;
  is_reviewed: boolean;
  review_score: number | null;
  review_max_score: number;
};

export type AssignmentCreate = {
  title: string;
  course_day_id?: number | null;
  instructions?: string;
  due_date: string;
  is_final_project?: boolean;
};

export type AssignmentUpdate = {
  title?: string;
  course_day_id?: number | null;
  instructions?: string;
  due_date?: string;
  is_final_project?: boolean;
};

export async function fetchSessionAssignments(sessionId: number): Promise<AssignmentView[]> {
  return apiRequest<AssignmentView[]>(`/teacher/sessions/${sessionId}/assignments`);
}

export async function createAssignment(sessionId: number, payload: AssignmentCreate): Promise<AssignmentView> {
  return apiRequest<AssignmentView>(`/teacher/sessions/${sessionId}/assignments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAssignment(assignmentId: number, payload: AssignmentUpdate): Promise<AssignmentView> {
  return apiRequest<AssignmentView>(`/teacher/assignments/${assignmentId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteAssignment(assignmentId: number): Promise<void> {
  await apiRequest<void>(`/teacher/assignments/${assignmentId}`, { method: "DELETE" });
}

export async function fetchAssignmentSubmissions(assignmentId: number): Promise<AssignmentSubmission[]> {
  return apiRequest<AssignmentSubmission[]>(`/teacher/assignments/${assignmentId}/submissions`);
}

export async function markSubmissionReviewed(
  submissionId: number,
  payload?: { review_score?: number | null; review_max_score?: number },
): Promise<AssignmentSubmission> {
  return apiRequest<AssignmentSubmission>(`/teacher/submissions/${submissionId}/review`, {
    method: "PATCH",
    body: payload ? JSON.stringify(payload) : undefined,
  });
}

// ── Courses ──────────────────────────────────────────────────────────────────

export type LessonType = "text" | "video" | "pdf" | "quiz" | "assignment" | "resource";

export type LessonView = {
  id: number;
  chapter_id: number;
  title: string;
  lesson_type: LessonType;
  order_index: number;
  content: string | null;
  video_url: string | null;
  file_url: string | null;
  quiz_id: number | null;
  assignment_id: number | null;
  resource_id: number | null;
  quiz_title: string | null;
  assignment_title: string | null;
  resource_title: string | null;
  created_at: string;
};

export type ChapterView = {
  id: number;
  course_id: number;
  title: string;
  order_index: number;
  lessons: LessonView[];
  created_at: string;
};

export type CourseView = {
  id: number;
  session_id: number;
  title: string;
  description: string;
  chapters: ChapterView[];
  total_lessons: number;
  created_at: string;
  updated_at: string;
};

export type LessonCreate = {
  title: string;
  lesson_type: LessonType;
  order_index?: number;
  content?: string | null;
  video_url?: string | null;
  file_url?: string | null;
  quiz_id?: number | null;
  assignment_id?: number | null;
  resource_id?: number | null;
};

export async function fetchSessionCourses(sessionId: number): Promise<CourseView[]> {
  return apiRequest<CourseView[]>(`/teacher/sessions/${sessionId}/courses`);
}

export async function createCourse(sessionId: number, payload: { title: string; description?: string }): Promise<CourseView> {
  return apiRequest<CourseView>(`/teacher/sessions/${sessionId}/courses`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCourse(courseId: number, payload: { title?: string; description?: string }): Promise<CourseView> {
  return apiRequest<CourseView>(`/teacher/courses/${courseId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteCourse(courseId: number): Promise<void> {
  await apiRequest<void>(`/teacher/courses/${courseId}`, { method: "DELETE" });
}

export async function createChapter(courseId: number, payload: { title: string; order_index?: number }): Promise<ChapterView> {
  return apiRequest<ChapterView>(`/teacher/courses/${courseId}/chapters`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateChapter(chapterId: number, payload: { title?: string; order_index?: number }): Promise<ChapterView> {
  return apiRequest<ChapterView>(`/teacher/chapters/${chapterId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteChapter(chapterId: number): Promise<void> {
  await apiRequest<void>(`/teacher/chapters/${chapterId}`, { method: "DELETE" });
}

export async function createLesson(chapterId: number, payload: LessonCreate): Promise<LessonView> {
  return apiRequest<LessonView>(`/teacher/chapters/${chapterId}/lessons`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateLesson(lessonId: number, payload: Partial<LessonCreate>): Promise<LessonView> {
  return apiRequest<LessonView>(`/teacher/lessons/${lessonId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteLesson(lessonId: number): Promise<void> {
  await apiRequest<void>(`/teacher/lessons/${lessonId}`, { method: "DELETE" });
}

// ── Teacher profile ──────────────────────────────────────────────────────────

export type TeacherProfile = {
  user_id: number;
  full_name: string;
  email: string;
  teacher_code: string | null;
  whatsapp: string | null;
  nationality: string | null;
  subject: string | null;
  experience_years: number | null;
  portfolio_url: string | null;
  bio: string | null;
};

export type TeacherProfileUpdate = Partial<Omit<TeacherProfile, "user_id" | "full_name" | "email">>;

export async function fetchMyTeacherProfile(): Promise<TeacherProfile> {
  return apiRequest<TeacherProfile>("/teacher/profile");
}

export async function updateMyTeacherProfile(payload: TeacherProfileUpdate): Promise<TeacherProfile> {
  return apiRequest<TeacherProfile>("/teacher/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// ── Teacher formations & sessions ────────────────────────────────────────────

export type TeacherFormationItem = {
  id: number;
  slug: string;
  title: string;
  format_type: string;
  image: string;
  session_label: string | null;
  session_state: string | null;
  meeting_link: string | null;
};

export type TeacherFullSession = {
  id: number;
  formation_id: number;
  formation_title: string;
  formation_slug: string;
  format_type: string;
  label: string;
  start_date: string;
  end_date: string;
  campus_label: string | null;
  seat_capacity: number;
  enrolled_count: number;
  meeting_link: string | null;
  status: string;
  session_state: string;
};

export async function fetchMyFormations(): Promise<TeacherFormationItem[]> {
  return apiRequest<TeacherFormationItem[]>("/teacher/formations");
}

export async function fetchMyFormationSessions(formationId: number): Promise<TeacherFullSession[]> {
  return apiRequest<TeacherFullSession[]>(`/teacher/formations/${formationId}/sessions`);
}

// ── Course days ──────────────────────────────────────────────────────────────

export type CourseDayStatus = "planned" | "live" | "done" | "cancelled";

export type CourseDay = {
  id: number;
  session_id: number;
  live_event_id: number | null;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  status: CourseDayStatus;
  attendance_count: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
  quiz_count: number;
  assignment_count: number;
  resource_count: number;
  grade_count: number;
  created_at: string;
};

export async function fetchSessionCourseDays(sessionId: number): Promise<CourseDay[]> {
  return apiRequest<CourseDay[]>(`/teacher/sessions/${sessionId}/course-days`);
}

export async function createCourseDay(
  sessionId: number,
  payload: { title: string; scheduled_at: string; duration_minutes: number; status?: CourseDayStatus },
): Promise<CourseDay> {
  return apiRequest<CourseDay>(`/teacher/sessions/${sessionId}/course-days`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── Admin teacher management ─────────────────────────────────────────────────

export type AdminTeacherItem = {
  id: number;
  full_name: string;
  email: string;
  teacher_code: string | null;
  status: string;
  whatsapp: string | null;
  nationality: string | null;
  subject: string | null;
  experience_years: number | null;
  portfolio_url: string | null;
  assigned_formations_count: number;
  assigned_sessions_count: number;
  students_count: number;
  created_at: string;
};

export type AdminTeacherActivitySummary = {
  sessions_count: number;
  active_sessions_count: number;
  students_count: number;
  course_days_count: number;
  live_events_count: number;
  courses_count: number;
  lessons_count: number;
  resources_count: number;
  assignments_count: number;
  submissions_count: number;
  pending_reviews_count: number;
  quizzes_count: number;
  quiz_attempts_count: number;
  attendance_present_count: number;
  attendance_late_count: number;
  attendance_absent_count: number;
  grades_count: number;
  average_grade_pct: number | null;
};

export type AdminTeacherStudentItem = {
  enrollment_id: number;
  student_id: number;
  full_name: string;
  email: string;
  student_code: string | null;
  formation_title: string;
  formation_slug: string;
  session_id: number | null;
  session_label: string | null;
  enrollment_status: string;
  progress_pct: number;
  attendance_count: number;
  present_count: number;
  late_count: number;
  absent_count: number;
  grades_count: number;
  average_grade_pct: number | null;
  submissions_count: number;
  pending_reviews_count: number;
  last_activity_at: string | null;
};

export type AdminTeacherCourseDayAudit = {
  id: number;
  title: string;
  scheduled_at: string;
  status: string;
  attendance_count: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  resource_count: number;
  assignment_count: number;
  quiz_count: number;
};

export type AdminTeacherContentAudit = {
  id: number;
  title: string;
  content_type: string;
  status: string | null;
  scheduled_at: string | null;
  due_date: string | null;
  submissions_count: number;
  pending_reviews_count: number;
  attempts_count: number;
};

export type AdminTeacherCourseAudit = {
  id: number;
  title: string;
  chapters_count: number;
  lessons_count: number;
};

export type AdminTeacherPedagogyAlert = {
  code: string;
  level: "info" | "warning" | "critical";
  label: string;
  detail: string | null;
};

export type AdminTeacherPedagogySessionAudit = {
  session_id: number;
  formation_title: string;
  formation_slug: string;
  session_label: string;
  session_status: string;
  start_date: string;
  end_date: string;
  students_count: number;
  course_days_count: number;
  live_events_count: number;
  courses_count: number;
  lessons_count: number;
  resources_count: number;
  assignments_count: number;
  quizzes_count: number;
  pending_reviews_count: number;
  alerts: AdminTeacherPedagogyAlert[];
  course_days: AdminTeacherCourseDayAudit[];
  courses: AdminTeacherCourseAudit[];
  contents: AdminTeacherContentAudit[];
};

export type AdminTeacherCourseDayPage = {
  items: AdminTeacherCourseDayAudit[];
  total_count: number;
  offset: number;
  limit: number;
};

export type AdminTeacherDetail = {
  teacher: AdminTeacherItem;
  formations: TeacherFormationItem[];
  sessions: TeacherFullSession[];
  activity: AdminTeacherActivitySummary;
  students: AdminTeacherStudentItem[];
  pedagogy: AdminTeacherPedagogySessionAudit[];
};

export type AdminTeacherUpdatePayload = {
  full_name?: string;
  email?: string;
  status?: "active" | "suspended";
  whatsapp?: string | null;
  nationality?: string | null;
  subject?: string | null;
  experience_years?: number | null;
  portfolio_url?: string | null;
  bio?: string | null;
};

export type AdminTeacherQuizStatusPayload = {
  status: "draft" | "active" | "closed";
};

export type AdminTeacherResourcePublicationPayload = {
  published_at: string | null;
};

export type AdminTeacherAssignmentDueDatePayload = {
  due_date: string;
};

export type TeacherInviteView = {
  id: number;
  token: string;
  email: string;
  full_name: string;
  whatsapp: string | null;
  nationality: string | null;
  subject: string | null;
  experience_years: number | null;
  portfolio_url: string | null;
  bio: string | null;
  status: string;
  expires_at: string;
  created_at: string;
};

export type TeacherInvitePayload = {
  email: string;
  full_name: string;
  whatsapp?: string | null;
  nationality?: string | null;
  subject?: string | null;
  experience_years?: number | null;
  portfolio_url?: string | null;
  bio?: string | null;
};

export async function fetchAdminTeachers(): Promise<AdminTeacherItem[]> {
  return apiRequest<AdminTeacherItem[]>("/admin/teachers");
}

export async function fetchAdminTeacherDetail(teacherId: number): Promise<AdminTeacherDetail> {
  return apiRequest<AdminTeacherDetail>(`/admin/teachers/${teacherId}/detail`);
}

export async function fetchAdminTeacherSessionCourseDays(
  teacherId: number,
  sessionId: number,
  options?: { offset?: number; limit?: number },
): Promise<AdminTeacherCourseDayPage> {
  const params = new URLSearchParams();
  if (typeof options?.offset === "number") params.set("offset", String(options.offset));
  if (typeof options?.limit === "number") params.set("limit", String(options.limit));
  const query = params.toString();
  return apiRequest<AdminTeacherCourseDayPage>(
    `/admin/teachers/${teacherId}/sessions/${sessionId}/course-days${query ? `?${query}` : ""}`,
  );
}

export async function updateAdminTeacher(
  teacherId: number,
  payload: AdminTeacherUpdatePayload,
): Promise<AdminTeacherDetail> {
  return apiRequest<AdminTeacherDetail>(`/admin/teachers/${teacherId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function updateAdminTeacherQuizStatus(
  teacherId: number,
  quizId: number,
  payload: AdminTeacherQuizStatusPayload,
): Promise<AdminTeacherDetail> {
  return apiRequest<AdminTeacherDetail>(`/admin/teachers/${teacherId}/quizzes/${quizId}/status`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function updateAdminTeacherResourcePublication(
  teacherId: number,
  resourceId: number,
  payload: AdminTeacherResourcePublicationPayload,
): Promise<AdminTeacherDetail> {
  return apiRequest<AdminTeacherDetail>(`/admin/teachers/${teacherId}/resources/${resourceId}/publication`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function updateAdminTeacherAssignmentDueDate(
  teacherId: number,
  assignmentId: number,
  payload: AdminTeacherAssignmentDueDatePayload,
): Promise<AdminTeacherDetail> {
  return apiRequest<AdminTeacherDetail>(`/admin/teachers/${teacherId}/assignments/${assignmentId}/due-date`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminTeacherInvitations(): Promise<TeacherInviteView[]> {
  return apiRequest<TeacherInviteView[]>("/admin/teachers/invitations");
}

export async function inviteTeacher(payload: TeacherInvitePayload): Promise<TeacherInviteView> {
  return apiRequest<TeacherInviteView>("/admin/teachers/invite", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function revokeTeacherInvitation(invitationId: number): Promise<TeacherInviteView> {
  return apiRequest<TeacherInviteView>(`/admin/teachers/invitations/${invitationId}/revoke`, {
    method: "POST",
  });
}

export async function assignTeacherToFormation(slug: string, teacher_id: number): Promise<void> {
  await apiRequest<void>(`/admin/formations/${slug}/teachers`, {
    method: "POST",
    body: JSON.stringify({ teacher_id }),
  });
}

export async function removeTeacherFromFormation(slug: string, teacher_id: number): Promise<void> {
  await apiRequest<void>(`/admin/formations/${slug}/teachers/${teacher_id}`, {
    method: "DELETE",
  });
}

// ── Live events ───────────────────────────────────────────────────────────────

export type LiveEventStatus = "scheduled" | "live" | "done" | "cancelled";

export type LiveEvent = {
  id: number;
  session_id: number;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  status: LiveEventStatus;
  created_at: string;
};

export type StudentLiveEvent = {
  id: number;
  session_id: number;
  formation_title: string;
  formation_slug: string;
  session_label: string;
  meeting_link: string | null;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  status: LiveEventStatus;
};

export type LiveEventCreatePayload = {
  title: string;
  scheduled_at: string;
  duration_minutes: number;
};

export type LiveEventUpdatePayload = {
  title?: string;
  scheduled_at?: string;
  duration_minutes?: number;
  status?: LiveEventStatus;
};

export async function fetchSessionLiveEvents(sessionId: number): Promise<LiveEvent[]> {
  return apiRequest<LiveEvent[]>(`/teacher/sessions/${sessionId}/live-events`);
}

export async function createLiveEvent(sessionId: number, payload: LiveEventCreatePayload): Promise<LiveEvent> {
  return apiRequest<LiveEvent>(`/teacher/sessions/${sessionId}/live-events`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateLiveEvent(eventId: number, payload: LiveEventUpdatePayload): Promise<LiveEvent> {
  return apiRequest<LiveEvent>(`/teacher/live-events/${eventId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteLiveEvent(eventId: number): Promise<void> {
  await apiRequest<void>(`/teacher/live-events/${eventId}`, { method: "DELETE" });
}

export async function fetchMyLiveEvents(): Promise<StudentLiveEvent[]> {
  return apiRequest<StudentLiveEvent[]>("/me/live-events");
}

// ── Live room ─────────────────────────────────────────────────────────────────

export type LiveRoomInfo = {
  session_id: number;
  formation_title: string;
  label: string;
  format_type: string;
  start_date: string;
  end_date: string;
  teacher_name: string | null;
  meeting_link: string;
  jitsi_room: string;
};

export async function fetchLiveRoom(sessionId: number): Promise<LiveRoomInfo> {
  return apiRequest<LiveRoomInfo>(`/sessions/${sessionId}/room`);
}

import { apiRequest } from "./apiClient";
import type { CheckoutResult, PaymentProvider } from "./commerceApi";

// ── Quizzes ──────────────────────────────────────────────────────────────────

export type AttemptStatus =
  | "not_started"
  | "passed"
  | "failed_retry_now"
  | "failed_retry_after"
  | "failed_no_retry";

export type StudentQuizQuestion = {
  id: number;
  order_index: number;
  text: string;
  options: string[];
};

export type StudentQuizAttempt = {
  attempt_number: number;
  score_pct: number;
  submitted_at: string;
  correct_answers: number[];
};

export type StudentQuizView = {
  id: number;
  session_id: number;
  session_label: string;
  formation_title: string;
  title: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
  status: string;
  attempt_status: AttemptStatus;
  next_attempt_available_at: string | null;
  best_score_pct: number | null;
  attempts: StudentQuizAttempt[];
  questions: StudentQuizQuestion[];
};

export async function fetchMyQuizzes(): Promise<StudentQuizView[]> {
  return apiRequest<StudentQuizView[]>("/me/quizzes");
}

export async function submitQuizAttempt(
  quizId: number,
  answers: number[],
): Promise<StudentQuizView> {
  return apiRequest<StudentQuizView>(`/me/quizzes/${quizId}/attempt`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
}

// ── Resources ────────────────────────────────────────────────────────────────

export type StudentResource = {
  id: number;
  session_id: number;
  session_label: string;
  formation_title: string;
  title: string;
  resource_type: "pdf" | "link" | "video" | "image";
  url: string;
  published_at: string | null;
  created_at: string;
};

export async function fetchMyResources(): Promise<StudentResource[]> {
  return apiRequest<StudentResource[]>("/me/resources");
}

// ── Assignments ──────────────────────────────────────────────────────────────

export type AssignmentStudentStatus = "pending" | "submitted" | "late" | "reviewed";

export type StudentAssignment = {
  id: number;
  session_id: number;
  session_label: string;
  formation_title: string;
  title: string;
  instructions: string;
  due_date: string;
  is_final_project: boolean;
  student_status: AssignmentStudentStatus;
  submitted_at: string | null;
  file_url: string | null;
  is_reviewed: boolean;
  review_score: number | null;
  review_max_score: number;
};

export async function fetchMyAssignments(): Promise<StudentAssignment[]> {
  return apiRequest<StudentAssignment[]>("/me/assignments");
}

export async function submitAssignment(
  assignmentId: number,
  fileUrl: string,
): Promise<StudentAssignment> {
  return apiRequest<StudentAssignment>(`/me/assignments/${assignmentId}/submit`, {
    method: "POST",
    body: JSON.stringify({ file_url: fileUrl }),
  });
}

// ── Orders & Payments ────────────────────────────────────────────────────────

export type StudentPaymentLine = {
  id: number;
  installment_number: number | null;
  amount: number;
  amount_label: string;
  currency: string;
  provider_code: string;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  due_label: string | null;
  can_pay: boolean;
  checkout_url: string | null;
};

export type StudentOrderSummary = {
  reference: string;
  formation_title: string;
  format_type: string;
  total_amount: number;
  total_amount_label: string;
  status: string;
};

export type GroupedInstallmentLine = {
  installment_number: number | null;
  checkout_key: string;
  amount: number;
  amount_label: string;
  due_date: string | null;
  status: string;
  can_pay: boolean;
  payment_ids: number[];
};

export type StudentOrderGroup = {
  group_reference: string;
  created_at: string;
  orders: StudentOrderSummary[];
  total_amount: number;
  total_amount_label: string;
  installment_plan: string;
  status: string;
  grouped_payments: GroupedInstallmentLine[];
};

export async function fetchMyOrders(): Promise<StudentOrderGroup[]> {
  return apiRequest<StudentOrderGroup[]>("/me/orders");
}

export async function checkoutMyPayment(
  paymentId: number,
  paymentProvider?: PaymentProvider,
): Promise<CheckoutResult> {
  return apiRequest<CheckoutResult>(`/me/payments/${paymentId}/checkout`, {
    method: "POST",
    body: JSON.stringify({ payment_provider: paymentProvider ?? null }),
    timeoutMs: 30000,
  });
}

export async function checkoutGroupInstallment(
  groupReference: string,
  installmentKey: string | number,
  paymentProvider?: PaymentProvider,
): Promise<CheckoutResult> {
  const encodedGroupReference = encodeURIComponent(groupReference);
  const encodedInstallmentKey = encodeURIComponent(String(installmentKey));
  return apiRequest<CheckoutResult>(
    `/me/orders/${encodedGroupReference}/installments/${encodedInstallmentKey}/checkout`,
    {
      method: "POST",
      body: JSON.stringify({ payment_provider: paymentProvider ?? null }),
      timeoutMs: 30000,
    },
  );
}

// ── Results (grades + attendance) ────────────────────────────────────────────

export type StudentAttendanceRow = { status: string; note: string | null };
export type StudentGradeRow = { label: string; score: number; max_score: number; note: string | null };
export type StudentEnrollmentResults = {
  attendance: StudentAttendanceRow[];
  grades: StudentGradeRow[];
};

export async function fetchEnrollmentResults(enrollmentId: number): Promise<StudentEnrollmentResults> {
  return apiRequest<StudentEnrollmentResults>(`/me/enrollments/${enrollmentId}/results`);
}

// ── Course days ─────────────────────────────────────────────────────────────

export type StudentCourseDay = {
  id: number;
  session_id: number;
  live_event_id: number | null;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
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

export async function fetchMyCourseDays(): Promise<StudentCourseDay[]> {
  return apiRequest<StudentCourseDay[]>("/me/course-days");
}

// ── Courses ──────────────────────────────────────────────────────────────────

export type StudentLesson = {
  id: number;
  chapter_id: number;
  title: string;
  lesson_type: "text" | "video" | "pdf" | "quiz" | "assignment" | "resource";
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
  is_completed: boolean;
};

export type StudentChapter = {
  id: number;
  title: string;
  order_index: number;
  lessons: StudentLesson[];
};

export type StudentCourse = {
  id: number;
  session_id: number;
  title: string;
  description: string;
  chapters: StudentChapter[];
  total_lessons: number;
  completed_lessons: number;
  progress_pct: number;
  badge_level: string | null;
  badge_ring_pct: number;
  badge_hint: string | null;
  final_project_validated: boolean;
};

export async function fetchMyCourses(): Promise<StudentCourse[]> {
  return apiRequest<StudentCourse[]>("/me/courses");
}

export async function completeLesson(lessonId: number): Promise<StudentCourse> {
  return apiRequest<StudentCourse>(`/me/courses/lessons/${lessonId}/complete`, { method: "POST" });
}

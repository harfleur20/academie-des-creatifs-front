import type { CourseBadge, EcommerceCourse } from "../data/ecommerceHomeData";
import { apiRequest } from "./apiClient";

export type FormationFormat = "live" | "ligne" | "presentiel";
export type DashboardType = "classic" | "guided";
export type MarketingBadge = Exclude<CourseBadge, "promo">;
export type UserRole = "admin" | "teacher" | "student";
export type UserStatus = "active" | "suspended";
export type EnrollmentStatus = "pending" | "active" | "suspended" | "completed" | "cancelled";
export type SessionStatus = "planned" | "open" | "completed" | "cancelled";
export type SessionState =
  | "not_applicable"
  | "unscheduled"
  | "upcoming"
  | "started_open"
  | "started_closed"
  | "ended";
export type OrderStatus = "pending" | "paid" | "partially_paid" | "failed" | "cancelled";
export type PaymentStatus = "pending" | "confirmed" | "late" | "failed" | "cancelled";

export type FormationProject = {
  title: string;
  image: string;
  kind?: "image" | "video";
  poster?: string | null;
};

export type FormationModule = {
  title: string;
  summary?: string;
  duration?: string;
  lessons: string[];
};

export type FormationFaq = {
  question: string;
  answer: string;
};

export type CatalogFormation = {
  id: number;
  slug: string;
  title: string;
  category: string;
  level: string;
  image: string;
  format_type: FormationFormat;
  dashboard_type: DashboardType;
  session_state: SessionState;
  session_label: string | null;
  card_session_label: string | null;
  purchase_message: string | null;
  can_purchase: boolean;
  session_start_date: string | null;
  session_end_date: string | null;
  late_enrollment_until: string | null;
  current_price_amount: number;
  current_price_label: string;
  original_price_amount: number | null;
  original_price_label: string | null;
  price_currency: string;
  allow_installments: boolean;
  is_featured_home: boolean;
  home_feature_rank: number;
  rating: number;
  reviews: number;
  badges: CourseBadge[];
};

export type FormationDetailItem = CatalogFormation & {
  intro: string;
  mentor_name: string;
  mentor_label: string;
  mentor_image: string;
  included: string[];
  objectives: string[];
  projects: FormationProject[];
  audience_text: string;
  certificate_copy: string;
  certificate_image: string;
  modules: FormationModule[];
  faqs: FormationFaq[];
};

export type AdminFormation = FormationDetailItem;

export type AdminFormationCreatePayload = {
  slug: string;
  title: string;
  category: string;
  level: string;
  image: string;
  format_type: FormationFormat;
  current_price_amount: number;
  original_price_amount?: number | null;
  is_featured_home?: boolean;
  home_feature_rank?: number;
  rating?: number;
  reviews?: number;
  badges?: MarketingBadge[];
  intro?: string;
  mentor_name?: string;
  mentor_label?: string;
  mentor_image?: string;
  included?: string[];
  objectives?: string[];
  projects?: FormationProject[];
  audience_text?: string;
  modules?: FormationModule[];
  faqs?: FormationFaq[];
};

export type AdminFormationUpdatePayload = {
  title?: string;
  category?: string;
  level?: string;
  image?: string;
  format_type?: FormationFormat;
  rating?: number;
  reviews?: number;
  current_price_amount?: number;
  original_price_amount?: number | null;
  is_featured_home?: boolean;
  home_feature_rank?: number;
  badges?: MarketingBadge[];
  intro?: string;
  mentor_name?: string;
  mentor_label?: string;
  mentor_image?: string;
  included?: string[];
  objectives?: string[];
  projects?: FormationProject[];
  audience_text?: string;
  modules?: FormationModule[];
  faqs?: FormationFaq[];
};

export type AdminOverview = {
  formations_count: number;
  live_formations_count: number;
  ligne_formations_count: number;
  presentiel_formations_count: number;
  presentiel_sessions_count: number;
  users_count: number;
  paid_orders_count: number;
  pending_orders_count: number;
  confirmed_payments_count: number;
  pending_payments_count: number;
  late_payments_count: number;
  total_confirmed_revenue_amount: number;
  total_confirmed_revenue_label: string;
};

export type AdminUser = {
  id: number;
  full_name: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  status: UserStatus;
  student_code?: string | null;
  enrollments_count: number;
  created_at: string;
};

export type AdminUserUpdatePayload = {
  role?: UserRole;
  status?: UserStatus;
};

export type AdminEnrollment = {
  id: number;
  user_id: number;
  student_name: string;
  student_email: string;
  student_phone?: string | null;
  student_code?: string | null;
  user_status: UserStatus;
  formation_id: number;
  formation_slug: string;
  formation_title: string;
  format_type: FormationFormat;
  dashboard_type: DashboardType;
  order_reference: string;
  order_status: OrderStatus | null;
  payments_count: number;
  confirmed_payments_count: number;
  pending_payments_count: number;
  late_payments_count: number;
  failed_payments_count: number;
  cancelled_payments_count: number;
  session_id: number | null;
  session_label: string | null;
  session_start_date: string | null;
  session_end_date: string | null;
  campus_label?: string | null;
  teacher_name?: string | null;
  status: EnrollmentStatus;
  created_at: string;
};

export type AdminEnrollmentUpdatePayload = {
  status: EnrollmentStatus;
};

export type AdminOnsiteSession = {
  id: number;
  formation_id: number;
  formation_slug: string;
  formation_title: string;
  format_type: FormationFormat;
  label: string;
  start_date: string;
  end_date: string;
  campus_label: string;
  seat_capacity: number;
  enrolled_count: number;
  teacher_name: string;
  status: SessionStatus;
  session_state: SessionState;
  can_purchase: boolean;
  session_label: string | null;
  meeting_link: string | null;
};

export type AdminFormationSessionCreatePayload = {
  formation_id: number;
  label: string;
  start_date: string;
  end_date: string;
  campus_label?: string | null;
  seat_capacity?: number;
  teacher_name?: string | null;
  status?: SessionStatus;
  meeting_link?: string | null;
};

export type AdminOnsiteSessionUpdatePayload = {
  label?: string;
  start_date?: string;
  end_date?: string;
  campus_label?: string;
  seat_capacity?: number;
  teacher_name?: string | null;
  status?: SessionStatus;
  meeting_link?: string | null;
};

export type AdminOrder = {
  id: number;
  reference: string;
  customer_name: string;
  formation_title: string;
  total_amount: number;
  total_amount_label: string;
  currency: string;
  status: OrderStatus;
  created_at: string;
};

export type AdminOrderUpdatePayload = {
  status: OrderStatus;
};

export type AdminPayment = {
  id: number;
  order_reference: string;
  payer_name: string;
  amount: number;
  amount_label: string;
  currency: string;
  order_status: OrderStatus | null;
  installment_plan?: string | null;
  installment_number: number | null;
  due_date: string | null;
  provider_code: string;
  status: PaymentStatus;
  reminder_count: number;
  last_reminded_at: string | null;
  can_send_reminder: boolean;
  paid_at: string | null;
  created_at: string;
};

export type AdminPaymentUpdatePayload = {
  provider_code?: string;
  status?: PaymentStatus;
};

export type AdminUploadedAsset = {
  filename: string;
  path: string;
  public_url: string;
  content_type: string;
  size: number;
};

export function mapCatalogFormationToCourse(
  formation: CatalogFormation,
): EcommerceCourse {
  return {
    id: formation.id,
    slug: formation.slug,
    title: formation.title,
    level: formation.level,
    rating: formation.rating,
    reviews: formation.reviews,
    image: formation.image,
    currentPrice: formation.current_price_label,
    originalPrice: formation.original_price_label ?? undefined,
    badges: formation.badges,
    sessionLabel: formation.session_label ?? formation.card_session_label ?? "",
    formatType: formation.format_type,
    isFeaturedHome: formation.is_featured_home,
    homeFeatureRank: formation.home_feature_rank,
    canPurchase: formation.can_purchase,
    purchaseMessage: formation.purchase_message,
    sessionState: formation.session_state,
  };
}

export async function fetchPublicFormations(): Promise<CatalogFormation[]> {
  return apiRequest<CatalogFormation[]>("/formations");
}

export async function fetchPublicFormation(
  slug: string,
): Promise<FormationDetailItem> {
  return apiRequest<FormationDetailItem>(`/formations/${slug}`);
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
  return apiRequest<AdminOverview>("/admin/stats/overview");
}

export async function fetchAdminFormations(): Promise<AdminFormation[]> {
  return apiRequest<AdminFormation[]>("/admin/formations");
}

export async function createAdminFormation(
  payload: AdminFormationCreatePayload,
): Promise<AdminFormation> {
  return apiRequest<AdminFormation>("/admin/formations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAdminFormation(
  slug: string,
  payload: AdminFormationUpdatePayload,
): Promise<AdminFormation> {
  return apiRequest<AdminFormation>(`/admin/formations/${slug}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  return apiRequest<AdminUser[]>("/admin/users");
}

export async function updateAdminUser(
  userId: number,
  payload: AdminUserUpdatePayload,
): Promise<AdminUser> {
  return apiRequest<AdminUser>(`/admin/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminEnrollments(): Promise<AdminEnrollment[]> {
  return apiRequest<AdminEnrollment[]>("/admin/enrollments");
}

export async function updateAdminEnrollment(
  enrollmentId: number,
  payload: AdminEnrollmentUpdatePayload,
): Promise<AdminEnrollment> {
  return apiRequest<AdminEnrollment>(`/admin/enrollments/${enrollmentId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminOnsiteSessions(): Promise<AdminOnsiteSession[]> {
  return apiRequest<AdminOnsiteSession[]>("/admin/onsite-sessions");
}

export async function createAdminOnsiteSession(
  payload: AdminFormationSessionCreatePayload,
): Promise<AdminOnsiteSession> {
  return apiRequest<AdminOnsiteSession>("/admin/onsite-sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAdminOnsiteSession(
  sessionId: number,
  payload: AdminOnsiteSessionUpdatePayload,
): Promise<AdminOnsiteSession> {
  return apiRequest<AdminOnsiteSession>(`/admin/onsite-sessions/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminOrders(): Promise<AdminOrder[]> {
  return apiRequest<AdminOrder[]>("/admin/orders");
}

export async function updateAdminOrder(
  orderId: number,
  payload: AdminOrderUpdatePayload,
): Promise<AdminOrder> {
  return apiRequest<AdminOrder>(`/admin/orders/${orderId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminPayments(): Promise<AdminPayment[]> {
  return apiRequest<AdminPayment[]>("/admin/payments");
}

export async function updateAdminPayment(
  paymentId: number,
  payload: AdminPaymentUpdatePayload,
): Promise<AdminPayment> {
  return apiRequest<AdminPayment>(`/admin/payments/${paymentId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function sendAdminPaymentReminder(paymentId: number): Promise<AdminPayment> {
  return apiRequest<AdminPayment>(`/admin/payments/${paymentId}/reminders`, {
    method: "POST",
  });
}

/* ── Teacher session types ── */
export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export type SessionStudent = {
  enrollment_id: number;
  student_id: number;
  full_name: string;
  email: string;
  student_code: string | null;
  enrollment_status: string;
};

export type AttendanceRow = {
  enrollment_id: number;
  course_day_id: number | null;
  status: AttendanceStatus;
  note: string | null;
  student_name: string;
  course_day_title: string | null;
  course_day_scheduled_at: string | null;
};

export type AttendanceEntry = {
  enrollment_id: number;
  course_day_id?: number | null;
  status: AttendanceStatus;
  note?: string | null;
};

export type GradeRow = {
  enrollment_id: number;
  course_day_id: number | null;
  label: string;
  score: number;
  max_score: number;
  note: string | null;
  student_name: string;
  course_day_title: string | null;
  course_day_scheduled_at: string | null;
};

export type GradeEntry = {
  enrollment_id: number;
  course_day_id?: number | null;
  label: string;
  score: number;
  max_score?: number;
  note?: string | null;
};

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

export async function fetchSessionStudents(sessionId: number): Promise<SessionStudent[]> {
  return apiRequest<SessionStudent[]>(`/teacher/sessions/${sessionId}/students`);
}

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

export async function fetchSessionAttendance(sessionId: number): Promise<AttendanceRow[]> {
  return apiRequest<AttendanceRow[]>(`/teacher/sessions/${sessionId}/attendance`);
}

export async function fetchCourseDayAttendance(courseDayId: number): Promise<AttendanceRow[]> {
  return apiRequest<AttendanceRow[]>(`/teacher/course-days/${courseDayId}/attendance`);
}

export async function saveSessionAttendance(
  sessionId: number,
  entries: AttendanceEntry[],
): Promise<AttendanceRow[]> {
  return apiRequest<AttendanceRow[]>(`/teacher/sessions/${sessionId}/attendance`, {
    method: "POST",
    body: JSON.stringify(entries),
  });
}

export async function saveCourseDayAttendance(
  courseDayId: number,
  entries: AttendanceEntry[],
): Promise<AttendanceRow[]> {
  return apiRequest<AttendanceRow[]>(`/teacher/course-days/${courseDayId}/attendance`, {
    method: "POST",
    body: JSON.stringify(entries),
  });
}

export async function fetchSessionGrades(sessionId: number): Promise<GradeRow[]> {
  return apiRequest<GradeRow[]>(`/teacher/sessions/${sessionId}/grades`);
}

export async function saveSessionGrades(
  sessionId: number,
  entries: GradeEntry[],
): Promise<GradeRow[]> {
  return apiRequest<GradeRow[]>(`/teacher/sessions/${sessionId}/grades`, {
    method: "POST",
    body: JSON.stringify(entries),
  });
}

export type SiteConfig = {
  site_name?: string;
  tagline?: string;
  seo_description?: string;
  logo_url?: string;
  favicon_url?: string;
  banner_title?: string;
  banner_subtitle?: string;
  banner_cta?: string;
  banner_image_url?: string;
  color_primary?: string;
  color_accent?: string;
  font_heading?: string;
  font_body?: string;
};

export async function fetchSiteConfig(): Promise<SiteConfig> {
  return apiRequest<SiteConfig>("/admin/site-config");
}

export async function updateSiteConfig(payload: SiteConfig): Promise<SiteConfig> {
  return apiRequest<SiteConfig>("/admin/site-config", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export type LessonKey = {
  module_index: number;
  lesson_index: number;
};

export type EnrollmentProgress = {
  enrollment_id: number;
  completed: LessonKey[];
  total_lessons: number;
  completed_count: number;
  progress_pct: number;
};

export async function fetchEnrollmentProgress(enrollmentId: number): Promise<EnrollmentProgress> {
  return apiRequest<EnrollmentProgress>(`/me/enrollments/${enrollmentId}/progress`);
}

export async function toggleLessonCompletion(
  enrollmentId: number,
  moduleIndex: number,
  lessonIndex: number,
): Promise<EnrollmentProgress> {
  return apiRequest<EnrollmentProgress>(
    `/me/enrollments/${enrollmentId}/lessons/${moduleIndex}/${lessonIndex}/toggle`,
    { method: "POST" },
  );
}

export type CertificateView = {
  enrollment_id: number;
  certificate_number: string;
  student_name: string;
  formation_title: string;
  format_type: string;
  dashboard_type: string;
  mentor_name: string;
  level: string;
  session_label: string;
  issued_date: string;
};

export async function fetchCertificate(enrollmentId: number): Promise<CertificateView> {
  return apiRequest<CertificateView>(`/me/enrollments/${enrollmentId}/certificate`);
}

export async function uploadAdminAsset(file: File): Promise<AdminUploadedAsset> {
  const params = new URLSearchParams({ filename: file.name });
  return apiRequest<AdminUploadedAsset>(`/admin/uploads?${params.toString()}`, {
    method: "POST",
    body: file,
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    timeoutMs: 60000,
  });
}

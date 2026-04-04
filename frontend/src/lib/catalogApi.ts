import type { CourseBadge, EcommerceCourse } from "../data/ecommerceHomeData";
import { apiRequest } from "./apiClient";

export type FormationFormat = "live" | "ligne" | "presentiel";
export type DashboardType = "classic" | "guided";
export type MarketingBadge = Exclude<CourseBadge, "promo">;
export type UserRole = "admin" | "teacher" | "student";
export type UserStatus = "active" | "suspended";
export type SessionStatus = "planned" | "open" | "completed" | "cancelled";
export type SessionState =
  | "not_applicable"
  | "unscheduled"
  | "upcoming"
  | "started_open"
  | "started_closed"
  | "ended";
export type OrderStatus = "pending" | "paid" | "partially_paid" | "failed" | "cancelled";
export type PaymentStatus = "pending" | "confirmed" | "failed";

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
  certificate_copy?: string;
  certificate_image?: string;
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
  certificate_copy?: string;
  certificate_image?: string;
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
  total_confirmed_revenue_amount: number;
  total_confirmed_revenue_label: string;
};

export type AdminUser = {
  id: number;
  full_name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
};

export type AdminUserUpdatePayload = {
  role?: UserRole;
  status?: UserStatus;
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
};

export type AdminOnsiteSessionUpdatePayload = {
  label?: string;
  start_date?: string;
  end_date?: string;
  campus_label?: string;
  seat_capacity?: number;
  teacher_name?: string;
  status?: SessionStatus;
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
  provider_code: string;
  status: PaymentStatus;
  paid_at: string | null;
  created_at: string;
};

export type AdminPaymentUpdatePayload = {
  provider_code?: string;
  status?: PaymentStatus;
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

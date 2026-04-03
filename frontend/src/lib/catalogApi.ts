import type { CourseBadge, EcommerceCourse } from "../data/ecommerceHomeData";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

export type FormationFormat = "live" | "ligne" | "presentiel";
export type DashboardType = "classic" | "guided";
export type MarketingBadge = Exclude<CourseBadge, "promo">;
export type UserRole = "admin" | "teacher" | "student";
export type UserStatus = "active" | "suspended";
export type SessionStatus = "planned" | "open" | "completed" | "cancelled";
export type OrderStatus = "pending" | "paid" | "partially_paid" | "failed" | "cancelled";
export type PaymentStatus = "pending" | "confirmed" | "failed";

export type CatalogFormation = {
  id: number;
  slug: string;
  title: string;
  category: string;
  level: string;
  image: string;
  format_type: FormationFormat;
  dashboard_type: DashboardType;
  session_label: string;
  current_price_amount: number;
  current_price_label: string;
  original_price_amount: number | null;
  original_price_label: string | null;
  price_currency: string;
  allow_installments: boolean;
  rating: number;
  reviews: number;
  badges: CourseBadge[];
};

export type AdminFormationCreatePayload = {
  slug: string;
  title: string;
  category: string;
  level: string;
  image: string;
  format_type: FormationFormat;
  current_price_amount: number;
  original_price_amount?: number | null;
  session_label: string;
  rating?: number;
  reviews?: number;
  badges?: MarketingBadge[];
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
  session_label?: string;
  badges?: MarketingBadge[];
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
  formation_title: string;
  label: string;
  start_date: string;
  campus_label: string;
  seat_capacity: number;
  enrolled_count: number;
  teacher_name: string;
  status: SessionStatus;
};

export type AdminOnsiteSessionUpdatePayload = {
  label?: string;
  start_date?: string;
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
    const detail = await response.text();
    throw new Error(detail || `HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

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
    sessionLabel: formation.session_label,
    formatType: formation.format_type,
  };
}

export async function fetchPublicFormations(): Promise<CatalogFormation[]> {
  return request<CatalogFormation[]>("/formations");
}

export async function fetchPublicFormation(
  slug: string,
): Promise<CatalogFormation> {
  return request<CatalogFormation>(`/formations/${slug}`);
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
  return request<AdminOverview>("/admin/stats/overview");
}

export async function fetchAdminFormations(): Promise<CatalogFormation[]> {
  return request<CatalogFormation[]>("/admin/formations");
}

export async function createAdminFormation(
  payload: AdminFormationCreatePayload,
): Promise<CatalogFormation> {
  return request<CatalogFormation>("/admin/formations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAdminFormation(
  slug: string,
  payload: AdminFormationUpdatePayload,
): Promise<CatalogFormation> {
  return request<CatalogFormation>(`/admin/formations/${slug}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  return request<AdminUser[]>("/admin/users");
}

export async function updateAdminUser(
  userId: number,
  payload: AdminUserUpdatePayload,
): Promise<AdminUser> {
  return request<AdminUser>(`/admin/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminOnsiteSessions(): Promise<AdminOnsiteSession[]> {
  return request<AdminOnsiteSession[]>("/admin/onsite-sessions");
}

export async function updateAdminOnsiteSession(
  sessionId: number,
  payload: AdminOnsiteSessionUpdatePayload,
): Promise<AdminOnsiteSession> {
  return request<AdminOnsiteSession>(`/admin/onsite-sessions/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminOrders(): Promise<AdminOrder[]> {
  return request<AdminOrder[]>("/admin/orders");
}

export async function updateAdminOrder(
  orderId: number,
  payload: AdminOrderUpdatePayload,
): Promise<AdminOrder> {
  return request<AdminOrder>(`/admin/orders/${orderId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminPayments(): Promise<AdminPayment[]> {
  return request<AdminPayment[]>("/admin/payments");
}

export async function updateAdminPayment(
  paymentId: number,
  payload: AdminPaymentUpdatePayload,
): Promise<AdminPayment> {
  return request<AdminPayment>(`/admin/payments/${paymentId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

import { apiRequest } from "./apiClient";

export type FormationFormat = "live" | "ligne" | "presentiel";
export type DashboardType = "classic" | "guided";

export type CartItem = {
  id: number;
  formation_id: number;
  formation_slug: string;
  title: string;
  image: string;
  format_type: FormationFormat;
  dashboard_type: DashboardType;
  session_label: string;
  level: string;
  current_price_amount: number;
  current_price_label: string;
  original_price_label: string | null;
  allow_installments: boolean;
};

export type CartSnapshot = {
  items: CartItem[];
  total_amount: number;
  total_amount_label: string;
  live_items_count: number;
  ligne_items_count: number;
  presentiel_items_count: number;
  classic_items_count: number;
  guided_items_count: number;
};

export type FavoriteItem = {
  id: number;
  formation_id: number;
  formation_slug: string;
  title: string;
  image: string;
  format_type: FormationFormat;
  dashboard_type: DashboardType;
  session_label: string;
  level: string;
  current_price_amount: number;
  current_price_label: string;
  original_price_label: string | null;
  allow_installments: boolean;
  rating: number;
  reviews: number;
  badges: string[];
};

export type FavoriteSnapshot = {
  items: FavoriteItem[];
  total_count: number;
};

export type CheckoutResult = {
  message: string;
  redirect_path: string;
  processed_items: number;
  order_references: string[];
};

export type Enrollment = {
  id: number;
  formation_id: number;
  formation_slug: string;
  formation_title: string;
  image: string;
  format_type: FormationFormat;
  dashboard_type: DashboardType;
  order_reference: string;
  status: string;
  student_code: string | null;
  session_label: string;
  created_at: string;
};

export type StudentDashboardSummary = {
  student_code: string | null;
  live_enrollments_count: number;
  ligne_enrollments_count: number;
  presentiel_enrollments_count: number;
  classic_enrollments_count: number;
  guided_enrollments_count: number;
  classic_enrollments: Enrollment[];
  guided_enrollments: Enrollment[];
};

export type NotificationTone = "info" | "success" | "warning";
export type NotificationCategory =
  | "payment"
  | "enrollment"
  | "session"
  | "admin"
  | "system";

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  tone: NotificationTone;
  category: NotificationCategory;
  created_at: string;
  action_label: string | null;
  action_path: string | null;
};

export async function fetchCart(): Promise<CartSnapshot> {
  return apiRequest<CartSnapshot>("/cart");
}

export async function addToCart(formationSlug: string): Promise<CartSnapshot> {
  return apiRequest<CartSnapshot>("/cart/items", {
    method: "POST",
    body: JSON.stringify({ formation_slug: formationSlug }),
  });
}

export async function removeFromCart(
  formationSlug: string,
): Promise<CartSnapshot> {
  return apiRequest<CartSnapshot>(`/cart/items/${formationSlug}`, {
    method: "DELETE",
  });
}

export async function checkoutCart(): Promise<CheckoutResult> {
  return apiRequest<CheckoutResult>("/cart/checkout", {
    method: "POST",
  });
}

export async function fetchFavorites(): Promise<FavoriteSnapshot> {
  return apiRequest<FavoriteSnapshot>("/favorites");
}

export async function addToFavorites(
  formationSlug: string,
): Promise<FavoriteSnapshot> {
  return apiRequest<FavoriteSnapshot>("/favorites/items", {
    method: "POST",
    body: JSON.stringify({ formation_slug: formationSlug }),
  });
}

export async function removeFromFavorites(
  formationSlug: string,
): Promise<FavoriteSnapshot> {
  return apiRequest<FavoriteSnapshot>(`/favorites/items/${formationSlug}`, {
    method: "DELETE",
  });
}

export async function fetchStudentDashboardSummary(): Promise<StudentDashboardSummary> {
  return apiRequest<StudentDashboardSummary>("/me/dashboard");
}

export async function fetchStudentEnrollments(): Promise<Enrollment[]> {
  return apiRequest<Enrollment[]>("/me/enrollments");
}

export async function fetchNotifications(): Promise<NotificationItem[]> {
  return apiRequest<NotificationItem[]>("/me/notifications");
}

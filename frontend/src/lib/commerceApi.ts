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
  mentor_name: string | null;
  current_price_amount: number;
  current_price_label: string;
  original_price_label: string | null;
  allow_installments: boolean;
  can_purchase: boolean;
  purchase_message: string | null;
};

export type CartSnapshot = {
  items: CartItem[];
  total_amount: number;
  total_amount_label: string;
  allow_installments: boolean;
  installment_threshold_amount: number;
  installment_threshold_label: string;
  installment_schedules_preview: Record<string, InstallmentLine[]>;
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

export type InstallmentLine = {
  number: number;
  amount: number;
  amount_label: string;
  due_date: string; // ISO date
  status: string;
};

export type CheckoutResult = {
  message: string;
  redirect_path: string;
  external_redirect_url?: string | null;
  payment_provider?: string | null;
  processed_items: number;
  order_references: string[];
  installment_schedules: Record<string, InstallmentLine[]>;
  payment_links?: {
    whatsapp_link?: string | null;
    telegram_link?: string | null;
    dikalo_link?: string | null;
    sms_link?: string | null;
  } | null;
};

export type StripeCheckoutConfirmation = {
  status: string;
  matched_orders: string[];
  newly_confirmed_orders: string[];
  message: string;
};

export type PaymentProvider = "tara" | "stripe";
export type CheckoutPaymentMode = "full" | "installments";

export type CheckoutOptions = {
  useInstallments?: boolean;
  paymentMode?: CheckoutPaymentMode;
  paymentProvider?: PaymentProvider;
};

export type Enrollment = {
  id: number;
  formation_id: number;
  session_id: number | null;
  formation_slug: string;
  formation_title: string;
  image: string;
  format_type: FormationFormat;
  dashboard_type: DashboardType;
  order_reference: string;
  status: string;
  student_code: string | null;
  session_label: string;
  assigned_teacher: AssignedTeacher | null;
  created_at: string;
};

export type AssignedTeacher = {
  full_name: string;
  teacher_code: string | null;
  avatar_initials: string;
  avatar_url: string | null;
  email: string | null;
  whatsapp: string | null;
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

export async function checkoutCart(
  options: CheckoutOptions = {},
): Promise<CheckoutResult> {
  const paymentMode =
    options.paymentMode ?? (options.useInstallments ? "installments" : "full");
  return apiRequest<CheckoutResult>("/cart/checkout", {
    method: "POST",
    body: JSON.stringify({
      use_installments: paymentMode === "installments",
      payment_mode: paymentMode,
      payment_provider: options.paymentProvider ?? null,
    }),
    timeoutMs: 30000,
  });
}

export async function confirmStripeCheckoutSession(
  sessionId: string,
): Promise<StripeCheckoutConfirmation> {
  return apiRequest<StripeCheckoutConfirmation>("/stripe/checkout/confirm", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId }),
    timeoutMs: 30000,
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

export type StudentSession = {
  id: number;
  formation_id: number;
  formation_title: string;
  formation_slug: string;
  format_type: "live" | "ligne" | "presentiel";
  label: string;
  start_date: string;
  end_date: string;
  teacher_name: string | null;
  assigned_teacher: AssignedTeacher | null;
  campus_label: string | null;
  meeting_link: string | null;
  status: string;
};

export async function fetchMySessions(): Promise<StudentSession[]> {
  return apiRequest<StudentSession[]>("/me/sessions");
}

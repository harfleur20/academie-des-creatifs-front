const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

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

export async function fetchCart(): Promise<CartSnapshot> {
  return request<CartSnapshot>("/cart");
}

export async function addToCart(formationSlug: string): Promise<CartSnapshot> {
  return request<CartSnapshot>("/cart/items", {
    method: "POST",
    body: JSON.stringify({ formation_slug: formationSlug }),
  });
}

export async function removeFromCart(formationSlug: string): Promise<CartSnapshot> {
  return request<CartSnapshot>(`/cart/items/${formationSlug}`, {
    method: "DELETE",
  });
}

export async function checkoutCart(): Promise<CheckoutResult> {
  return request<CheckoutResult>("/cart/checkout", {
    method: "POST",
  });
}

export async function fetchStudentDashboardSummary(): Promise<StudentDashboardSummary> {
  return request<StudentDashboardSummary>("/me/dashboard");
}

export async function fetchStudentEnrollments(): Promise<Enrollment[]> {
  return request<Enrollment[]>("/me/enrollments");
}

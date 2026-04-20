import { useOutletContext } from "react-router-dom";

import type {
  AdminEnrollment,
  AdminFormation,
  AdminOnsiteSession,
  AdminOrder,
  AdminOverview,
  AdminPayment,
  AdminUser,
  EnrollmentStatus,
  OrderStatus,
  PaymentStatus,
  UserRole,
  UserStatus,
} from "../lib/catalogApi";

export type AdminInlineFeedback = {
  type: "success" | "error";
  message: string;
};

export type UserDraft = {
  role: UserRole;
  status: UserStatus;
};

export type OrderDraft = {
  status: OrderStatus;
};

export type EnrollmentDraft = {
  status: EnrollmentStatus;
  sessionId: number | null;
};

export type PaymentDraft = {
  providerCode: string;
  status: PaymentStatus;
};

export type CatalogDisplayFilter = "all" | "featured";

export type AdminDashboardOutletContext = {
  overview: AdminOverview | null;
  formations: AdminFormation[];
  sessions: AdminOnsiteSession[];
  users: AdminUser[];
  enrollments: AdminEnrollment[];
  orders: AdminOrder[];
  payments: AdminPayment[];
  loading: boolean;
  loadingError: string;
  filteredFormations: AdminFormation[];
  featuredFormationsCount: number;
  sessionCapableFormations: AdminFormation[];
  availableSessionCreateFormations: AdminFormation[];
  eligibleSessionFormationIds: Set<number>;
  catalogSearch: string;
  catalogDisplayFilter: CatalogDisplayFilter;
  setCatalogSearch: (value: string) => void;
  setCatalogDisplayFilter: (value: CatalogDisplayFilter) => void;
  openCreateFormationEditor: () => void;
  openEditFormationEditor: (slug: string) => void;
  openCreateSessionEditor: (formationId?: number) => void;
  openEditSessionEditor: (sessionId: number) => void;
  userDrafts: Record<number, UserDraft>;
  userRoles: UserRole[];
  userStatuses: UserStatus[];
  syncUserDraft: (userId: number, field: keyof UserDraft, value: UserRole | UserStatus) => void;
  savingUserId: number | null;
  handleSaveUser: (user: AdminUser) => void;
  userFeedbackById: Record<number, AdminInlineFeedback>;
  enrollmentDrafts: Record<number, EnrollmentDraft>;
  enrollmentStatuses: EnrollmentStatus[];
  syncEnrollmentDraft: (enrollmentId: number, status: EnrollmentStatus) => void;
  syncEnrollmentSessionDraft: (enrollmentId: number, sessionId: number | null) => void;
  savingEnrollmentId: number | null;
  handleSaveEnrollment: (enrollment: AdminEnrollment) => void;
  enrollmentFeedbackById: Record<number, AdminInlineFeedback>;
  orderDrafts: Record<number, OrderDraft>;
  orderStatuses: OrderStatus[];
  syncOrderDraft: (orderId: number, status: OrderStatus) => void;
  savingOrderId: number | null;
  handleSaveOrder: (order: AdminOrder) => void;
  orderFeedbackById: Record<number, AdminInlineFeedback>;
  paymentDrafts: Record<number, PaymentDraft>;
  paymentStatuses: PaymentStatus[];
  syncPaymentDraft: (
    paymentId: number,
    field: keyof PaymentDraft,
    value: string | PaymentStatus,
  ) => void;
  savingPaymentId: number | null;
  remindingPaymentId: number | null;
  handleSavePayment: (payment: AdminPayment) => void;
  handleSendPaymentReminder: (payment: AdminPayment) => void;
  paymentFeedbackById: Record<number, AdminInlineFeedback>;
};

export function useAdminDashboard() {
  return useOutletContext<AdminDashboardOutletContext>();
}

import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import AdminLayout from "./layouts/AdminLayout";
import PublicLayout from "./layouts/PublicLayout";
import StudentLayout from "./layouts/StudentLayout";
import TeacherLayout from "./layouts/TeacherLayout";

const AccountRedirectPage = lazy(() => import("./pages/AccountRedirectPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const DiagnosticPage = lazy(() => import("./pages/DiagnosticPage"));
const FavoritesPage = lazy(() => import("./pages/FavoritesPage"));
const FormationDetailPage = lazy(() => import("./pages/FormationDetailPage"));
const FormationsPage = lazy(() => import("./pages/FormationsPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const BoutiquePage = lazy(() => import("./pages/BoutiquePage"));
const TeamPage = lazy(() => import("./pages/TeamPage"));
const BlogPage = lazy(() => import("./pages/BlogPage"));
const BlogPostPage = lazy(() => import("./pages/BlogPostPage"));
const StudentClassicWorkspacePage = lazy(() => import("./pages/StudentClassicWorkspacePage"));
const StudentGuidedWorkspacePage = lazy(() => import("./pages/StudentGuidedWorkspacePage"));
const CertificatePage = lazy(() => import("./pages/CertificatePage"));
const TeacherSessionPage = lazy(() => import("./pages/TeacherSessionPage"));
const TeacherInvitationPage = lazy(() => import("./pages/TeacherInvitationPage"));
const LiveRoomPage = lazy(() => import("./pages/LiveRoomPage"));

const TeacherOverviewPage = lazy(() => import("./pages/teacher/TeacherOverviewPage"));
const TeacherSessionsPage = lazy(() => import("./pages/teacher/TeacherSessionsPage"));
const TeacherQuizzesPage = lazy(() => import("./pages/teacher/TeacherQuizzesPage"));
const TeacherResourcesPage = lazy(() => import("./pages/teacher/TeacherResourcesPage"));
const TeacherAssignmentsPage = lazy(() => import("./pages/teacher/TeacherAssignmentsPage"));
const TeacherCoursesPage = lazy(() => import("./pages/teacher/TeacherCoursesPage"));

const StudentOverviewPage = lazy(() => import("./pages/student/StudentOverviewPage"));
const StudentFormationsPage = lazy(() => import("./pages/student/StudentFormationsPage"));
const StudentParcoursPage = lazy(() => import("./pages/student/StudentParcoursPage"));
const StudentQuizzesPage = lazy(() => import("./pages/student/StudentQuizzesPage"));
const StudentResourcesPage = lazy(() => import("./pages/student/StudentResourcesPage"));
const StudentAssignmentsPage = lazy(() => import("./pages/student/StudentAssignmentsPage"));
const StudentResultsPage = lazy(() => import("./pages/student/StudentResultsPage"));
const StudentPaymentsPage = lazy(() => import("./pages/student/StudentPaymentsPage"));
const StudentCoursesPage = lazy(() => import("./pages/student/StudentCoursesPage"));
const StudentProfilePage = lazy(() => import("./pages/student/StudentProfilePage"));
const TeacherProfilePage = lazy(() => import("./pages/teacher/TeacherProfilePage"));
const AdminProfilePage = lazy(() => import("./pages/admin/AdminProfilePage"));
const HelpPage = lazy(() => import("./pages/HelpPage"));
const PublicHelpPage = lazy(() => import("./pages/PublicHelpPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

const AdminBlogPage = lazy(() => import("./pages/admin/AdminBlogPage"));
const AdminCataloguePage = lazy(() => import("./pages/admin/AdminCataloguePage"));
const AdminEnrollmentsPage = lazy(() => import("./pages/admin/AdminEnrollmentsPage"));
const AdminOverviewPage = lazy(() => import("./pages/admin/AdminOverviewPage"));
const AdminSessionsPage = lazy(() => import("./pages/admin/AdminSessionsPage"));
const AdminStudentsPage = lazy(() => import("./pages/admin/AdminStudentsPage"));
const AdminTeachersPage = lazy(() => import("./pages/admin/AdminTeachersPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminOrdersPage = lazy(() => import("./pages/admin/AdminOrdersPage"));
const AdminPaymentsPage = lazy(() => import("./pages/admin/AdminPaymentsPage"));
const AdminSitePage = lazy(() => import("./pages/admin/AdminSitePage"));
const AdminSiteGeneralPage = lazy(() =>
  import("./pages/admin/AdminSitePage").then((module) => ({ default: module.AdminSiteGeneralPage })),
);
const AdminSiteBannierePage = lazy(() =>
  import("./pages/admin/AdminSitePage").then((module) => ({ default: module.AdminSiteBannierePage })),
);
const AdminSiteThemePage = lazy(() =>
  import("./pages/admin/AdminSitePage").then((module) => ({ default: module.AdminSiteThemePage })),
);

function routePage(element: ReactNode) {
  return <Suspense fallback={<div className="dsh-page-loading">Chargement…</div>}>{element}</Suspense>;
}

export const router = createBrowserRouter([
  // ── Admin ──────────────────────────────────────────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={["admin"]} />,
    children: [
      {
        path: "/admin",
        element: <AdminLayout />,
        children: [
          {
            element: routePage(<DashboardPage />),
            children: [
              { index: true, element: routePage(<AdminOverviewPage />) },
              { path: "catalogue", element: routePage(<AdminCataloguePage />) },
              { path: "sessions", element: routePage(<AdminSessionsPage />) },
              { path: "enseignants", element: routePage(<AdminTeachersPage />) },
              { path: "etudiants", element: routePage(<AdminStudentsPage />) },
              { path: "utilisateurs", element: <Navigate replace to="/admin/etudiants" /> },
              { path: "roles", element: routePage(<AdminUsersPage />) },
              { path: "inscriptions", element: routePage(<AdminEnrollmentsPage />) },
              { path: "commandes", element: routePage(<AdminOrdersPage />) },
              { path: "paiements", element: routePage(<AdminPaymentsPage />) },
              { path: "blog", element: routePage(<AdminBlogPage />) },
              { path: "profil", element: routePage(<AdminProfilePage />) },
              { path: "aide", element: routePage(<HelpPage />) },
              {
                path: "site",
                element: routePage(<AdminSitePage />),
                children: [
                  { index: true, element: <Navigate replace to="general" /> },
                  { path: "general", element: routePage(<AdminSiteGeneralPage />) },
                  { path: "banniere", element: routePage(<AdminSiteBannierePage />) },
                  { path: "theme", element: routePage(<AdminSiteThemePage />) },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: "/dashboard",
    element: <Navigate replace to="/admin" />,
  },

  // ── Teacher dashboard ──────────────────────────────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={["teacher"]} />,
    children: [
      {
        path: "/espace/enseignant",
        element: <TeacherLayout />,
        children: [
          { index: true, element: routePage(<TeacherOverviewPage />) },
          { path: "sessions", element: routePage(<TeacherSessionsPage />) },
          { path: "session/:sessionId", element: routePage(<TeacherSessionPage />) },
          { path: "cours", element: routePage(<TeacherCoursesPage />) },
          { path: "quizz", element: routePage(<TeacherQuizzesPage />) },
          { path: "ressources", element: routePage(<TeacherResourcesPage />) },
          { path: "devoirs", element: routePage(<TeacherAssignmentsPage />) },
          { path: "profil", element: routePage(<TeacherProfilePage />) },
          { path: "aide", element: routePage(<HelpPage />) },
          { path: "notifications", element: routePage(<NotificationsPage />) },
        ],
      },
    ],
  },

  // ── Student dashboard ──────────────────────────────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={["student"]} />,
    children: [
      {
        path: "/espace/etudiant",
        element: <StudentLayout />,
        children: [
          { index: true, element: routePage(<StudentOverviewPage />) },
          { path: "formations", element: routePage(<StudentFormationsPage />) },
          { path: "parcours", element: routePage(<StudentParcoursPage />) },
          { path: "cours", element: routePage(<StudentCoursesPage />) },
          { path: "quizz", element: routePage(<StudentQuizzesPage />) },
          { path: "ressources", element: routePage(<StudentResourcesPage />) },
          { path: "devoirs", element: routePage(<StudentAssignmentsPage />) },
          { path: "resultats", element: routePage(<StudentResultsPage />) },
          { path: "paiements", element: routePage(<StudentPaymentsPage />) },
          { path: "profil", element: routePage(<StudentProfilePage />) },
          { path: "aide", element: routePage(<HelpPage />) },
          { path: "notifications", element: routePage(<NotificationsPage />) },
          { path: "favoris", element: routePage(<FavoritesPage />) },
          { path: "classic/:enrollmentId", element: routePage(<StudentClassicWorkspacePage />) },
          { path: "guided/:enrollmentId", element: routePage(<StudentGuidedWorkspacePage />) },
          { path: "certificat/:enrollmentId", element: routePage(<CertificatePage />) },
        ],
      },
    ],
  },

  // ── Live room (full screen, no layout) ────────────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={["student", "teacher", "admin"]} />,
    children: [
      { path: "/live/:sessionId", element: routePage(<LiveRoomPage />) },
    ],
  },

  // ── Public site ────────────────────────────────────────────────────────────
  {
    path: "/",
    element: <PublicLayout />,
    children: [
      { index: true, element: routePage(<HomePage />) },
      { path: "a-propos", element: routePage(<AboutPage />) },
      { path: "boutique", element: routePage(<BoutiquePage />) },
      { path: "notre-equipe", element: routePage(<TeamPage />) },
      { path: "blog", element: routePage(<BlogPage />) },
      { path: "blog/:slug", element: routePage(<BlogPostPage />) },
      { path: "diagnostic", element: routePage(<DiagnosticPage />) },
      { path: "aide", element: routePage(<PublicHelpPage />) },
      { path: "formations", element: routePage(<FormationsPage />) },
      { path: "formations/:slug", element: routePage(<FormationDetailPage />) },
      {
        element: <ProtectedRoute />,
        children: [
          { path: "panier", element: routePage(<CartPage />) },
          { path: "checkout", element: routePage(<CheckoutPage />) },
          { path: "espace", element: routePage(<AccountRedirectPage />) },
          { path: "favoris", element: routePage(<FavoritesPage />) },
          { path: "notifications", element: routePage(<NotificationsPage />) },
          { path: "parametres", element: routePage(<SettingsPage />) },
        ],
      },
      { path: "invitation/enseignant/:token", element: routePage(<TeacherInvitationPage />) },
      { path: "login", element: routePage(<AuthPage mode="login" />) },
      { path: "register", element: routePage(<AuthPage mode="register" />) },
      { path: "forgot-password", element: routePage(<ForgotPasswordPage />) },
      { path: "reset-password", element: routePage(<ResetPasswordPage />) },
      { path: "*", element: routePage(<NotFoundPage />) },
    ],
  },
]);

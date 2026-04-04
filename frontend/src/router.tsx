import { Navigate, createBrowserRouter } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import AdminLayout from "./layouts/AdminLayout";
import PublicLayout from "./layouts/PublicLayout";
import AccountRedirectPage from "./pages/AccountRedirectPage";
import AuthPage from "./pages/AuthPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import DashboardPage from "./pages/DashboardPage";
import FavoritesPage from "./pages/FavoritesPage";
import FormationDetailPage from "./pages/FormationDetailPage";
import FormationsPage from "./pages/FormationsPage";
import HomePage from "./pages/HomePage";
import NotFoundPage from "./pages/NotFoundPage";
import NotificationsPage from "./pages/NotificationsPage";
import StudentDashboardPage from "./pages/StudentDashboardPage";
import StudentClassicWorkspacePage from "./pages/StudentClassicWorkspacePage";
import StudentGuidedWorkspacePage from "./pages/StudentGuidedWorkspacePage";
import TeacherDashboardPage from "./pages/TeacherDashboardPage";

export const router = createBrowserRouter([
  {
    element: <ProtectedRoute allowedRoles={["admin"]} />,
    children: [
      {
        path: "/admin",
        element: <AdminLayout />,
        children: [{ index: true, element: <DashboardPage /> }],
      },
    ],
  },
  {
    path: "/dashboard",
    element: <Navigate replace to="/admin" />,
  },
  {
    path: "/",
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "formations", element: <FormationsPage /> },
      { path: "formations/:slug", element: <FormationDetailPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: "panier", element: <CartPage /> },
          { path: "checkout", element: <CheckoutPage /> },
          { path: "espace", element: <AccountRedirectPage /> },
          { path: "favoris", element: <FavoritesPage /> },
          { path: "notifications", element: <NotificationsPage /> },
        ],
      },
      {
        element: <ProtectedRoute allowedRoles={["student"]} />,
        children: [
          { path: "espace/etudiant", element: <StudentDashboardPage /> },
          {
            path: "espace/etudiant/classic/:enrollmentId",
            element: <StudentClassicWorkspacePage />,
          },
          {
            path: "espace/etudiant/guided/:enrollmentId",
            element: <StudentGuidedWorkspacePage />,
          },
        ],
      },
      {
        element: <ProtectedRoute allowedRoles={["teacher"]} />,
        children: [{ path: "espace/enseignant", element: <TeacherDashboardPage /> }],
      },
      { path: "login", element: <AuthPage mode="login" /> },
      { path: "register", element: <AuthPage mode="register" /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

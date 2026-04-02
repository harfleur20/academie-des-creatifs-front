import { createBrowserRouter } from "react-router-dom";

import PublicLayout from "./layouts/PublicLayout";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import FormationsPage from "./pages/FormationsPage";
import HomePage from "./pages/HomePage";
import NotFoundPage from "./pages/NotFoundPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "formations", element: <FormationsPage /> },
      { path: "login", element: <AuthPage mode="login" /> },
      { path: "register", element: <AuthPage mode="register" /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

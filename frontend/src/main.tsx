import ReactDOM from "react-dom/client";

import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { CartProvider } from "./cart/CartContext";
import { FavoritesProvider } from "./favorites/FavoritesContext";
import { ToastProvider } from "./toast/ToastContext";
import "./styles/global.css";
import "./styles/ecommerce.css";
import "./styles/course.css";
import "./styles/team.css";
import "./styles/about.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ToastProvider>
    <AuthProvider>
      <FavoritesProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </FavoritesProvider>
    </AuthProvider>
  </ToastProvider>,
);

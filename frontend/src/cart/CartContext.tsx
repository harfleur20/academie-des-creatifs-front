import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "../auth/AuthContext";
import { canUseCommerce } from "../lib/commerceAccess";
import {
  addToCart as addToCartRequest,
  checkoutCart as checkoutCartRequest,
  fetchCart,
  removeFromCart as removeFromCartRequest,
  type CartSnapshot,
  type CheckoutOptions,
  type CheckoutResult,
} from "../lib/commerceApi";
import { getCommerceRoleRestrictedMessage } from "../lib/userMessages";

const emptyCart: CartSnapshot = {
  items: [],
  total_amount: 0,
  total_amount_label: "0 FCFA",
  allow_installments: false,
  installment_threshold_amount: 100000,
  installment_threshold_label: "100 000 FCFA",
  installment_schedules_preview: {},
  live_items_count: 0,
  ligne_items_count: 0,
  presentiel_items_count: 0,
  classic_items_count: 0,
  guided_items_count: 0,
};

type CartContextValue = {
  cart: CartSnapshot;
  isLoading: boolean;
  refreshCart: () => Promise<CartSnapshot>;
  addToCart: (formationSlug: string) => Promise<CartSnapshot>;
  removeFromCart: (formationSlug: string) => Promise<CartSnapshot>;
  checkout: (options?: CheckoutOptions) => Promise<CheckoutResult>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [cart, setCart] = useState<CartSnapshot>(emptyCart);
  const [isLoading, setIsLoading] = useState(true);

  const refreshCart = async () => {
    if (!user || !canUseCommerce(user)) {
      setCart(emptyCart);
      return emptyCart;
    }

    const nextCart = await fetchCart();
    setCart(nextCart);
    return nextCart;
  };

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!user || !canUseCommerce(user)) {
      setCart(emptyCart);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    refreshCart()
      .catch(() => {
        setCart(emptyCart);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isAuthLoading, user]);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      isLoading,
      refreshCart,
      addToCart: async (formationSlug) => {
        if (!canUseCommerce(user)) {
          throw new Error(getCommerceRoleRestrictedMessage(user));
        }

        const nextCart = await addToCartRequest(formationSlug);
        setCart(nextCart);
        return nextCart;
      },
      removeFromCart: async (formationSlug) => {
        const nextCart = await removeFromCartRequest(formationSlug);
        setCart(nextCart);
        return nextCart;
      },
      checkout: async (options?: CheckoutOptions) => {
        if (!canUseCommerce(user)) {
          throw new Error(getCommerceRoleRestrictedMessage(user));
        }

        const result = await checkoutCartRequest(options ?? {});
        if (!result.external_redirect_url && !result.payment_links) {
          const nextCart = await fetchCart();
          setCart(nextCart);
        }
        return result;
      },
    }),
    [cart, isLoading, user],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider.");
  }
  return context;
}

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "../auth/AuthContext";
import {
  addToFavorites as addToFavoritesRequest,
  fetchFavorites,
  removeFromFavorites as removeFromFavoritesRequest,
  type FavoriteSnapshot,
} from "../lib/commerceApi";

const emptyFavorites: FavoriteSnapshot = {
  items: [],
  total_count: 0,
};

type FavoritesContextValue = {
  favorites: FavoriteSnapshot;
  isLoading: boolean;
  refreshFavorites: () => Promise<FavoriteSnapshot>;
  addToFavorites: (formationSlug: string) => Promise<FavoriteSnapshot>;
  removeFromFavorites: (formationSlug: string) => Promise<FavoriteSnapshot>;
  toggleFavorite: (formationSlug: string) => Promise<FavoriteSnapshot>;
  hasFavorite: (formationSlug: string) => boolean;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteSnapshot>(emptyFavorites);
  const [isLoading, setIsLoading] = useState(true);

  const refreshFavorites = async () => {
    if (!user) {
      setFavorites(emptyFavorites);
      return emptyFavorites;
    }

    const nextFavorites = await fetchFavorites();
    setFavorites(nextFavorites);
    return nextFavorites;
  };

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!user) {
      setFavorites(emptyFavorites);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    refreshFavorites()
      .catch(() => {
        setFavorites(emptyFavorites);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isAuthLoading, user]);

  const value = useMemo<FavoritesContextValue>(
    () => ({
      favorites,
      isLoading,
      refreshFavorites,
      addToFavorites: async (formationSlug) => {
        const nextFavorites = await addToFavoritesRequest(formationSlug);
        setFavorites(nextFavorites);
        return nextFavorites;
      },
      removeFromFavorites: async (formationSlug) => {
        const nextFavorites = await removeFromFavoritesRequest(formationSlug);
        setFavorites(nextFavorites);
        return nextFavorites;
      },
      toggleFavorite: async (formationSlug) => {
        const exists = favorites.items.some((item) => item.formation_slug === formationSlug);
        const nextFavorites = exists
          ? await removeFromFavoritesRequest(formationSlug)
          : await addToFavoritesRequest(formationSlug);
        setFavorites(nextFavorites);
        return nextFavorites;
      },
      hasFavorite: (formationSlug) =>
        favorites.items.some((item) => item.formation_slug === formationSlug),
    }),
    [favorites, isLoading],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites must be used within a FavoritesProvider.");
  }
  return context;
}

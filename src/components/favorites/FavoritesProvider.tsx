"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiRequest, ApiClientError } from "@/components/ui";

type TargetType = "service" | "professional";

interface FavoritesContextValue {
  /** True once the initial state has been loaded (guests included). */
  ready: boolean;
  /** True when the visitor is a signed-in customer. */
  signedIn: boolean;
  has: (type: TargetType, id: string) => boolean;
  toggle: (type: TargetType, id: string) => Promise<boolean>;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

/** Shares the signed-in customer's saved services and professionals across the site. */
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [keys, setKeys] = useState<Set<string>>(() => new Set());
  const [signedIn, setSignedIn] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    apiRequest<{ signedIn: boolean; keys: string[] }>("GET", "/favorites/keys")
      .then((state) => {
        if (!alive) return;
        setKeys(new Set(state.keys));
        setSignedIn(state.signedIn);
      })
      .catch(() => {
        if (alive) setSignedIn(false);
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const toggle = useCallback(
    async (type: TargetType, id: string) => {
      if (!signedIn) throw new ApiClientError("برای ذخیره، ابتدا وارد حساب کاربری شوید", 401, "unauthorized");
      const res = await apiRequest<{ active: boolean }>("POST", "/favorites/toggle", { targetType: type, targetId: id });
      setKeys((prev) => {
        const next = new Set(prev);
        const key = `${type}:${id}`;
        if (res.active) next.add(key);
        else next.delete(key);
        return next;
      });
      return res.active;
    },
    [signedIn],
  );

  const value = useMemo<FavoritesContextValue>(
    () => ({ ready, signedIn, has: (type, id) => keys.has(`${type}:${id}`), toggle }),
    [ready, signedIn, keys, toggle],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used inside FavoritesProvider");
  return ctx;
}

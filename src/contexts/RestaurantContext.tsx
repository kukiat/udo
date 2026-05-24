"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { api } from "@/lib/fetcher";
import type { BranchSettings } from "@/lib/utils";

type Station = { id: string; name: string; sortOrder: number };

export type BranchSummary = {
  id: string;
  name: string;
  address: string | null;
  settings: BranchSettings;
};

type RestaurantResponse = {
  restaurant: {
    id: string;
    name: string;
    logo: string | null;
    branches: BranchSummary[];
  };
};

type StationsResponse = { stations: Station[] };

const branchKey = (restaurantId: string) => `rms.branch.${restaurantId}`;

type RestaurantContextValue = {
  loading: boolean;
  error: string | null;
  restaurantId: string;
  restaurantName: string | null;
  restaurantLogo: string | null;
  branches: BranchSummary[];
  branchId: string | null;
  branchName: string | null;
  settings: BranchSettings | null;
  stations: Station[];
  setBranch: (id: string) => void;
  /** Reload the restaurant + branches (after a create/edit/delete). */
  refresh: () => Promise<void>;
};

const RestaurantContext = createContext<RestaurantContextValue | null>(null);

export function RestaurantProvider({
  restaurantId,
  children,
}: {
  restaurantId: string;
  children: React.ReactNode;
}) {
  const [data, setData] = useState<RestaurantResponse["restaurant"] | null>(
    null,
  );
  const [branchId, setBranchId] = useState<string | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { restaurant } = await api<RestaurantResponse>(
      `/api/restaurants/${restaurantId}?withBranches=true`,
    );
    setData(restaurant);

    // Reconcile branch selection against the loaded branches.
    const stored =
      typeof window !== "undefined"
        ? localStorage.getItem(branchKey(restaurantId))
        : null;
    setBranchId((curr) => {
      const wanted = curr ?? stored;
      const b =
        restaurant.branches.find((x) => x.id === wanted) ??
        restaurant.branches[0] ??
        null;
      return b?.id ?? null;
    });
  }, [restaurantId]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    load()
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [load]);

  // Persist branch selection + fetch its KDS stations.
  useEffect(() => {
    if (!branchId) {
      setStations([]);
      return;
    }
    localStorage.setItem(branchKey(restaurantId), branchId);
    let active = true;
    api<StationsResponse>(`/api/kds-stations?branchId=${branchId}`)
      .then((d) => active && setStations(d.stations))
      .catch(() => active && setStations([]));
    return () => {
      active = false;
    };
  }, [branchId, restaurantId]);

  const setBranch = useCallback((id: string) => setBranchId(id), []);

  const value = useMemo<RestaurantContextValue>(() => {
    const branch = data?.branches.find((b) => b.id === branchId) ?? null;
    return {
      loading,
      error,
      restaurantId,
      restaurantName: data?.name ?? null,
      restaurantLogo: data?.logo ?? null,
      branches: data?.branches ?? [],
      branchId,
      branchName: branch?.name ?? null,
      settings: branch?.settings ?? null,
      stations,
      setBranch,
      refresh: load,
    };
  }, [data, branchId, stations, loading, error, restaurantId, setBranch, load]);

  return (
    <RestaurantContext.Provider value={value}>
      {children}
    </RestaurantContext.Provider>
  );
}

export function useRestaurant() {
  const ctx = useContext(RestaurantContext);
  if (!ctx) {
    throw new Error("useRestaurant must be used within a RestaurantProvider");
  }
  return ctx;
}

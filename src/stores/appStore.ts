import { create } from "zustand";
import type { CommercialTier } from "../lib/commercialTiers";
import { getCurrentPeriod } from "../lib/dates";

type AppStore = {
  activePeriod: string;
  isNavOpen: boolean;
  theme: "light" | "warm";
  commercialTier: CommercialTier;
  hasCompletedOnboarding: boolean;
  isAppReady: boolean;
  bootstrapError: string;
  installPromptAvailable: boolean;
  setActivePeriod: (period: string) => void;
  setNavOpen: (value: boolean) => void;
  setTheme: (theme: "light" | "warm") => void;
  setCommercialTier: (tier: CommercialTier) => void;
  setHasCompletedOnboarding: (value: boolean) => void;
  setAppReady: (value: boolean) => void;
  setBootstrapError: (value: string) => void;
  setInstallPromptAvailable: (value: boolean) => void;
};

export const useAppStore = create<AppStore>((set) => ({
  activePeriod: getCurrentPeriod(),
  isNavOpen: false,
  theme: "light",
  commercialTier: "inactive",
  hasCompletedOnboarding: false,
  isAppReady: false,
  bootstrapError: "",
  installPromptAvailable: false,
  setActivePeriod: (activePeriod) => set({ activePeriod }),
  setNavOpen: (isNavOpen) => set({ isNavOpen }),
  setTheme: (theme) => set({ theme }),
  setCommercialTier: (commercialTier) => set({ commercialTier }),
  setHasCompletedOnboarding: (hasCompletedOnboarding) => set({ hasCompletedOnboarding }),
  setAppReady: (isAppReady) => set({ isAppReady }),
  setBootstrapError: (bootstrapError) => set({ bootstrapError }),
  setInstallPromptAvailable: (installPromptAvailable) => set({ installPromptAvailable })
}));

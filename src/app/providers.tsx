import { useEffect, useState, type ReactNode } from "react";
import { RouterProvider } from "./router";
import { db } from "../db/client";
import { runDataFoundationMigrations } from "../db/migrations/dataFoundationMigration";
import { seedDefaultAccounts } from "../db/repositories/accountRepository";
import { seedDefaultExpenseCategories } from "../db/repositories/categoryRepository";
import { runDueRecurringTransactions } from "../db/repositories/recurringRepository";
import { getAppSetting, setAppSetting } from "../db/repositories/settingsRepository";
import { getCommercialTier } from "../db/repositories/tierRepository";
import { useAppStore } from "../stores/appStore";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
};

export function AppProviders({ children }: { children: ReactNode }) {
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const setCommercialTier = useAppStore((state) => state.setCommercialTier);
  const setHasCompletedOnboarding = useAppStore((state) => state.setHasCompletedOnboarding);
  const setAppReady = useAppStore((state) => state.setAppReady);
  const setBootstrapError = useAppStore((state) => state.setBootstrapError);
  const setInstallPromptAvailable = useAppStore((state) => state.setInstallPromptAvailable);

  useEffect(() => {
    async function bootLocalData() {
      try {
        await db.open();
        await seedDefaultAccounts();
        await seedDefaultExpenseCategories();
        await runDataFoundationMigrations();
        await runDueRecurringTransactions();
        const storedTheme = await getAppSetting<"light" | "warm">("theme");
        if (storedTheme) setTheme(storedTheme);
        setHasCompletedOnboarding(Boolean(await getAppSetting<boolean>("hasCompletedOnboarding")));
        setCommercialTier(await getCommercialTier());
        setSettingsLoaded(true);
      } catch (error) {
        setBootstrapError(error instanceof Error ? error.message : "Penyimpanan lokal DANAPETA tidak dapat dibuka.");
      } finally {
        setAppReady(true);
      }
    }

    void bootLocalData();
  }, [setAppReady, setBootstrapError, setCommercialTier, setHasCompletedOnboarding, setTheme]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (settingsLoaded) {
      void setAppSetting("theme", theme);
    }
  }, [settingsLoaded, theme]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      window.danapetaInstallPrompt = event as BeforeInstallPromptEvent;
      setInstallPromptAvailable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, [setInstallPromptAvailable]);

  return <RouterProvider>{children}</RouterProvider>;
}

declare global {
  interface Window {
    danapetaInstallPrompt?: BeforeInstallPromptEvent;
  }
}

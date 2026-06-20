import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useActiveRoute } from "../../app/router";
import { useAppStore } from "../../stores/appStore";
import { ErrorState, LoadingState } from "../ui/AppState";
import { BottomNav } from "./BottomNav";
import { DesktopSidebar } from "./DesktopSidebar";
import { PageHeader } from "./PageHeader";

export function AppShell({ children }: { children: ReactNode }) {
  const activeRoute = useActiveRoute();
  const isAppReady = useAppStore((state) => state.isAppReady);
  const bootstrapError = useAppStore((state) => state.bootstrapError);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <DesktopSidebar />
      <div className="lg:pl-72">
        <PageHeader title={activeRoute.label} />
        <motion.main
          key={activeRoute.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 pb-24 pt-4 sm:px-6 md:px-8 lg:pb-10"
        >
          {!isAppReady ? (
            <LoadingState title="Opening local planner" body="Preparing offline storage, default categories, and app preferences." />
          ) : bootstrapError ? (
            <ErrorState title="Local storage did not open" body={bootstrapError} />
          ) : (
            children
          )}
        </motion.main>
      </div>
      <BottomNav />
    </div>
  );
}

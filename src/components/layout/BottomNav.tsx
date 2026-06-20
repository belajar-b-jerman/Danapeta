import { MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";
import { appRoutes } from "../../app/routes";
import { useActiveRoute, useRouter } from "../../app/router";
import { cn } from "../../lib/cn";
import { Modal } from "../ui/Modal";

const primaryMobileRouteIds = ["dashboard", "transactions", "budgets", "goals"];
const moreRouteIds = ["netWorth", "insights", "settings"];

export function BottomNav() {
  const activeRoute = useActiveRoute();
  const { navigate } = useRouter();
  const [isMoreOpen, setMoreOpen] = useState(false);
  const mobileRoutes = appRoutes.filter((route) => primaryMobileRouteIds.includes(route.id));
  const moreRoutes = appRoutes.filter((route) => moreRouteIds.includes(route.id));
  const isMoreActive = moreRouteIds.includes(activeRoute.id);
  const showFab = activeRoute.id !== "transactions" && activeRoute.id !== "transactionExplorer";

  function openRoute(path: string) {
    navigate(path);
    setMoreOpen(false);
  }

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/5 bg-surface/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-soft backdrop-blur lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {mobileRoutes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.path)}
              aria-current={activeRoute.id === item.id ? "page" : undefined}
              className={cn(
                "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-semibold text-secondary transition active:bg-muted",
                activeRoute.id === item.id && "bg-muted text-ink"
              )}
            >
              <item.icon size={20} aria-hidden={true} />
              <span className="max-w-full truncate px-0.5">{item.label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-current={isMoreActive ? "page" : undefined}
            className={cn(
              "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-semibold text-secondary transition active:bg-muted",
              isMoreActive && "bg-muted text-ink"
            )}
          >
            <MoreHorizontal size={20} aria-hidden="true" />
            <span className="max-w-full truncate px-0.5">More</span>
          </button>
        </div>
      </nav>
      {showFab && (
        <button
          type="button"
          onClick={() => navigate("/transactions")}
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] right-4 z-50 grid h-12 w-12 place-items-center rounded-full bg-ink text-white shadow-soft lg:hidden"
          aria-label="Tambah transaksi"
        >
          <Plus size={22} aria-hidden="true" />
        </button>
      )}

      <Modal open={isMoreOpen} title="More" onClose={() => setMoreOpen(false)}>
        <div className="grid gap-2">
          {moreRoutes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => openRoute(item.path)}
              className={cn(
                "flex min-h-12 items-center gap-3 rounded-lg bg-muted/70 px-3 text-left text-sm font-semibold text-secondary",
                activeRoute.id === item.id && "text-ink"
              )}
            >
              <item.icon size={18} aria-hidden={true} />
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}

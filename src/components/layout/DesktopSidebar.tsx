import { Download, ShieldCheck } from "lucide-react";
import { appRoutes } from "../../app/routes";
import { useActiveRoute, useRouter } from "../../app/router";
import { Button } from "../ui/Button";
import { cn } from "../../lib/cn";

export function DesktopSidebar() {
  const activeRoute = useActiveRoute();
  const { navigate } = useRouter();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-ink/5 bg-surface px-5 py-6 lg:flex lg:flex-col">
      <div className="flex items-center">
        <img src="/danapeta-logo.png" alt="DANAPETA - Peta Finansialmu" className="h-14 w-auto max-w-[220px] object-contain" />
      </div>

      <nav className="mt-8 grid gap-1">
        {appRoutes.filter((route) => route.showInNav !== false).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(item.path)}
            aria-current={activeRoute.id === item.id ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-secondary transition hover:bg-muted hover:text-ink",
              activeRoute.id === item.id && "bg-muted text-ink"
            )}
          >
            <item.icon size={19} aria-hidden={true} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="mt-auto rounded-lg bg-muted p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
          <ShieldCheck size={18} aria-hidden="true" />
          Data lokal
        </div>
        <p className="text-xs leading-5 text-secondary">Semua data finansial disimpan di IndexedDB lokal pada perangkat ini.</p>
        <Button variant="secondary" className="mt-4 w-full" icon={<Download size={17} aria-hidden="true" />} onClick={() => navigate("/settings")}>
          Backup data
        </Button>
      </div>
    </aside>
  );
}

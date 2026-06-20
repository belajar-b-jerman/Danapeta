import { Moon, Sun } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { Button } from "../ui/Button";

export function PageHeader({ title }: { title: string }) {
  const activePeriod = useAppStore((state) => state.activePeriod);
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);

  return (
    <header className="sticky top-0 z-20 border-b border-ink/5 bg-canvas/90 px-4 py-3 backdrop-blur sm:px-6 md:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-secondary">{activePeriod}</p>
          <h1 className="text-xl font-bold text-ink md:text-2xl">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            className="h-11 w-11 p-0"
            aria-label="Ganti tema"
            onClick={() => setTheme(theme === "light" ? "warm" : "light")}
          >
            {theme === "light" ? <Moon size={19} aria-hidden="true" /> : <Sun size={19} aria-hidden="true" />}
          </Button>
        </div>
      </div>
    </header>
  );
}

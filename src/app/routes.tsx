import { BarChart3, Home, Landmark, PiggyBank, ReceiptText, Settings, Target } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { BudgetsPage } from "../features/budgets/BudgetsPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { GoalsPage } from "../features/goals/GoalsPage";
import { InsightsPage } from "../features/insights/InsightsPage";
import { NetWorthPage } from "../features/networth/NetWorthPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { TransactionExplorerPage } from "../features/transactions/TransactionExplorerPage";
import { TransactionsPage } from "../features/transactions/TransactionsPage";

export type AppRouteId = "dashboard" | "transactions" | "transactionExplorer" | "budgets" | "goals" | "netWorth" | "insights" | "settings";

export type AppRoute = {
  id: AppRouteId;
  path: string;
  label: string;
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  element: ReactNode;
  showInNav?: boolean;
};

function FoundationPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg bg-surface p-5 shadow-soft">
      <p className="text-sm font-semibold text-sage">Phase 1 foundation</p>
      <h2 className="mt-2 text-xl font-bold text-ink">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">{description}</p>
    </div>
  );
}

export const appRoutes: AppRoute[] = [
  {
    id: "dashboard",
    path: "/",
    label: "Dashboard",
    icon: Home,
    element: <DashboardPage />
  },
  {
    id: "transactions",
    path: "/transactions",
    label: "Transaksi",
    icon: ReceiptText,
    element: <TransactionsPage />
  },
  {
    id: "transactionExplorer",
    path: "/transactions/explorer",
    label: "Explorer",
    icon: ReceiptText,
    element: <TransactionExplorerPage />,
    showInNav: false
  },
  {
    id: "budgets",
    path: "/budgets",
    label: "Budget",
    icon: PiggyBank,
    element: <BudgetsPage />
  },
  {
    id: "goals",
    path: "/goals",
    label: "Goals",
    icon: Target,
    element: <GoalsPage />
  },
  {
    id: "netWorth",
    path: "/networth",
    label: "Net Worth",
    icon: Landmark,
    element: <NetWorthPage />
  },
  {
    id: "insights",
    path: "/insights",
    label: "Insight",
    icon: BarChart3,
    element: <InsightsPage />
  },
  {
    id: "settings",
    path: "/settings",
    label: "Setting",
    icon: Settings,
    element: <SettingsPage />
  }
];

export function resolveRoute(pathname: string) {
  return appRoutes.find((route) => route.path === pathname) ?? appRoutes[0];
}

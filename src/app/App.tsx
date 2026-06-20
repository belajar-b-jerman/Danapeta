import { AppShell } from "../components/layout/AppShell";
import { OnboardingDialog } from "../components/layout/OnboardingDialog";
import { AppProviders } from "./providers";
import { useActiveRoute } from "./router";

export function App() {
  return (
    <AppProviders>
      <RoutedApp />
    </AppProviders>
  );
}

function RoutedApp() {
  const activeRoute = useActiveRoute();
  return (
    <AppShell>
      {activeRoute.element}
      <OnboardingDialog />
    </AppShell>
  );
}

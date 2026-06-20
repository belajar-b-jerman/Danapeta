import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { canUseFeature, featureLabels, getLockedFeatureCopy, requiredTierFor, tierDefinitions, type FeatureKey } from "../../lib/commercialTiers";
import { useAppStore } from "../../stores/appStore";
import { Button } from "../ui/Button";

type FeatureGateProps = {
  feature: FeatureKey;
  children: ReactNode;
  fallback?: ReactNode;
};

export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const tier = useAppStore((state) => state.commercialTier);
  if (canUseFeature(tier, feature)) return <>{children}</>;
  return <>{fallback ?? <LockedFeature feature={feature} />}</>;
}

export function LockedFeature({ feature, compact = false }: { feature: FeatureKey; compact?: boolean }) {
  const requiredTier = requiredTierFor(feature);

  return (
    <div className="rounded-lg bg-muted p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-surface text-ink">
          <Lock size={18} aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-bold text-ink">{featureLabels[feature]}</p>
          <p className="mt-1 text-sm leading-6 text-secondary">{getLockedFeatureCopy(feature)}</p>
          {!compact && (
            <Button variant="secondary" className="mt-3 h-10 px-3">
              Upgrade ke {tierDefinitions[requiredTier].name}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

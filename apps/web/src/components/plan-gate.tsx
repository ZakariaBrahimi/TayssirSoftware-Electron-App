"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useMe } from "@/hooks/use-me";
import { Link } from "@/i18n/navigation";
import type { PlanFeature } from "@/lib/validators/platform";

/** True when the current plan includes the feature (or has no limits). */
export function useHasFeature(feature: PlanFeature) {
  const limits = useMe().data?.entitlement.limits;
  return !limits || limits.features.includes(feature);
}

/** Notice shown on a screen the plan doesn't include (data stays readable). */
export function PlanNotice({ feature }: { feature: PlanFeature }) {
  const t = useTranslations("plan");
  const { isAdmin } = useCurrentUser();
  if (useHasFeature(feature)) return null;
  return (
    <div className="bg-accent mb-4 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm">
      <Lock className="text-primary size-4 shrink-0" />
      <span className="min-w-0 flex-1">{t("notInPlan", { feature: t(`feature_${feature}`) })}</span>
      {isAdmin && (
        <Button asChild size="sm">
          <Link href="/subscription">{t("upgrade")}</Link>
        </Button>
      )}
    </div>
  );
}

export function PlanGate({
  feature,
  children,
}: {
  feature: PlanFeature;
  children: React.ReactNode;
}) {
  return (
    <>
      <PlanNotice feature={feature} />
      {children}
    </>
  );
}

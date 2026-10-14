"use client";

import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type PlatformPlan, usePlans, usePlatformPlanName } from "./api";

/**
 * Plan picker for the console dialogs. Lists the active plans, plus the
 * current value when it is an old or retired code, so nothing is lost.
 */
export function PlanSelect({
  id,
  value,
  onChange,
  allowEmpty,
}: {
  id?: string;
  value: string;
  onChange: (code: string, plan: PlatformPlan | undefined) => void;
  /** Adds a "keep the current plan" choice (value ""). */
  allowEmpty?: string;
}) {
  const t = useTranslations("platform.plans");
  const plans = usePlans().data ?? [];
  const planName = usePlatformPlanName();
  const active = plans.filter((p) => p.active);
  const extra = value && !active.some((p) => p.code === value) ? [value] : [];
  const KEEP = "__keep";
  return (
    <Select
      value={value || (allowEmpty ? KEEP : undefined)}
      onValueChange={(code) => {
        const next = code === KEEP ? "" : code;
        onChange(
          next,
          plans.find((p) => p.code === next),
        );
      }}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={t("choose")} />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty && <SelectItem value={KEEP}>{allowEmpty}</SelectItem>}
        {active.map((p) => (
          <SelectItem key={p.code} value={p.code}>
            {planName(p.code)}
            <span className="text-muted-foreground ms-1 font-mono text-xs">{p.code}</span>
          </SelectItem>
        ))}
        {extra.map((code) => (
          <SelectItem key={code} value={code}>
            {code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

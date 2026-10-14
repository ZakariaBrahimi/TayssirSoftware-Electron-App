"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useErrorMessage } from "@/hooks/use-error-message";
import { SUBSCRIPTION_STATUSES } from "@/lib/validators/platform";
import { type StoreDetail, useStoreMutations } from "./api";
import { FormDialog, whenOpen } from "./form-dialog";
import { toDateInput } from "./shared";

type Store = StoreDetail["store"];
type DialogProps = { store: Store; open: boolean; onOpenChange: (open: boolean) => void };

function SubscriptionDialogBody({ store, open, onOpenChange }: DialogProps) {
  const t = useTranslations("platform.store");
  const ts = useTranslations("platform.status");
  const errorMessage = useErrorMessage();
  const { subscription } = useStoreMutations(store.id);
  const [status, setStatus] = useState<(typeof SUBSCRIPTION_STATUSES)[number]>(
    store.subscriptionStatus,
  );
  const [plan, setPlan] = useState(store.plan);
  const [until, setUntil] = useState(toDateInput(store.currentPeriodEnd));

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("changeSubscription")}
      description={t("changeSubscriptionHint")}
      isPending={subscription.isPending}
      canSubmit={plan.trim().length > 0}
      onSubmit={() =>
        subscription.mutate(
          { status, plan: plan.trim(), currentPeriodEnd: until || null },
          {
            onSuccess: () => {
              toast.success(t("saved"));
              onOpenChange(false);
            },
            onError: (err) => toast.error(errorMessage(err)),
          },
        )
      }
    >
      <div className="grid gap-2">
        <Label>{t("subscriptionStatus")}</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUBSCRIPTION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {ts(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="sub-plan">{t("plan")}</Label>
        <Input
          id="sub-plan"
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          maxLength={40}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="sub-until">{t("paidUntil")}</Label>
        <Input
          id="sub-until"
          type="date"
          value={until}
          onChange={(e) => setUntil(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">{t("paidUntilHint")}</p>
      </div>
    </FormDialog>
  );
}

function ExtendTrialDialogBody({ store, open, onOpenChange }: DialogProps) {
  const t = useTranslations("platform.store");
  const errorMessage = useErrorMessage();
  const { extendTrial } = useStoreMutations(store.id);
  const [days, setDays] = useState("7");
  const n = Number(days);
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("extendTrial")}
      description={t("extendTrialHint")}
      isPending={extendTrial.isPending}
      canSubmit={Number.isInteger(n) && n >= 1 && n <= 365}
      submitLabel={t("extend")}
      onSubmit={() =>
        extendTrial.mutate(n, {
          onSuccess: () => {
            toast.success(t("trialExtended"));
            onOpenChange(false);
          },
          onError: (err) => toast.error(errorMessage(err)),
        })
      }
    >
      <div className="grid gap-2">
        <Label htmlFor="trial-days">{t("days")}</Label>
        <Input
          id="trial-days"
          type="number"
          min={1}
          max={365}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          autoFocus
        />
      </div>
    </FormDialog>
  );
}

function SuspendDialogBody({ store, open, onOpenChange }: DialogProps) {
  const t = useTranslations("platform.store");
  const errorMessage = useErrorMessage();
  const { suspend } = useStoreMutations(store.id);
  const [reason, setReason] = useState("");
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("suspendTitle", { name: store.name })}
      description={t("suspendHint")}
      destructive
      submitLabel={t("suspend")}
      isPending={suspend.isPending}
      onSubmit={() =>
        suspend.mutate(reason.trim(), {
          onSuccess: () => {
            toast.success(t("suspended"));
            onOpenChange(false);
          },
          onError: (err) => toast.error(errorMessage(err)),
        })
      }
    >
      <div className="grid gap-2">
        <Label htmlFor="suspend-reason">{t("reason")}</Label>
        <Textarea
          id="suspend-reason"
          rows={3}
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
    </FormDialog>
  );
}

export function ResetPasswordDialog({
  store,
  user,
  onOpenChange,
}: {
  store: Store;
  user: { id: string; name: string; username: string | null } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("platform.store");
  const errorMessage = useErrorMessage();
  const { resetPassword } = useStoreMutations(store.id);
  const [password, setPassword] = useState("");
  return (
    <FormDialog
      open={Boolean(user)}
      onOpenChange={onOpenChange}
      title={t("resetPasswordTitle", { name: user?.name ?? "" })}
      description={t("resetPasswordHint")}
      submitLabel={t("resetPassword")}
      isPending={resetPassword.isPending}
      canSubmit={password.length >= 6}
      onSubmit={() =>
        resetPassword.mutate(
          { userId: user!.id, password },
          {
            onSuccess: () => {
              toast.success(t("passwordReset"));
              onOpenChange(false);
            },
            onError: (err) => toast.error(errorMessage(err)),
          },
        )
      }
    >
      <div className="grid gap-2">
        <Label htmlFor="new-password">{t("newPassword")}</Label>
        <Input
          id="new-password"
          type="text"
          autoComplete="off"
          minLength={6}
          maxLength={128}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          dir="ltr"
        />
      </div>
    </FormDialog>
  );
}

export const SubscriptionDialog = whenOpen(SubscriptionDialogBody);

export const ExtendTrialDialog = whenOpen(ExtendTrialDialogBody);

export const SuspendDialog = whenOpen(SuspendDialogBody);

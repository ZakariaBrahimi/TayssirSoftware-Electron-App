"use client";

import {
  ArrowLeft,
  Ban,
  CalendarPlus,
  ChevronDown,
  CreditCard,
  KeyRound,
  Pencil,
  PlayCircle,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useLocale, useNow, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import type { StoreStatus } from "@/lib/validators/platform";
import { AuditTable } from "./audit-list";
import {
  type StoreDetail as StoreDetailData,
  useAudit,
  useDeviceMutations,
  usePlatformMoney,
  useStoreDetail,
  useStoreMutations,
} from "./api";
import { RecordPaymentDialog } from "./record-payment-dialog";
import { DeviceStatusBadge, RelativeDate, ShortDate, StoreStatusBadge } from "./shared";
import {
  ExtendTrialDialog,
  ResetPasswordDialog,
  SubscriptionDialog,
  SuspendDialog,
} from "./store-dialogs";

type Dialog = "payment" | "subscription" | "trial" | "suspend" | "reactivate" | null;

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-end font-medium">{children}</span>
    </div>
  );
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground py-3 text-sm">{children}</p>;
}

function UsersTable({
  data,
  onResetPassword,
}: {
  data: StoreDetailData;
  onResetPassword: (u: StoreDetailData["users"][number]) => void;
}) {
  const t = useTranslations("platform.store");
  if (data.users.length === 0) return <Empty>{t("noUsers")}</Empty>;
  return (
    <div className="-mx-6 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="ps-6">{t("user")}</TableHead>
            <TableHead>{t("role")}</TableHead>
            <TableHead>{t("lastLogin")}</TableHead>
            <TableHead className="pe-6" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.users.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="ps-6">
                <div className="font-medium">{u.name}</div>
                <div className="text-muted-foreground text-xs" dir="ltr">
                  @{u.username}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                    {u.role === "admin" ? t("roleAdmin") : t("roleCashier")}
                  </Badge>
                  {u.twoFactorEnabled && <Badge variant="outline">2FA</Badge>}
                  {u.banned && <Badge variant="destructive">{t("banned")}</Badge>}
                </div>
              </TableCell>
              <TableCell>
                <RelativeDate value={u.lastLoginAt} fallback={t("never")} />
              </TableCell>
              <TableCell className="pe-6 text-end">
                <Button variant="ghost" size="sm" onClick={() => onResetPassword(u)}>
                  <KeyRound />
                  {t("resetPassword")}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DevicesTable({ data }: { data: StoreDetailData }) {
  const t = useTranslations("platform.store");
  const td = useTranslations("platform.devices");
  const errorMessage = useErrorMessage();
  const { revoke } = useDeviceMutations();
  const now = useNow({ updateInterval: 60_000 });
  if (data.devices.length === 0) return <Empty>{t("noDevices")}</Empty>;
  const staleBefore = now.getTime() - 3 * 86_400_000;
  return (
    <div className="-mx-6 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="ps-6">{td("device")}</TableHead>
            <TableHead>{td("version")}</TableHead>
            <TableHead>{td("lastSync")}</TableHead>
            <TableHead className="pe-6" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.devices.map((d) => {
            const status = d.revokedAt
              ? "revoked"
              : !d.lastSeenAt || new Date(d.lastSeenAt).getTime() < staleBefore
                ? "stale"
                : "active";
            return (
              <TableRow key={d.id}>
                <TableCell className="ps-6">
                  <div className="font-medium">{d.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {d.deviceCode} · <DeviceStatusBadge status={status} />
                  </div>
                </TableCell>
                <TableCell dir="ltr">{d.appVersion ?? "—"}</TableCell>
                <TableCell>
                  <RelativeDate value={d.lastSeenAt} />
                </TableCell>
                <TableCell className="pe-6 text-end">
                  {!d.revokedAt && (
                    <ConfirmDialog
                      title={td("revokeTitle", { name: d.name })}
                      description={td("revokeHint")}
                      confirmLabel={td("revoke")}
                      onConfirm={() =>
                        revoke.mutate(d.id, {
                          onSuccess: () => toast.success(td("revoked")),
                          onError: (err) => toast.error(errorMessage(err)),
                        })
                      }
                      trigger={
                        <Button variant="ghost" size="sm" className="text-destructive">
                          {td("revoke")}
                        </Button>
                      }
                    />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function PaymentsTable({ data }: { data: StoreDetailData }) {
  const t = useTranslations("platform.payments");
  const tm = useTranslations("platform.methods");
  const money = usePlatformMoney();
  if (data.payments.length === 0) return <Empty>{t("empty")}</Empty>;
  return (
    <div className="-mx-6 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="ps-6">{t("date")}</TableHead>
            <TableHead>{t("amount")}</TableHead>
            <TableHead>{t("method")}</TableHead>
            <TableHead className="pe-6">{t("period")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.payments.map((p) => (
            <TableRow key={p.id} className={p.voidedAt ? "opacity-50" : undefined}>
              <TableCell className="ps-6">
                <ShortDate value={p.createdAt} />
              </TableCell>
              <TableCell className="tabular-nums">
                <span className={p.voidedAt ? "line-through" : undefined}>
                  {money.format(p.amount)}
                </span>
                {p.voidedAt && (
                  <Badge variant="destructive" className="ms-2">
                    {t("voided")}
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                {tm(p.method)}
                {p.reference && (
                  <span className="text-muted-foreground block text-xs">{p.reference}</span>
                )}
              </TableCell>
              <TableCell className="pe-6">
                {p.months > 0 ? (
                  <>
                    {t("monthsCount", { count: p.months })} · <ShortDate value={p.periodEnd} />
                  </>
                ) : (
                  "—"
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function StoreDetail() {
  const t = useTranslations("platform.store");
  const { id } = useParams<{ id: string }>();
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const detail = useStoreDetail(id);
  const { reactivate } = useStoreMutations(id);
  const audit = useAudit({ storeId: id, page: 1, pageSize: 15 });
  const [dialog, setDialog] = useState<Dialog>(null);
  const [resetUser, setResetUser] = useState<StoreDetailData["users"][number] | null>(null);

  if (detail.isPending) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (!detail.data) {
    return <Empty>{errorMessage(detail.error)}</Empty>;
  }

  const data = detail.data;
  const store = data.store;
  const status = store.status as StoreStatus;
  const close = (open: boolean) => !open && setDialog(null);
  const storeMoney = (minor: number) => formatMoney(minor, store.currency, locale);

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ms-2 mb-2">
        <Link href="/platform/stores">
          <ArrowLeft className="rtl:rotate-180" />
          {t("back")}
        </Link>
      </Button>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {store.name}
            <StoreStatusBadge status={status} />
          </span>
        }
        description={
          <span dir="ltr" className="font-mono text-xs">
            {store.id}
          </span>
        }
        actions={
          <>
            <Button onClick={() => setDialog("payment")}>
              <CreditCard />
              {t("recordPayment")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  {t("actions")}
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setDialog("subscription")}>
                  <Pencil />
                  {t("changeSubscription")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDialog("trial")}>
                  <CalendarPlus />
                  {t("extendTrial")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {store.suspendedAt ? (
                  <DropdownMenuItem onSelect={() => setDialog("reactivate")}>
                    <PlayCircle />
                    {t("reactivate")}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem variant="destructive" onSelect={() => setDialog("suspend")}>
                    <Ban />
                    {t("suspend")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {store.suspendedAt && (
        <div className="bg-destructive/10 text-destructive mb-4 rounded-md border border-current/20 px-4 py-3 text-sm">
          {t("suspendedBanner", { date: new Date(store.suspendedAt).toLocaleDateString(locale) })}
          {store.suspendReason && <span className="block opacity-80">{store.suspendReason}</span>}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title={t("subscription")}>
          <Field label={t("plan")}>{store.plan}</Field>
          <Field label={t("subscriptionStatus")}>
            <StoreStatusBadge status={status} />
          </Field>
          {store.subscriptionStatus === "trialing" ? (
            <Field label={t("trialEnds")}>
              <ShortDate value={store.trialEndsAt} />
            </Field>
          ) : (
            <Field label={t("paidUntil")}>
              <ShortDate value={store.currentPeriodEnd} fallback={t("noEndDate")} />
            </Field>
          )}
          <Field label={t("created")}>
            <ShortDate value={store.createdAt} />
          </Field>
          <Field label={t("lastActivity")}>
            <RelativeDate value={store.lastSeenAt} fallback={t("never")} />
          </Field>
        </Section>
        <Section title={t("usage")}>
          <Field label={t("products")}>{data.stats.products}</Field>
          <Field label={t("customers")}>{data.stats.customers}</Field>
          <Field label={t("salesTotal")}>{data.stats.salesTotal}</Field>
          <Field label={t("sales30")}>{data.stats.sales30}</Field>
          <Field label={t("revenue30")}>{storeMoney(data.stats.revenue30)}</Field>
        </Section>
        <Section title={t("contact")}>
          <Field label={t("owner")}>
            {data.users.find((u) => u.role === "admin")?.name ?? "—"}
          </Field>
          <Field label={t("phone")}>
            <span dir="ltr">{store.phone ?? "—"}</span>
          </Field>
          <Field label={t("address")}>{store.address ?? "—"}</Field>
          <Field label={t("currency")}>{store.currency}</Field>
          <p className="text-muted-foreground mt-2 text-xs">{t("privacyNote")}</p>
        </Section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Section title={t("users")}>
          <UsersTable data={data} onResetPassword={setResetUser} />
        </Section>
        <Section title={t("devices")}>
          <DevicesTable data={data} />
        </Section>
        <Section title={t("payments")}>
          <PaymentsTable data={data} />
        </Section>
        <Section title={t("history")}>
          <AuditTable data={audit.data} isLoading={audit.isPending} compact />
        </Section>
      </div>

      <RecordPaymentDialog
        open={dialog === "payment"}
        onOpenChange={close}
        target={{ kind: "store", id: store.id, label: store.name, plan: store.plan }}
      />
      <SubscriptionDialog store={store} open={dialog === "subscription"} onOpenChange={close} />
      <ExtendTrialDialog store={store} open={dialog === "trial"} onOpenChange={close} />
      <SuspendDialog store={store} open={dialog === "suspend"} onOpenChange={close} />
      <ConfirmDialog
        open={dialog === "reactivate"}
        onOpenChange={close}
        destructive={false}
        title={t("reactivateTitle", { name: store.name })}
        description={t("reactivateHint")}
        confirmLabel={t("reactivate")}
        onConfirm={() =>
          reactivate.mutate(undefined, {
            onSuccess: () => toast.success(t("reactivated")),
            onError: (err) => toast.error(errorMessage(err)),
          })
        }
      />
      {resetUser && (
        <ResetPasswordDialog
          store={store}
          user={resetUser}
          onOpenChange={(open) => !open && setResetUser(null)}
        />
      )}
    </>
  );
}

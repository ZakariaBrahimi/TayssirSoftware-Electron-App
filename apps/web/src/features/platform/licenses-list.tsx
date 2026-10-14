"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { Check, Copy, CreditCard, Plus, RotateCcw, Search, ShieldOff, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useErrorMessage } from "@/hooks/use-error-message";
import { LICENSE_FILTERS } from "@/lib/validators/platform";
import {
  type LicenseDetail,
  type LicensePage,
  useLicenseDetail,
  useLicenseMutations,
  useLicenses,
  usePlatformMoney,
} from "./api";
import { FormDialog, whenOpen } from "./form-dialog";
import { RecordPaymentDialog } from "./record-payment-dialog";
import { ALL, LicenseStatusBadge, RelativeDate, ShortDate, toDateInput } from "./shared";

type Row = LicensePage["rows"][number];
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, Row>();
const emptyRows: Row[] = [];

function CreateLicenseDialogBody({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (key: string) => void;
}) {
  const t = useTranslations("platform.licenses");
  const errorMessage = useErrorMessage();
  const { create } = useLicenseMutations();
  const [customer, setCustomer] = useState("");
  const [plan, setPlan] = useState("standard");
  const [devices, setDevices] = useState("1");
  const [lifetime, setLifetime] = useState(false);
  const [days, setDays] = useState("365");
  const valid =
    plan.trim().length > 0 &&
    Number(devices) >= 1 &&
    Number(devices) <= 100 &&
    (lifetime || (Number(days) >= 1 && Number(days) <= 3650));

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("new")}
      description={t("newHint")}
      submitLabel={t("create")}
      isPending={create.isPending}
      canSubmit={valid}
      onSubmit={() =>
        create.mutate(
          {
            customerName: customer.trim() || undefined,
            plan: plan.trim(),
            maxDevices: Number(devices),
            days: lifetime ? null : Number(days),
          },
          {
            onSuccess: (res) => {
              onOpenChange(false);
              onCreated(res.key);
            },
            onError: (err) => toast.error(errorMessage(err)),
          },
        )
      }
    >
      <div className="grid gap-2">
        <Label htmlFor="lic-customer">{t("customer")}</Label>
        <Input
          id="lic-customer"
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          maxLength={120}
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="lic-plan">{t("plan")}</Label>
          <Input
            id="lic-plan"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            maxLength={40}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="lic-devices">{t("maxDevices")}</Label>
          <Input
            id="lic-devices"
            type="number"
            min={1}
            max={100}
            value={devices}
            onChange={(e) => setDevices(e.target.value)}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="lic-lifetime" checked={lifetime} onCheckedChange={setLifetime} />
        <Label htmlFor="lic-lifetime">{t("lifetime")}</Label>
      </div>
      {!lifetime && (
        <div className="grid gap-2">
          <Label htmlFor="lic-days">{t("validityDays")}</Label>
          <Input
            id="lic-days"
            type="number"
            min={1}
            max={3650}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </div>
      )}
    </FormDialog>
  );
}
const CreateLicenseDialog = whenOpen(CreateLicenseDialogBody);

/** Shows a new key once, with a copy button. */
function KeyRevealDialog({
  licenseKey,
  onClose,
}: {
  licenseKey: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("platform.licenses");
  const [copied, setCopied] = useState(false);
  return (
    <Dialog open={Boolean(licenseKey)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t("keyTitle")}</DialogTitle>
          <DialogDescription>{t("keyHint")}</DialogDescription>
        </DialogHeader>
        <div className="bg-muted flex items-center gap-2 rounded-md p-3">
          <code
            dir="ltr"
            className="flex-1 text-center font-mono text-base font-semibold tracking-wider break-all"
          >
            {licenseKey}
          </code>
          <Button
            variant="outline"
            size="icon"
            aria-label={t("copy")}
            onClick={async () => {
              await navigator.clipboard.writeText(licenseKey ?? "").catch(() => {});
              setCopied(true);
              toast.success(t("copied"));
            }}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>{t("keySaved")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditLicenseForm({ license }: { license: LicenseDetail["license"] }) {
  const t = useTranslations("platform.licenses");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const { update } = useLicenseMutations();
  const [customer, setCustomer] = useState(license.customerName ?? "");
  const [plan, setPlan] = useState(license.plan);
  const [devices, setDevices] = useState(String(license.maxDevices));
  const [expires, setExpires] = useState(toDateInput(license.expiresAt));
  const dirty =
    customer !== (license.customerName ?? "") ||
    plan !== license.plan ||
    devices !== String(license.maxDevices) ||
    expires !== toDateInput(license.expiresAt);

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        update.mutate(
          {
            id: license.id,
            json: {
              customerName: customer.trim() || null,
              plan: plan.trim(),
              maxDevices: Number(devices),
              expiresAt: expires || null,
            },
          },
          {
            onSuccess: () => toast.success(t("saved")),
            onError: (err) => toast.error(errorMessage(err)),
          },
        );
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="edit-customer">{t("customer")}</Label>
        <Input id="edit-customer" value={customer} onChange={(e) => setCustomer(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="edit-plan">{t("plan")}</Label>
          <Input id="edit-plan" value={plan} onChange={(e) => setPlan(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-devices">{t("maxDevices")}</Label>
          <Input
            id="edit-devices"
            type="number"
            min={1}
            max={100}
            value={devices}
            onChange={(e) => setDevices(e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="edit-expires">{t("expires")}</Label>
        <Input
          id="edit-expires"
          type="date"
          value={expires}
          onChange={(e) => setExpires(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">{t("expiresHint")}</p>
      </div>
      <Button
        type="submit"
        disabled={!dirty || update.isPending || !plan.trim()}
        className="justify-self-start"
      >
        {tc("save")}
      </Button>
    </form>
  );
}

function LicenseSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useTranslations("platform.licenses");
  const tp = useTranslations("platform.payments");
  const tm = useTranslations("platform.methods");
  const errorMessage = useErrorMessage();
  const money = usePlatformMoney();
  const detail = useLicenseDetail(id);
  const { revoke, restore, reset, removeActivation } = useLicenseMutations();
  const [paying, setPaying] = useState(false);
  const data = detail.data;
  const done = (message: string) => ({
    onSuccess: () => toast.success(message),
    onError: (err: unknown) => toast.error(errorMessage(err)),
  });

  return (
    <Sheet open={Boolean(id)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="end" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {data?.license.customerName ?? t("license")}
            {data && <LicenseStatusBadge status={data.license.status} />}
          </SheetTitle>
          <SheetDescription dir="ltr" className="font-mono">
            {data ? `····-····-····-····-${data.license.keyHint}` : ""}
          </SheetDescription>
        </SheetHeader>
        {!data ? (
          <div className="grid gap-3 p-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="grid gap-6 px-4 pb-6">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setPaying(true)}>
                <CreditCard />
                {tp("record")}
              </Button>
              <ConfirmDialog
                title={t("resetTitle")}
                description={t("resetHint")}
                confirmLabel={t("reset")}
                onConfirm={() => reset.mutate(data.license.id, done(t("resetDone")))}
                trigger={
                  <Button size="sm" variant="outline" disabled={!data.activations.length}>
                    <RotateCcw />
                    {t("reset")}
                  </Button>
                }
              />
              {data.license.revokedAt ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => restore.mutate(data.license.id, done(t("restored")))}
                >
                  {t("restore")}
                </Button>
              ) : (
                <ConfirmDialog
                  title={t("revokeTitle")}
                  description={t("revokeHint")}
                  confirmLabel={t("revoke")}
                  onConfirm={() => revoke.mutate(data.license.id, done(t("revokedDone")))}
                  trigger={
                    <Button size="sm" variant="outline" className="text-destructive">
                      <ShieldOff />
                      {t("revoke")}
                    </Button>
                  }
                />
              )}
            </div>

            <section className="grid gap-2">
              <h3 className="text-sm font-semibold">
                {t("activations", { used: data.activations.length, max: data.license.maxDevices })}
              </h3>
              {data.activations.length === 0 && (
                <p className="text-muted-foreground text-sm">{t("noActivations")}</p>
              )}
              {data.activations.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{a.deviceName ?? "—"}</div>
                    <div className="text-muted-foreground text-xs" dir="ltr">
                      {a.deviceId}… · v{a.appVersion ?? "?"}
                    </div>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    <RelativeDate value={a.lastSeenAt} />
                  </div>
                  <ConfirmDialog
                    title={t("removeDeviceTitle", { name: a.deviceName ?? "" })}
                    description={t("removeDeviceHint")}
                    confirmLabel={t("removeDevice")}
                    onConfirm={() =>
                      removeActivation.mutate(
                        { id: data.license.id, activationId: a.id },
                        done(t("deviceRemoved")),
                      )
                    }
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label={t("removeDevice")}>
                        <Trash2 />
                      </Button>
                    }
                  />
                </div>
              ))}
            </section>

            <Separator />
            <section className="grid gap-2">
              <h3 className="text-sm font-semibold">{t("details")}</h3>
              <EditLicenseForm
                key={`${data.license.id}-${String(data.license.expiresAt)}-${data.license.plan}`}
                license={data.license}
              />
              <p className="text-muted-foreground text-xs">
                {t("createdOn")} <ShortDate value={data.license.createdAt} />
              </p>
            </section>

            <Separator />
            <section className="grid gap-2">
              <h3 className="text-sm font-semibold">{tp("title")}</h3>
              {data.payments.length === 0 && (
                <p className="text-muted-foreground text-sm">{tp("empty")}</p>
              )}
              {data.payments.map((p) => (
                <div key={p.id} className="flex items-center gap-3 text-sm">
                  <ShortDate value={p.createdAt} />
                  <span className="text-muted-foreground flex-1 text-xs">{tm(p.method)}</span>
                  {p.voidedAt && <Badge variant="destructive">{tp("voided")}</Badge>}
                  <span className="font-medium tabular-nums">{money.format(p.amount)}</span>
                </div>
              ))}
            </section>
          </div>
        )}
        {data && (
          <RecordPaymentDialog
            open={paying}
            onOpenChange={setPaying}
            target={{
              kind: "license",
              id: data.license.id,
              label: data.license.customerName ?? `…${data.license.keyHint}`,
              plan: data.license.plan,
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

export function LicensesList() {
  const t = useTranslations("platform.licenses");
  const tl = useTranslations("platform.licenseStatus");
  const params = useSearchParams();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(params.get("id"));
  const q = useDebouncedValue(search.trim(), 250);
  const query = useLicenses({
    q: q || undefined,
    status: status === ALL ? undefined : (status as (typeof LICENSE_FILTERS)[number]),
    page,
    pageSize: 25,
  });

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("customerName", {
          header: t("customer"),
          cell: ({ row }) => (
            <div>
              <div className="font-medium">{row.original.customerName ?? "—"}</div>
              <div className="text-muted-foreground font-mono text-xs" dir="ltr">
                …{row.original.keyHint}
              </div>
            </div>
          ),
        }),
        helper.accessor("status", {
          header: t("status"),
          cell: ({ getValue }) => <LicenseStatusBadge status={getValue()} />,
        }),
        helper.accessor("plan", { header: t("plan") }),
        helper.accessor("devicesUsed", {
          header: t("devices"),
          cell: ({ row }) => (
            <span className="tabular-nums">
              {row.original.devicesUsed} / {row.original.maxDevices}
            </span>
          ),
        }),
        helper.accessor("expiresAt", {
          header: t("expires"),
          cell: ({ getValue }) => <ShortDate value={getValue()} fallback={t("lifetime")} />,
        }),
        helper.accessor("lastSeenAt", {
          header: t("lastCheckIn"),
          cell: ({ getValue }) => <RelativeDate value={getValue()} />,
        }),
      ]),
    [t],
  );
  const table = useTable({
    features,
    columns,
    data: query.data?.rows ?? emptyRows,
    getRowId: (r) => r.id,
  });

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus />
            {t("new")}
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t("searchPlaceholder")}
            className="ps-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40" aria-label={t("status")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allStatuses")}</SelectItem>
            {LICENSE_FILTERS.map((s) => (
              <SelectItem key={s} value={s}>
                {tl(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DataTable
        table={table}
        isLoading={query.isPending}
        emptyMessage={t("empty")}
        onRowClick={(row) => setSelected(row.id)}
      />
      {query.data && (
        <Pagination
          page={query.data.page}
          pageCount={query.data.pageCount}
          total={query.data.total}
          onPageChange={setPage}
        />
      )}
      <CreateLicenseDialog open={creating} onOpenChange={setCreating} onCreated={setNewKey} />
      <KeyRevealDialog licenseKey={newKey} onClose={() => setNewKey(null)} />
      <LicenseSheet id={selected} onClose={() => setSelected(null)} />
    </>
  );
}

"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { Check, Copy, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Link } from "@/i18n/navigation";
import { REQUEST_STATUSES, type RequestStatus } from "@/lib/validators/platform";
import {
  type RequestPage,
  usePlatformMoney,
  usePlatformPlanName,
  useRequestDetail,
  useRequestMutations,
  useRequests,
} from "./api";
import { FormDialog, whenOpen } from "./form-dialog";
import { ALL, RelativeDate, ShortDate } from "./shared";

type Row = RequestPage["rows"][number];
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, Row>();
const emptyRows: Row[] = [];

const statusVariant = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  canceled: "outline",
} as const;

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const t = useTranslations("platform.requests");
  return <Badge variant={statusVariant[status]}>{t(`s_${status}`)}</Badge>;
}

/** Who asked: a store, a licensed PC, or a PC buying its first license. */
function Requester({
  r,
}: {
  r: Pick<
    Row,
    | "storeId"
    | "storeName"
    | "licenseId"
    | "licenseHint"
    | "licenseCustomer"
    | "shopName"
    | "contactName"
  >;
}) {
  const t = useTranslations("platform.requests");
  if (r.storeId) {
    return (
      <Link href={`/platform/stores/${r.storeId}`} className="font-medium hover:underline">
        {r.storeName ?? "—"}
      </Link>
    );
  }
  if (r.licenseId) {
    return (
      <Link href={`/platform/licenses?id=${r.licenseId}`} className="hover:underline">
        <span className="font-medium">{r.licenseCustomer || r.shopName || t("license")}</span>{" "}
        <span className="text-muted-foreground font-mono text-xs" dir="ltr">
          …{r.licenseHint}
        </span>
      </Link>
    );
  }
  return (
    <span>
      <span className="font-medium">{r.shopName || r.contactName || t("newPc")}</span>{" "}
      <Badge variant="secondary">{t("newPc")}</Badge>
    </span>
  );
}

function RejectDialogBody({
  id,
  open,
  onOpenChange,
  onDone,
}: {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const t = useTranslations("platform.requests");
  const errorMessage = useErrorMessage();
  const { reject } = useRequestMutations();
  const [reason, setReason] = useState("");
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("rejectTitle")}
      description={t("rejectHint")}
      destructive
      submitLabel={t("reject")}
      canSubmit={reason.trim().length > 0}
      isPending={reject.isPending}
      onSubmit={() =>
        reject.mutate(
          { id, reason: reason.trim() },
          {
            onSuccess: () => {
              toast.success(t("rejected"));
              onOpenChange(false);
              onDone();
            },
            onError: (err) => toast.error(errorMessage(err)),
          },
        )
      }
    >
      <div className="grid gap-2">
        <Label htmlFor="reject-reason">{t("reason")}</Label>
        <Input
          id="reject-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={300}
          placeholder={t("reasonPlaceholder")}
          autoFocus
        />
      </div>
    </FormDialog>
  );
}
const RejectDialog = whenOpen(RejectDialogBody);

function KeyDialog({ licenseKey, onClose }: { licenseKey: string; onClose: () => void }) {
  const t = useTranslations("platform.requests");
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("keyTitle")}</DialogTitle>
          <DialogDescription>{t("keyHint")}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-md border px-3 py-2">
          <code dir="ltr" className="min-w-0 flex-1 truncate font-mono text-sm select-all">
            {licenseKey}
          </code>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("copy")}
            onClick={() =>
              navigator.clipboard.writeText(licenseKey).then(() => toast.success(t("copied")))
            }
          >
            <Copy />
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>{t("done")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useTranslations("platform.requests");
  const tm = useTranslations("platform.methods");
  const tsub = useTranslations("subscription");
  const money = usePlatformMoney();
  const planName = usePlatformPlanName();
  const errorMessage = useErrorMessage();
  const { data } = useRequestDetail(id);
  const { approve } = useRequestMutations();
  const [rejecting, setRejecting] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const doApprove = () =>
    approve.mutate(id, {
      onSuccess: (res) => {
        toast.success(t("approved"));
        if (res.licenseKey) setNewKey(res.licenseKey);
        else onClose();
      },
      onError: (err) => toast.error(errorMessage(err)),
    });

  const row = (label: string, value: React.ReactNode) =>
    value ? (
      <>
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="min-w-0 break-words">{value}</dd>
      </>
    ) : null;

  return (
    <>
      <Sheet open onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t("detailTitle")}</SheetTitle>
            <SheetDescription>{data && <RelativeDate value={data.createdAt} />}</SheetDescription>
          </SheetHeader>
          {!data ? (
            <Skeleton className="mx-4 h-60" />
          ) : (
            <div className="grid gap-5 px-4 pb-6">
              <div className="flex items-center justify-between gap-3">
                <span className="font-display text-2xl font-semibold tabular-nums">
                  {money.format(data.amount)}
                </span>
                <RequestStatusBadge status={data.status as RequestStatus} />
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                {row(
                  t("for"),
                  data.store
                    ? data.store.name
                    : data.license
                      ? `${data.license.customer || "—"} · …${data.license.hint}`
                      : t("newPc"),
                )}
                {row(
                  t("currentPlan"),
                  data.store
                    ? planName(data.store.plan)
                    : data.license
                      ? planName(data.license.plan)
                      : null,
                )}
                {row(
                  t("plan"),
                  `${planName(data.planCode)} · ${tsub(`period_${data.period}` as "period_month")}`,
                )}
                {row(t("method"), tm(data.method as "ccp"))}
                {row(t("reference"), data.reference && <span dir="ltr">{data.reference}</span>)}
                {row(t("shop"), data.shopName)}
                {row(
                  t("contact"),
                  [data.contactName, data.contactPhone].filter(Boolean).join(" · "),
                )}
                {row(t("note"), data.note)}
                {row(
                  t("decidedBy"),
                  data.decidedByName && (
                    <span>
                      {data.decidedByName} · <ShortDate value={data.decidedAt} />
                    </span>
                  ),
                )}
                {row(t("reason"), data.rejectReason)}
              </dl>
              {data.receipt ? (
                <a href={data.receipt} target="_blank" rel="noopener" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={data.receipt} alt={t("receipt")} className="w-full rounded-md border" />
                </a>
              ) : (
                <p className="text-muted-foreground text-sm">{t("noReceipt")}</p>
              )}
              {data.status === "pending" && (
                <>
                  <p className="text-muted-foreground text-xs">{t("approveHint")}</p>
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={doApprove} disabled={approve.isPending}>
                      {approve.isPending ? <Loader2 className="animate-spin" /> : <Check />}
                      {t("approve")}
                    </Button>
                    <Button
                      variant="outline"
                      className="text-destructive flex-1"
                      onClick={() => setRejecting(true)}
                    >
                      <X />
                      {t("reject")}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
      <RejectDialog id={id} open={rejecting} onOpenChange={setRejecting} onDone={onClose} />
      {newKey && (
        <KeyDialog
          licenseKey={newKey}
          onClose={() => {
            setNewKey(null);
            onClose();
          }}
        />
      )}
    </>
  );
}

export function RequestsList() {
  const t = useTranslations("platform.requests");
  const tm = useTranslations("platform.methods");
  const tsub = useTranslations("subscription");
  const money = usePlatformMoney();
  const planName = usePlatformPlanName();
  const [status, setStatus] = useState<string>("pending");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const query = useRequests({
    status: status === ALL ? undefined : (status as RequestStatus),
    page,
    pageSize: 25,
  });

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("createdAt", {
          header: t("date"),
          cell: ({ getValue }) => <RelativeDate value={getValue()} />,
        }),
        helper.display({
          id: "for",
          header: t("for"),
          cell: ({ row }) => <Requester r={row.original} />,
        }),
        helper.accessor("planCode", {
          header: t("plan"),
          cell: ({ row }) => (
            <span>
              {planName(row.original.planCode)}
              <span className="text-muted-foreground block text-xs">
                {tsub(`period_${row.original.period}` as "period_month")}
              </span>
            </span>
          ),
        }),
        helper.accessor("amount", {
          header: t("amount"),
          cell: ({ getValue }) => (
            <span className="font-medium tabular-nums">{money.format(getValue())}</span>
          ),
        }),
        helper.accessor("method", {
          header: t("method"),
          cell: ({ row }) => (
            <div>
              {tm(row.original.method as "ccp")}
              {row.original.reference && (
                <div className="text-muted-foreground text-xs" dir="ltr">
                  {row.original.reference}
                </div>
              )}
            </div>
          ),
        }),
        helper.accessor("status", {
          header: t("status"),
          cell: ({ getValue }) => <RequestStatusBadge status={getValue() as RequestStatus} />,
        }),
        helper.display({
          id: "actions",
          header: "",
          cell: ({ row }) => (
            <div className="text-end">
              <Button variant="ghost" size="sm" onClick={() => setOpenId(row.original.id)}>
                {row.original.status === "pending" ? t("review") : t("open")}
              </Button>
            </div>
          ),
        }),
      ]),
    [t, tm, tsub, money, planName],
  );
  const table = useTable({
    features,
    columns,
    data: query.data?.rows ?? emptyRows,
    getRowId: (r) => r.id,
  });

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44" aria-label={t("status")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allStatuses")}</SelectItem>
            {REQUEST_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`s_${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DataTable table={table} isLoading={query.isPending} emptyMessage={t("empty")} />
      {query.data && (
        <Pagination
          page={query.data.page}
          pageCount={query.data.pageCount}
          total={query.data.total}
          onPageChange={setPage}
        />
      )}
      {openId && <RequestSheet id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

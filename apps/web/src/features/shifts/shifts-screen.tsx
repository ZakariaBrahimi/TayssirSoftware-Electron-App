"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { ArrowDownToLine, ArrowUpFromLine, Loader2, Lock, Printer, Unlock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useErrorMessage } from "@/hooks/use-error-message";
import { usePrint } from "@/hooks/use-print";
import { useDateFormat, useMoney } from "@/hooks/use-settings";
import { type ShiftPage, useCurrentShift, useShift, useShiftMutations, useShifts } from "./api";
import { ShiftFigures, ZReport } from "./shift-summary";

/** Small form with an amount (and optional text) inside a dialog. */
function AmountDialog({
  open,
  onOpenChange,
  title,
  description,
  amountLabel,
  textLabel,
  textRequired,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  amountLabel: string;
  textLabel?: string;
  textRequired?: boolean;
  isPending: boolean;
  onSubmit: (amount: number, text: string) => void;
}) {
  const tc = useTranslations("common");
  const money = useMoney();
  const [amount, setAmount] = useState("");
  const [text, setText] = useState("");
  const valid = amount !== "" && Number(amount) >= 0 && (!textRequired || text.trim() !== "");
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setAmount("");
          setText("");
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) onSubmit(money.toMinor(Number(amount)), text.trim());
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="amount">
              {amountLabel} ({money.currency})
            </Label>
            <Input
              id="amount"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-11 text-lg tabular-nums"
            />
          </div>
          {textLabel && (
            <div className="grid gap-2">
              <Label htmlFor="text">{textLabel}</Label>
              <Textarea
                id="text"
                rows={2}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={200}
              />
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={!valid || isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              {tc("confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Row = ShiftPage["rows"][number];
const features = tableFeatures({});
const helper = createColumnHelper<typeof features, Row>();
const emptyRows: Row[] = [];

function ShiftSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useTranslations("shifts");
  const dates = useDateFormat();
  const { data } = useShift(id);
  const { print, printArea } = usePrint();
  return (
    <>
      <Sheet open={id !== null} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="end" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{t("zReport")}</SheetTitle>
            {data && (
              <p className="text-muted-foreground text-sm">
                {t("openedBy", {
                  name: data.shift.openedByName ?? "",
                  date: dates.dateTime(data.shift.createdAt),
                })}
              </p>
            )}
          </SheetHeader>
          <div className="grid gap-4 px-4 pb-4">
            {data ? <ShiftFigures summary={data} /> : <Skeleton className="h-40" />}
            {data && (
              <Button variant="outline" onClick={() => print(<ZReport summary={data} />)}>
                <Printer />
                {t("printReport")}
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
      {printArea}
    </>
  );
}

export function ShiftsScreen() {
  const t = useTranslations("shifts");
  const tc = useTranslations("common");
  const money = useMoney();
  const dates = useDateFormat();
  const errorMessage = useErrorMessage();
  const current = useCurrentShift();
  const { open, close, move } = useShiftMutations();
  const { print, printArea } = usePrint();
  const [dialog, setDialog] = useState<"open" | "close" | "in" | "out" | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const history = useShifts(page);
  const onError = (err: unknown) => toast.error(errorMessage(err));

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("createdAt", {
          header: tc("date"),
          cell: ({ getValue }) => dates.dateTime(getValue()),
        }),
        helper.accessor("openedByName", {
          header: tc("user"),
          cell: ({ getValue }) => getValue() ?? "—",
        }),
        helper.accessor("status", {
          header: tc("status"),
          cell: ({ getValue }) => (
            <Badge variant={getValue() === "open" ? "success" : "secondary"}>
              {t(`status_${getValue()}`)}
            </Badge>
          ),
        }),
        helper.accessor("expectedCash", {
          header: t("expectedCash"),
          cell: ({ getValue }) => (
            <span className="tabular-nums">
              {getValue() === null ? "—" : money.format(getValue()!)}
            </span>
          ),
        }),
        helper.display({
          id: "difference",
          header: t("difference"),
          cell: ({ row }) => {
            const { countedCash, expectedCash } = row.original;
            if (countedCash === null || expectedCash === null) return "—";
            const d = countedCash - expectedCash;
            return (
              <span className={d < 0 ? "text-destructive tabular-nums" : "tabular-nums"}>
                {money.format(d)}
              </span>
            );
          },
        }),
      ]),
    [t, tc, money, dates],
  );
  const table = useTable({
    features,
    columns,
    data: history.data?.rows ?? emptyRows,
    getRowId: (r) => r.id,
  });
  const summary = current.data;

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />

      {current.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : !summary ? (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>{t("noShift")}</CardTitle>
            <CardDescription>{t("noShiftDescription")}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => setDialog("open")}>
              <Unlock />
              {t("openShift")}
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {t("current")}
              <Badge variant="success">{t("status_open")}</Badge>
            </CardTitle>
            <CardDescription>
              {t("openedBy", {
                name: summary.shift.openedByName ?? "",
                date: dates.dateTime(summary.shift.createdAt),
              })}
              {" · "}
              {t("salesCount", { count: summary.salesCount })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ShiftFigures summary={summary} />
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setDialog("in")}>
              <ArrowDownToLine />
              {t("payIn")}
            </Button>
            <Button variant="outline" onClick={() => setDialog("out")}>
              <ArrowUpFromLine />
              {t("payOut")}
            </Button>
            <Button variant="outline" onClick={() => print(<ZReport summary={summary} />)}>
              <Printer />
              {t("printReport")}
            </Button>
            <Button className="ms-auto" onClick={() => setDialog("close")}>
              <Lock />
              {t("closeShift")}
            </Button>
          </CardFooter>
        </Card>
      )}

      <h2 className="mt-8 mb-3 text-lg font-semibold">{t("history")}</h2>
      <DataTable
        table={table}
        isLoading={history.isPending}
        emptyMessage={t("empty")}
        onRowClick={(r) => setSelected(r.id)}
      />
      {history.data && (
        <Pagination
          page={history.data.page}
          pageCount={history.data.pageCount}
          total={history.data.total}
          onPageChange={setPage}
        />
      )}

      <AmountDialog
        open={dialog === "open"}
        onOpenChange={(o) => setDialog(o ? "open" : null)}
        title={t("openShift")}
        description={t("noShiftDescription")}
        amountLabel={t("openingCash")}
        isPending={open.isPending}
        onSubmit={(amount) =>
          open.mutate(amount, {
            onSuccess: () => {
              toast.success(t("opened"));
              setDialog(null);
            },
            onError,
          })
        }
      />
      <AmountDialog
        open={dialog === "close"}
        onOpenChange={(o) => setDialog(o ? "close" : null)}
        title={t("closeShift")}
        description={t("closeDescription")}
        amountLabel={t("countedCash")}
        textLabel={t("reason")}
        isPending={close.isPending}
        onSubmit={(countedCash, note) =>
          close.mutate(
            { countedCash, note: note || undefined },
            {
              onSuccess: (closed) => {
                toast.success(t("closed"));
                setDialog(null);
                print(<ZReport summary={closed} />);
              },
              onError,
            },
          )
        }
      />
      {(["in", "out"] as const).map((type) => (
        <AmountDialog
          key={type}
          open={dialog === type}
          onOpenChange={(o) => setDialog(o ? type : null)}
          title={type === "in" ? t("payIn") : t("payOut")}
          description={type === "in" ? t("payInHint") : t("payOutHint")}
          amountLabel={tc("amount")}
          textLabel={t("reason")}
          textRequired
          isPending={move.isPending}
          onSubmit={(amount, reason) =>
            amount > 0 &&
            move.mutate(
              { type, amount, reason },
              {
                onSuccess: () => {
                  toast.success(t("movementRecorded"));
                  setDialog(null);
                },
                onError,
              },
            )
          }
        />
      ))}
      <ShiftSheet id={selected} onClose={() => setSelected(null)} />
      {printArea}
    </>
  );
}

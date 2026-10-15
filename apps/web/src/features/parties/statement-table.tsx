"use client";

import { useTranslations } from "next-intl";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDateFormat, useMoney } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

export type StatementEntry = {
  id: string;
  date: string;
  label: string;
  note?: string | null;
  /** Increases (+) or decreases (−) the balance. */
  amount: number;
  balance: number;
  muted?: boolean;
};

/** Account statement: newest first, with the running balance. */
export function StatementTable({
  entries,
  className,
}: {
  entries: StatementEntry[];
  className?: string;
}) {
  const t = useTranslations("common");
  const tc = useTranslations("customers");
  const money = useMoney();
  const dates = useDateFormat();
  if (entries.length === 0) {
    return <p className="text-muted-foreground py-6 text-center text-sm">{t("noResults")}</p>;
  }
  return (
    <Table className={className}>
      <TableHeader>
        <TableRow>
          <TableHead>{t("date")}</TableHead>
          <TableHead>{t("details")}</TableHead>
          <TableHead className="text-end">{tc("debit")}</TableHead>
          <TableHead className="text-end">{tc("creditCol")}</TableHead>
          <TableHead className="text-end">{t("balance")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((e) => (
          <TableRow key={e.id} className={cn(e.muted && "text-muted-foreground line-through")}>
            <TableCell>{dates.dateTime(e.date)}</TableCell>
            <TableCell className="whitespace-normal">
              {e.label}
              {e.note && <span className="text-muted-foreground block text-xs">{e.note}</span>}
            </TableCell>
            <TableCell className="text-end tabular-nums">
              {e.amount > 0 ? money.format(e.amount) : ""}
            </TableCell>
            <TableCell className="text-end tabular-nums">
              {e.amount < 0 ? money.format(-e.amount) : ""}
            </TableCell>
            <TableCell className="text-end font-medium tabular-nums">
              {money.format(e.balance)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

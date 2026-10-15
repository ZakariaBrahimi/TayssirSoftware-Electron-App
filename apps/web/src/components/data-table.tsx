"use client";

import type { ReactTable, RowData, TableFeatures } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** Renders a TanStack Table instance with shadcn table styles. */
export function DataTable<TFeatures extends TableFeatures, TData extends RowData>({
  table,
  isLoading,
  emptyMessage,
  onRowClick,
  className,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: ReactTable<TFeatures, TData, any>;
  isLoading?: boolean;
  emptyMessage?: React.ReactNode;
  onRowClick?: (row: TData) => void;
  className?: string;
}) {
  const t = useTranslations("common");
  const headerGroups = table.getHeaderGroups();
  const rows = table.getRowModel().rows;
  const columnCount = headerGroups[0]?.headers.length ?? 1;

  return (
    <div className={cn("bg-card overflow-hidden rounded-lg border", className)}>
      <Table>
        <TableHeader className="bg-muted/50">
          {headerGroups.map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map((header) => (
                <TableHead key={header.id} className="text-muted-foreground">
                  {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading && rows.length === 0 ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: columnCount }).map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-5 w-full max-w-32" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={columnCount}
                className="text-muted-foreground h-32 text-center whitespace-normal"
              >
                {emptyMessage ?? t("noResults")}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                className={cn(onRowClick && "cursor-pointer")}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              >
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

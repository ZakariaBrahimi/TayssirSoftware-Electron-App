import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  isLoading,
}: {
  title: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  isLoading?: boolean;
}) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="flex flex-row items-center justify-between gap-2 px-4">
        <CardTitle className="text-muted-foreground text-sm font-medium">{title}</CardTitle>
        {Icon && <Icon className="text-muted-foreground size-4" />}
      </CardHeader>
      <CardContent className="px-4">
        {isLoading ? (
          <Skeleton className="h-8 w-28" />
        ) : (
          <div className="text-2xl font-semibold tabular-nums">{value}</div>
        )}
        {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
      </CardContent>
    </Card>
  );
}

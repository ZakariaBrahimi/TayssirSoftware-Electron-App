"use client";

import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  destructive = true,
  onConfirm,
  open,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: React.ReactNode;
  destructive?: boolean;
  onConfirm: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations("common");
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title ?? t("areYouSure")}</AlertDialogTitle>
          <AlertDialogDescription>{description ?? t("cannotUndo")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className={destructive ? buttonVariants({ variant: "destructive" }) : undefined}
            onClick={onConfirm}
          >
            {confirmLabel ?? t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

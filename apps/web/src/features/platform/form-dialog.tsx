"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Small dialog with a form. The body is only mounted while open, so its
 * state starts fresh every time.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  destructive,
  isPending,
  canSubmit = true,
  onSubmit,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  submitLabel?: React.ReactNode;
  destructive?: boolean;
  isPending?: boolean;
  canSubmit?: boolean;
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  const t = useTranslations("common");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit && !isPending) onSubmit();
            }}
          >
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              {description && <DialogDescription>{description}</DialogDescription>}
            </DialogHeader>
            {children}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                variant={destructive ? "destructive" : "default"}
                disabled={!canSubmit || isPending}
              >
                {isPending && <Loader2 className="animate-spin" />}
                {submitLabel ?? t("save")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Mounts a dialog component only while it is open, so the form state it
 * keeps (useState in the component itself) resets on every opening.
 */
export function whenOpen<P extends { open: boolean }>(Component: React.ComponentType<P>) {
  function WhenOpen(props: P) {
    return props.open ? <Component {...props} /> : null;
  }
  WhenOpen.displayName = `WhenOpen(${Component.displayName ?? Component.name})`;
  return WhenOpen;
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useErrorMessage } from "@/hooks/use-error-message";
import { usernameSchema } from "@/lib/validators";
import { type StoreUser, useUserMutations, useUsers } from "./api";

type Role = "admin" | "user";

const schema = (editing: boolean) =>
  z.object({
    name: z.string().trim().min(1, "required"),
    username: editing ? z.string() : usernameSchema.min(3, "username_too_short"),
    password: editing
      ? z.string().refine((v) => v === "" || v.length >= 6, "password_too_short")
      : z.string().min(6, "password_too_short"),
    role: z.enum(["admin", "user"]),
  });
type Values = z.infer<ReturnType<typeof schema>>;

function UserDialog({
  user,
  open,
  onOpenChange,
}: {
  user: StoreUser | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations("settings");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{user ? t("editUser") : t("newUser")}</DialogTitle>
        </DialogHeader>
        {open && <UserForm user={user} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function UserForm({ user, onDone }: { user: StoreUser | null; onDone: () => void }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const { user: me } = useCurrentUser();
  const { create, update } = useUserMutations();
  const editing = user !== null;
  const form = useForm<Values>({
    resolver: zodResolver(schema(editing)),
    defaultValues: {
      name: user?.name ?? "",
      username: user?.displayUsername ?? user?.username ?? "",
      password: "",
      role: (user?.role as Role) ?? "user",
    },
  });
  const pending = create.isPending || update.isPending;
  const onError = (err: unknown) => toast.error(errorMessage(err));

  const submit = form.handleSubmit((v) => {
    if (user) {
      update.mutate(
        {
          id: user.id,
          json: { name: v.name, role: v.role, ...(v.password ? { password: v.password } : {}) },
        },
        {
          onSuccess: () => {
            toast.success(t("userUpdated"));
            onDone();
          },
          onError,
        },
      );
    } else {
      create.mutate(
        { name: v.name, username: v.username, password: v.password, role: v.role },
        {
          onSuccess: () => {
            toast.success(t("userCreated"));
            onDone();
          },
          onError,
        },
      );
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={submit} className="grid gap-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("fullName")}</FormLabel>
              <FormControl>
                <Input autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("username")}</FormLabel>
              <FormControl>
                <Input autoComplete="off" disabled={editing} dir="ltr" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("password")}</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              {editing && <FormDescription>{t("passwordKeep")}</FormDescription>}
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("role")}</FormLabel>
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={user?.id === me?.id}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="user">{t("cashier")}</SelectItem>
                  <SelectItem value="admin">{t("admin")}</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            {tc("cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {tc("save")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export function UsersManager() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const { user: me } = useCurrentUser();
  const users = useUsers();
  const { remove } = useUserMutations();
  const [dialog, setDialog] = useState<{ user: StoreUser | null } | null>(null);
  const [deleting, setDeleting] = useState<StoreUser | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("users")}</CardTitle>
        <CardDescription>{t("usersDescription")}</CardDescription>
        <CardAction>
          <Button onClick={() => setDialog({ user: null })}>
            <Plus />
            {t("newUser")}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {users.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <ul className="max-w-3xl divide-y rounded-lg border">
            {users.data?.map((u) => {
              const isMe = u.id === me?.id;
              return (
                <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2 font-medium">
                      {u.name}
                      {isMe && <Badge variant="outline">{t("you")}</Badge>}
                    </span>
                    <span className="text-muted-foreground text-xs" dir="ltr">
                      @{u.displayUsername ?? u.username}
                    </span>
                  </div>
                  <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                    {u.role === "admin" ? t("admin") : t("cashier")}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={tc("actions")}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setDialog({ user: u })}>
                        <Pencil />
                        {tc("edit")}
                      </DropdownMenuItem>
                      {!isMe && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(u)}>
                            <Trash2 />
                            {t("deleteUser")}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      <UserDialog
        user={dialog?.user ?? null}
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        description={deleting ? t("deleteUserConfirm", { name: deleting.name }) : undefined}
        confirmLabel={tc("delete")}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => toast.success(tc("deleted")),
            onError: (err) => toast.error(errorMessage(err)),
          })
        }
      />
    </Card>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, MoreHorizontal, Plus, Trash2 } from "lucide-react";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/hooks/use-current-user";
import { authClient } from "@/lib/auth-client";
import { usernameSchema } from "@/lib/validators";

type Role = "admin" | "user";

const usersKey = ["users"] as const;

/** Better Auth client calls resolve to { data, error }; turn errors into throws. */
async function call<T>(promise: Promise<{ data: T | null; error: { message?: string } | null }>) {
  const { data, error } = await promise;
  if (error) throw new Error(error.message ?? "Request failed");
  return data as T;
}

const createSchema = z.object({
  name: z.string().trim().min(1, "required"),
  username: usernameSchema.min(3, "username_too_short"),
  password: z.string().min(6, "password_too_short"),
  role: z.enum(["admin", "user"]),
});

function CreateUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations("settings");
  const ta = useTranslations("auth");
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", username: "", password: "", role: "user" },
  });

  const mutation = useMutation({
    mutationFn: (v: z.infer<typeof createSchema>) => {
      const username = v.username.toLowerCase();
      return call(
        authClient.admin.createUser({
          name: v.name,
          email: `${username}@tayssir.local`,
          password: v.password,
          role: v.role,
          data: { username, displayUsername: v.username },
        }),
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: usersKey });
      toast.success(t("userCreated"));
      form.reset();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("newUser")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="grid gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{ta("fullName")}</FormLabel>
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
                  <FormLabel>{ta("username")}</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
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
                  <FormLabel>{ta("password")}</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
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
                  <Select value={field.value} onValueChange={field.onChange}>
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
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="animate-spin" />}
                {tc("create")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  userId,
  onOpenChange,
}: {
  userId: string | null;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const [password, setPassword] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      call(authClient.admin.setUserPassword({ userId: userId!, newPassword: password })),
    onSuccess: () => {
      toast.success(t("passwordReset"));
      setPassword("");
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={userId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (password.length >= 6) mutation.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("resetPassword")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="new-password">{t("newPassword")}</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {password.length > 0 && password.length < 6 && (
              <p className="text-destructive text-sm">{tv("password_too_short")}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={password.length < 6 || mutation.isPending}>
              {tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UsersManager() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const { user: me } = useCurrentUser();
  const [createOpen, setCreateOpen] = useState(false);
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [deleteFor, setDeleteFor] = useState<{ id: string; name: string } | null>(null);

  const users = useQuery({
    queryKey: usersKey,
    queryFn: () => call(authClient.admin.listUsers({ query: { limit: 200, sortBy: "name" } })),
  });

  const onError = (err: Error) => toast.error(err.message);
  const setRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      call(authClient.admin.setRole({ userId, role })),
    onSuccess: () => qc.invalidateQueries({ queryKey: usersKey }),
    onError,
  });
  const removeUser = useMutation({
    mutationFn: (userId: string) => call(authClient.admin.removeUser({ userId })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: usersKey });
      toast.success(tc("deleted"));
    },
    onError,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("users")}</CardTitle>
        <CardDescription>{t("usersDescription")}</CardDescription>
        <CardAction>
          <Button onClick={() => setCreateOpen(true)}>
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
            {users.data?.users.map((u) => {
              const isMe = u.id === me?.id;
              const role = (u.role ?? "user") as Role;
              const username =
                (u as { displayUsername?: string; username?: string }).displayUsername ??
                (u as { username?: string }).username;
              return (
                <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2 font-medium">
                      {u.name}
                      {isMe && <Badge variant="outline">{t("you")}</Badge>}
                    </span>
                    <span className="text-muted-foreground text-xs">@{username}</span>
                  </div>
                  <Select
                    value={role}
                    disabled={isMe || setRole.isPending}
                    onValueChange={(v) => setRole.mutate({ userId: u.id, role: v as Role })}
                  >
                    <SelectTrigger size="sm" className="w-36" aria-label={t("role")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">{t("cashier")}</SelectItem>
                      <SelectItem value="admin">{t("admin")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={tc("actions")}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setResetFor(u.id)}>
                        <KeyRound />
                        {t("resetPassword")}
                      </DropdownMenuItem>
                      {!isMe && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setDeleteFor({ id: u.id, name: u.name })}
                          >
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
      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ResetPasswordDialog userId={resetFor} onOpenChange={(o) => !o && setResetFor(null)} />
      <ConfirmDialog
        open={deleteFor !== null}
        onOpenChange={(o) => !o && setDeleteFor(null)}
        description={deleteFor ? t("deleteUserConfirm", { name: deleteFor.name }) : undefined}
        confirmLabel={tc("delete")}
        onConfirm={() => deleteFor && removeUser.mutate(deleteFor.id)}
      />
    </Card>
  );
}

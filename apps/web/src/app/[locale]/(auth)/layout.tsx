import { Store } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/40 flex min-h-dvh flex-col items-center justify-center gap-6 p-4">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-md">
          <Store className="size-5" />
        </div>
        Tayssir POS
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

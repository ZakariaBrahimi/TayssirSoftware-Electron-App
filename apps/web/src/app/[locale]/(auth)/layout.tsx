import { MizanLogo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/40 flex min-h-dvh flex-col items-center justify-center gap-6 p-4">
      <MizanLogo size={40} className="text-lg" />
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

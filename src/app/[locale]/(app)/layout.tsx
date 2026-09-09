import type { Metadata } from "next";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppShell } from "@/components/app/AppShell";

type Props = {
  children: React.ReactNode;
};

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function AppLayout({ children }: Props) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}

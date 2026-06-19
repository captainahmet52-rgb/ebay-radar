"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { AmazonSidebar } from "@/components/amazon/sidebar";
import { AMZ_ACCENT } from "@/components/amazon/shared";

export default function AmazonLayout({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") router.replace(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);

  if (status !== "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#050608" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: AMZ_ACCENT }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white" style={{ background: "#050608" }}>
      <AmazonSidebar />
      <main className="ml-[240px] min-h-screen">
        <div className="fixed inset-0 pointer-events-none overflow-hidden ml-[240px]">
          <div className="absolute -top-32 right-0 w-[55vw] h-[60vh]"
            style={{ background: `radial-gradient(ellipse at top right, ${AMZ_ACCENT}1c 0%, transparent 65%)` }} />
        </div>
        <div className="relative z-10 px-6 md:px-10 py-8">{children}</div>
      </main>
    </div>
  );
}

import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/3 w-[400px] h-[400px] bg-blue-600/8 rounded-full blur-[80px] pointer-events-none" />

      {/* Logo top-left */}
      <Link href="/" className="absolute top-6 left-6 hover:opacity-80 transition-opacity">
        <Logo size={32} />
      </Link>

      <div className="w-full max-w-sm relative z-10">{children}</div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const adminEmails = (process.env.ADMIN_EMAIL ?? "")
    .split(",")
    .map(e => e.trim())
    .filter(Boolean);

  if (!session?.user?.email || !adminEmails.includes(session.user.email)) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="bg-slate-900 border-b border-slate-700/50 px-6 py-4 flex items-center gap-6">
        <span className="font-bold text-violet-400">Admin Panel</span>
        <a href="/admin" className="text-sm text-slate-300 hover:text-white transition-colors">
          Dashboard
        </a>
        <a href="/admin/stores" className="text-sm text-slate-300 hover:text-white transition-colors">
          Magazalar
        </a>
        <a href="/admin/depot" className="text-sm text-slate-300 hover:text-white transition-colors">
          Depo
        </a>
        <a href="/admin/amazon" className="text-sm text-slate-300 hover:text-white transition-colors">
          AmazonBot
        </a>
        <a href="/admin/api-setup" className="text-sm text-slate-300 hover:text-white transition-colors">
          API Kurulumu
        </a>
        <a
          href="/dashboard"
          className="ml-auto text-sm text-slate-500 hover:text-white transition-colors"
        >
          Kullanici Paneli
        </a>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const adminEmails = (process.env.ADMIN_EMAIL ?? "")
    .split(",")
    .map(e => e.trim())
    .filter(Boolean);

  if (!session?.user?.email || !adminEmails.includes(session.user.email)) {
    redirect("/dashboard");
  }

  const unreadNotifs = await prisma.adminNotification.count({ where: { isRead: false } }).catch(() => 0);

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
        <a href="/admin/user-stores" className="text-sm text-slate-300 hover:text-white transition-colors">
          Musteri Magazalari
        </a>
        <a href="/admin/coupons" className="text-sm text-slate-300 hover:text-white transition-colors">
          Kuponlar
        </a>
        <a href="/admin/affiliates" className="text-sm text-slate-300 hover:text-white transition-colors">
          Ortaklar
        </a>
        <a href="/admin/notifications" className="text-sm text-slate-300 hover:text-white transition-colors flex items-center gap-1.5">
          Bildirimler
          {unreadNotifs > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">
              {unreadNotifs}
            </span>
          )}
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

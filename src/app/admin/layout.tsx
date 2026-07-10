import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "@/components/admin/admin-nav";

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
      <AdminNav unreadNotifs={unreadNotifs} />
      <main className="p-6">{children}</main>
    </div>
  );
}

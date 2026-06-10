import { prisma } from "@/lib/prisma";
import { RadarTriggerButton } from "./_components/RadarTriggerButton";

export default async function AdminPage() {
  const [storeCount, depotCount, userCount, distributionCount] = await Promise.all([
    prisma.trackedStore.count(),
    prisma.depotProduct.count(),
    prisma.user.count(),
    prisma.productDistribution.count(),
  ]);

  const stats = [
    { label: "Takip Edilen Magaza", value: storeCount, color: "text-violet-400" },
    { label: "Depodaki Urun", value: depotCount, color: "text-blue-400" },
    { label: "Toplam Kullanici", value: userCount, color: "text-emerald-400" },
    { label: "Toplam Dagilim", value: distributionCount, color: "text-amber-400" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map(s => (
          <div
            key={s.label}
            className="bg-slate-900/50 border border-slate-700/50 rounded-2xl p-6"
          >
            <p className="text-slate-400 text-sm">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>
      <div className="bg-slate-900/50 border border-slate-700/50 rounded-2xl p-6">
        <h2 className="font-semibold mb-4">Hizli Islemler</h2>
        <RadarTriggerButton />
      </div>
    </div>
  );
}

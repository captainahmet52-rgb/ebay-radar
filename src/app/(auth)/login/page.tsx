"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Mail, Lock, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("E-posta veya şifre hatalı. Lütfen tekrar deneyin.");
    } else {
      // Hangi bottan gelindiyse oraya dön (callbackUrl), yoksa eBay paneli
      const cb =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("callbackUrl")
          : null;
      router.push(cb && cb.startsWith("/") ? cb : "/dashboard");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl"
    >
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-white">Giriş Yap</h1>
        <p className="text-slate-400 text-sm mt-2">Hesabınıza erişin</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="E-posta"
          type="email"
          placeholder="ornek@mail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          icon={<Mail className="h-4 w-4" />}
          required
        />
        <Input
          label="Şifre"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          icon={<Lock className="h-4 w-4" />}
          required
        />

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
          >
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </motion.div>
        )}

        <Button type="submit" loading={loading} className="w-full justify-center" size="lg">
          Giriş Yap
        </Button>
      </form>

      <p className="text-center text-sm text-slate-400 mt-6">
        Hesabın yok mu?{" "}
        <Link href="/register" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
          Kayıt ol
        </Link>
      </p>
    </motion.div>
  );
}

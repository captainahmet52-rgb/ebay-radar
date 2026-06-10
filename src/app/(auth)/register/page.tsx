"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, AlertCircle, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function PasswordStrength({ password }: { password: string }) {
  const getStrength = (pwd: string): { label: string; score: number; color: string } => {
    let score = 0;
    if (pwd.length >= 8)            score++;
    if (/[A-Z]/.test(pwd))          score++;
    if (/[0-9]/.test(pwd))          score++;
    if (/[^A-Za-z0-9]/.test(pwd))   score++;

    if (score <= 1) return { label: "Zayıf",   score, color: "bg-red-500"    };
    if (score === 2) return { label: "Orta",    score, color: "bg-amber-500"  };
    if (score === 3) return { label: "İyi",     score, color: "bg-blue-500"   };
    return              { label: "Güçlü",       score, color: "bg-emerald-500" };
  };

  if (!password) return null;
  const { label, score, color } = getStrength(password);

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all duration-300",
              i < score ? color : "bg-slate-700"
            )}
          />
        ))}
      </div>
      <p className={cn("text-xs", score <= 1 ? "text-red-400" : score === 2 ? "text-amber-400" : score === 3 ? "text-blue-400" : "text-emerald-400")}>
        Şifre gücü: {label}
      </p>
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Şifreler eşleşmiyor.");
      return;
    }
    if (password.length < 8) {
      setError("Şifre en az 8 karakter olmalıdır.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Kayıt başarısız");

      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Bir hata oluştu");
    } finally {
      setLoading(false);
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
        <h1 className="text-2xl font-bold text-white">Hesap Oluştur</h1>
        <p className="text-slate-400 text-sm mt-2">Ücretsiz başla, istediğin zaman yükselt</p>
      </div>

      {success ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-3 py-8 text-center"
        >
          <CheckCircle className="h-12 w-12 text-emerald-400" />
          <p className="text-white font-semibold">Hesabınız oluşturuldu!</p>
          <p className="text-sm text-slate-400">Giriş sayfasına yönlendiriliyorsunuz...</p>
        </motion.div>
      ) : (
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
          <div className="space-y-2">
            <Input
              label="Şifre"
              type="password"
              placeholder="En az 8 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="h-4 w-4" />}
              required
            />
            <PasswordStrength password={password} />
          </div>
          <Input
            label="Şifre Tekrar"
            type="password"
            placeholder="Şifrenizi tekrar girin"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            icon={<Lock className="h-4 w-4" />}
            error={confirmPassword && confirmPassword !== password ? "Şifreler eşleşmiyor" : undefined}
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
            Kayıt Ol — Ücretsiz
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-slate-400 mt-6">
        Zaten hesabın var mı?{" "}
        <Link href="/login" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
          Giriş yap
        </Link>
      </p>
    </motion.div>
  );
}

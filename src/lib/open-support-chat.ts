// Canlı destek sohbetini (Tawk) programatik açar.
// Ödeme sağlayıcısı olmadığı sürece (Lemon Squeezy kaldırıldı, 2026-07-17)
// paket satın alma bu kanaldan manuel yürütülür: müşteri sohbete yazar,
// admin panelden hesap aktive edilir.

interface TawkApi {
  maximize?: () => void;
}

export function openSupportChat(): void {
  const w = window as unknown as { Tawk_API?: TawkApi };
  if (w.Tawk_API?.maximize) {
    w.Tawk_API.maximize();
  } else {
    // Widget yüklenmemişse (engellendi/geç yükleme) kullanıcıyı bilgilendir
    alert("Satın almak için sağ alttaki canlı destek sohbetinden bize yazın.");
  }
}

// NextAuth Session tipini genişlet.
//
// AYRI DOSYADA (.d.ts) tutuluyor çünkü `worker/tsconfig.json`, tip alias'ları için
// `src/types/index.ts`'i dahil ediyor ama worker programında next-auth bağımlılığı YOK.
// Augmentation index.ts içindeyken worker type-check'i "next-auth bulunamadı" diye
// patlıyordu. Burada (.d.ts) tutunca: app derlemesi (tsconfig `**/*.ts`) bunu alır,
// worker ise sadece index.ts'i aldığı için bu dosyaya hiç dokunmaz → worker temiz derlenir.
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      plan: string;
      role: string;
    };
  }
}

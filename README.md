# Fizioterapi Marketplace

Turborepo + pnpm monorepo:

- `apps/api`: NestJS API, JWT auth, role guard
- `apps/web`: Next.js App Router + Tailwind
- `apps/mobile`: Expo TypeScript
- `packages/db`: Prisma + PostgreSQL schema, migration, seed
- `packages/types`: Zod şemaları
- `packages/config`: paylaşımlı TypeScript ve ESLint config

## Local

```bash
corepack enable pnpm
pnpm install
cp .env.example .env
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm --filter @fizioterapi/api dev
```

Bu makinede Homebrew PostgreSQL rolü `ardacatalkaya` olduğu için doğrulama şu URL ile yapıldı:

```bash
DATABASE_URL="postgresql://ardacatalkaya@localhost:5432/fizioterapi?schema=public"
```

Admin seed kullanıcısı:

- Email: `admin@fizioterapi.local`
- Password: `Admin12345!`

## Terapist ve Admin Akışı

Terapist endpointleri:

- `GET/PATCH /therapists/me`
- `POST /therapists/me/documents` multipart `type=DIPLOMA|LICENSE`, `file`
- `PATCH /therapists/me/specialties`
- `GET/POST/PATCH/DELETE /therapists/me/packages`
- `GET /therapists/discover` sadece `APPROVED` terapistleri döner

Admin endpointleri:

- `GET /admin/therapists/pending`
- `GET /admin/therapists/:therapistId/documents`
- `PATCH /admin/therapists/:therapistId/review` body: `{ "status": "APPROVED" | "REJECTED" }`

Kural: `PENDING` veya `REJECTED` terapist uzmanlık ve paket yazamaz; bu işlemler için `APPROVED` gerekir.

## Hasta Keşif Akışı

- `GET /catalog/treatment-types`: tedavi türü adı ve açıklaması
- `GET /marketplace/therapists?treatmentType=manuel-terapi&mode=ONLINE&minPrice=1000&maxPrice=2500`: sadece `APPROVED` terapistler; ortalama yıldız ve yorum sayısına göre sıralı
- `GET /marketplace/therapists/:therapistId`: profil, uzmanlıklar, paketler, yorumlar ve ortalama yıldız
- `GET /assessment/questions`: yönlendirme testi soruları
- `POST /assessment/results`: `{ "optionIds": ["..."] }`; `AssessmentRule.weight` skorlarını toplayıp en yüksek tedavi türünü önerir ve `AssessmentResult` kaydeder

Yönlendirme testi yanıtı her zaman şu uyarıyı döner: `Bu tıbbi tavsiye değildir, kesin tanı için hekime başvurun`.

Not: Randevu/slot rezervasyonu, iyzico escrow ödeme ve sadakat (kademe) sistemleri kaldırıldı. Paketler yalnızca bilgi/fiyat olarak listelenir; hasta ile terapist iletişimi uygulama içi mesajlaşma üzerinden yürür.

## Mesajlaşma

Hasta bir terapistin profilinden mesaj talebi başlatır; terapist onaylarsa iki taraf mesaj alanında görüşür.

- `POST /conversations`: PATIENT, `{ therapistProfileId, message? }`. Görüşme `PENDING` oluşturulur; reddedilmiş bir talep tekrar gönderilince yeniden `PENDING` olur.
- `GET /conversations`: taraf olduğun görüşmeler, son mesaj ve okunmamış sayısıyla.
- `GET /conversations/unread-count`: toplam okunmamış mesaj adedi.
- `GET /conversations/:id/messages`: mesajları döner ve gelenleri okunmuş işaretler.
- `POST /conversations/:id/messages`: `{ body }`. Onaydan önce yalnızca hasta yazabilir; onaydan sonra iki taraf da yazar; reddedilmişse kimse yazamaz.
- `PATCH /conversations/:id/accept` ve `PATCH /conversations/:id/reject`: THERAPIST, bekleyen talebi yanıtlar.

## Mobil Uygulama

- `apps/mobile` Expo TS uygulaması aynı backend API yüzeyini kullanır.
- Token saklama: `expo-secure-store`.
- Ortak client: `packages/types/src/api-client.ts`.
- Hasta akışı: keşif, tedavi türleri, test, terapist detay, mesajlaşma.
- Terapist akışı: panel ve mesajlaşma.
- Lokal API URL varsayılanı iOS için `http://localhost:3001`, Android emulator için `http://10.0.2.2:3001`.

Çalıştırma:

```bash
pnpm --filter @fizioterapi/api start
pnpm --filter @fizioterapi/mobile dev
```

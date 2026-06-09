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
- `GET/POST/DELETE /therapists/me/slots`
- `GET /therapists/discover` sadece `APPROVED` terapistleri döner

Admin endpointleri:

- `GET /admin/therapists/pending`
- `GET /admin/therapists/:therapistId/documents`
- `PATCH /admin/therapists/:therapistId/review` body: `{ "status": "APPROVED" | "REJECTED" }`

Kural: `PENDING` veya `REJECTED` terapist uzmanlık, paket ve slot yazamaz; bu işlemler için `APPROVED` gerekir.

## Hasta Keşif Akışı

- `GET /catalog/treatment-types`: tedavi türü adı ve açıklaması
- `GET /marketplace/therapists?treatmentType=manuel-terapi&mode=ONLINE&minPrice=1000&maxPrice=2500`: sadece `APPROVED` terapistler; tier, ortalama yıldız ve yorum sayısına göre sıralı
- `GET /marketplace/therapists/:therapistId`: profil, uzmanlıklar, paketler, yorumlar ve ortalama yıldız
- `GET /assessment/questions`: yönlendirme testi soruları
- `POST /assessment/results`: `{ "optionIds": ["..."] }`; `AssessmentRule.weight` skorlarını toplayıp en yüksek tedavi türünü önerir ve `AssessmentResult` kaydeder

Yönlendirme testi yanıtı her zaman şu uyarıyı döner: `Bu tıbbi tavsiye değildir, kesin tanı için hekime başvurun`.

## Randevu State Machine

- `POST /appointments/requests`: PATIENT, `slotId` + `packageId`; transaction içinde slot `OPEN -> PENDING`, appointment `REQUESTED`, `autoExpireAt = now + 24h`.
- `PATCH /appointments/:appointmentId/confirm`: THERAPIST, `REQUESTED -> CONFIRMED`, slot `PENDING -> BOOKED`; `ONLINE/BOTH` paketlerde `videoLink` zorunlu.
- `PATCH /appointments/:appointmentId/complete`: THERAPIST veya ADMIN, `CONFIRMED -> COMPLETED`.
- `PATCH /appointments/:appointmentId/cancel/patient`: PATIENT, kredi varsa `CANCELLED`, `cancelledBy=PATIENT`, kredi -1, slot `OPEN`.
- `PATCH /appointments/:appointmentId/cancel/therapist`: THERAPIST, `CANCELLED`, `cancelledBy=THERAPIST`, slot `OPEN`.
- Dakikalık scheduler: süresi dolan `REQUESTED` kayıtları `CANCELLED/SYSTEM`, slotları `OPEN` yapar.
- Eşzamanlı slot talebinde transaction write conflict `409 Conflict` döner.

## İyzico Escrow Ödeme

- Terapist `APPROVED` olduğunda mock iyzico sub-merchant oluşturulur ve `iyzicoSubMerchantId` kaydedilir.
- Randevu `CONFIRMED` olurken ödeme tahsil edilir ve `Payment HELD` oluşturulur.
- Komisyon: `package.price * therapist.commissionRate`; kalan tutar `therapistPayout` olarak tutulur.
- Randevu `COMPLETED` olduğunda `Payment HELD -> RELEASED` ve release event’i idempotent yazılır.
- Hasta veya terapist iptalinde HELD ödeme tam iade edilir ve `Payment REFUNDED` olur.
- Terapist iptalinde `penaltyCount` artırılır.
- `POST /payments/iyzico/webhook` tekrar gelen `eventId` değerlerini `PaymentEvent.idempotencyKey` ile tekilleştirir.
- Gerçek iyzico çağrıları için adapter noktası: `apps/api/src/payments/iyzico.service.ts`.

## Kademe Sistemi

- `LoyaltyService`, randevu `COMPLETED` olduğunda transaction içinde hasta ve terapist sayaçlarını günceller.
- Hasta eşikleri: `BRONZE 0-4`, `SILVER 5-14`, `GOLD 15-29`, `VIP 30+`.
- Hasta kredi üst sınırı: `1/2/3/4`; yükselişte kredi yeni üst sınıra tamamlanır.
- Hasta indirimi: `SILVER %5`, `GOLD %10`, `VIP %15`; ödeme `HELD` edilirken package fiyatından düşülür.
- Terapist komisyonu: `BRONZE 0.20`, `SILVER 0.18`, `GOLD 0.15`, `VIP 0.12`.
- Terapist arama sıralaması mevcut sayısal `tier` alanını kullanır; loyalty geçişinde bu alan `BRONZE=0`, `SILVER=1`, `GOLD=2`, `VIP=3` olarak senkronlanır.

## Mobil Uygulama

- `apps/mobile` Expo TS uygulaması aynı backend API yüzeyini kullanır.
- Token saklama: `expo-secure-store`.
- İyzico mobil akışı: `react-native-webview` ile `GET /payments/mobile-checkout/:appointmentId` URL’i açılır.
- Ortak client: `packages/types/src/api-client.ts`.
- Hasta akışı: keşif, tedavi türleri, test, terapist detay, randevu talebi, randevularım, yorum, kademe.
- Terapist akışı: profil, paket/slot ekleme, gelen talepler, onay/red, randevu tamamlama.
- Lokal API URL varsayılanı iOS için `http://localhost:3001`, Android emulator için `http://10.0.2.2:3001`.

Çalıştırma:

```bash
pnpm --filter @fizioterapi/api start
pnpm --filter @fizioterapi/mobile dev
```

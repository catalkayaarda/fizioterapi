-- DropForeignKey / DropTable: payments, appointments, availability slots
DROP TABLE IF EXISTS "PaymentEvent" CASCADE;
DROP TABLE IF EXISTS "Payment" CASCADE;
DROP TABLE IF EXISTS "Appointment" CASCADE;
DROP TABLE IF EXISTS "AvailabilitySlot" CASCADE;

-- Drop loyalty / appointment related columns on User
ALTER TABLE "User"
  DROP COLUMN IF EXISTS "cancellationCredits",
  DROP COLUMN IF EXISTS "completedAppointments",
  DROP COLUMN IF EXISTS "loyaltyTier";

-- Drop loyalty / escrow related columns on TherapistProfile
ALTER TABLE "TherapistProfile"
  DROP COLUMN IF EXISTS "tier",
  DROP COLUMN IF EXISTS "loyaltyTier",
  DROP COLUMN IF EXISTS "completedAppointments",
  DROP COLUMN IF EXISTS "commissionRate",
  DROP COLUMN IF EXISTS "iyzicoSubMerchantId",
  DROP COLUMN IF EXISTS "penaltyCount";

-- Drop now-unused enums
DROP TYPE IF EXISTS "PaymentEventType";
DROP TYPE IF EXISTS "PaymentStatus";
DROP TYPE IF EXISTS "AppointmentStatus";
DROP TYPE IF EXISTS "CancelledBy";
DROP TYPE IF EXISTS "AvailabilityStatus";
DROP TYPE IF EXISTS "LoyaltyTier";

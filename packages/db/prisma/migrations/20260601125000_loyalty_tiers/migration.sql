-- CreateEnum
CREATE TYPE "LoyaltyTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'VIP');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discountRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
ADD COLUMN     "originalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TherapistProfile" ADD COLUMN     "completedAppointments" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "loyaltyTier" "LoyaltyTier" NOT NULL DEFAULT 'BRONZE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "completedAppointments" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "loyaltyTier" "LoyaltyTier" NOT NULL DEFAULT 'BRONZE';

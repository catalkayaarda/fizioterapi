/*
  Warnings:

  - You are about to drop the `_TherapistProfileToTreatmentType` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `fullName` to the `TherapistProfile` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TherapistStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('DIPLOMA', 'LICENSE');

-- CreateEnum
CREATE TYPE "PackageMode" AS ENUM ('PHYSICAL', 'ONLINE', 'BOTH');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('OPEN', 'BOOKED', 'CLOSED');

-- DropForeignKey
ALTER TABLE "_TherapistProfileToTreatmentType" DROP CONSTRAINT "_TherapistProfileToTreatmentType_A_fkey";

-- DropForeignKey
ALTER TABLE "_TherapistProfileToTreatmentType" DROP CONSTRAINT "_TherapistProfileToTreatmentType_B_fkey";

-- AlterTable
ALTER TABLE "TherapistProfile" ADD COLUMN     "fullName" TEXT NOT NULL,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "status" "TherapistStatus" NOT NULL DEFAULT 'PENDING';

-- DropTable
DROP TABLE "_TherapistProfileToTreatmentType";

-- CreateTable
CREATE TABLE "TherapistDocument" (
    "id" TEXT NOT NULL,
    "therapistProfileId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TherapistDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TherapistSpecialty" (
    "id" TEXT NOT NULL,
    "therapistProfileId" TEXT NOT NULL,
    "treatmentTypeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TherapistSpecialty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TherapistPackage" (
    "id" TEXT NOT NULL,
    "therapistProfileId" TEXT NOT NULL,
    "treatmentTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sessionCount" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "mode" "PackageMode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TherapistPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilitySlot" (
    "id" TEXT NOT NULL,
    "therapistProfileId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "AvailabilityStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilitySlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TherapistDocument_therapistProfileId_idx" ON "TherapistDocument"("therapistProfileId");

-- CreateIndex
CREATE INDEX "TherapistSpecialty_treatmentTypeId_idx" ON "TherapistSpecialty"("treatmentTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "TherapistSpecialty_therapistProfileId_treatmentTypeId_key" ON "TherapistSpecialty"("therapistProfileId", "treatmentTypeId");

-- CreateIndex
CREATE INDEX "TherapistPackage_therapistProfileId_idx" ON "TherapistPackage"("therapistProfileId");

-- CreateIndex
CREATE INDEX "TherapistPackage_treatmentTypeId_idx" ON "TherapistPackage"("treatmentTypeId");

-- CreateIndex
CREATE INDEX "AvailabilitySlot_therapistProfileId_startsAt_idx" ON "AvailabilitySlot"("therapistProfileId", "startsAt");

-- CreateIndex
CREATE INDEX "AvailabilitySlot_status_idx" ON "AvailabilitySlot"("status");

-- CreateIndex
CREATE INDEX "TherapistProfile_status_idx" ON "TherapistProfile"("status");

-- AddForeignKey
ALTER TABLE "TherapistDocument" ADD CONSTRAINT "TherapistDocument_therapistProfileId_fkey" FOREIGN KEY ("therapistProfileId") REFERENCES "TherapistProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TherapistSpecialty" ADD CONSTRAINT "TherapistSpecialty_therapistProfileId_fkey" FOREIGN KEY ("therapistProfileId") REFERENCES "TherapistProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TherapistSpecialty" ADD CONSTRAINT "TherapistSpecialty_treatmentTypeId_fkey" FOREIGN KEY ("treatmentTypeId") REFERENCES "TreatmentType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TherapistPackage" ADD CONSTRAINT "TherapistPackage_therapistProfileId_fkey" FOREIGN KEY ("therapistProfileId") REFERENCES "TherapistProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TherapistPackage" ADD CONSTRAINT "TherapistPackage_treatmentTypeId_fkey" FOREIGN KEY ("treatmentTypeId") REFERENCES "TreatmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_therapistProfileId_fkey" FOREIGN KEY ("therapistProfileId") REFERENCES "TherapistProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

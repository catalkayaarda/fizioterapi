-- AlterTable
ALTER TABLE "TherapistProfile" ADD COLUMN     "tier" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "TherapistReview" (
    "id" TEXT NOT NULL,
    "therapistProfileId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "authorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TherapistReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentResult" (
    "id" TEXT NOT NULL,
    "recommendedTreatmentTypeId" TEXT,
    "answers" JSONB NOT NULL,
    "scores" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TherapistReview_therapistProfileId_idx" ON "TherapistReview"("therapistProfileId");

-- CreateIndex
CREATE INDEX "AssessmentResult_recommendedTreatmentTypeId_idx" ON "AssessmentResult"("recommendedTreatmentTypeId");

-- AddForeignKey
ALTER TABLE "TherapistReview" ADD CONSTRAINT "TherapistReview_therapistProfileId_fkey" FOREIGN KEY ("therapistProfileId") REFERENCES "TherapistProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentResult" ADD CONSTRAINT "AssessmentResult_recommendedTreatmentTypeId_fkey" FOREIGN KEY ("recommendedTreatmentTypeId") REFERENCES "TreatmentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

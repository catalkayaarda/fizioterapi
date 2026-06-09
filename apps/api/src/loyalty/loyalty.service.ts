import { Injectable } from "@nestjs/common";
import { LoyaltyTier, Prisma } from "@fizioterapi/db";

const tierWeights: Record<LoyaltyTier, number> = {
  BRONZE: 0,
  SILVER: 1,
  GOLD: 2,
  VIP: 3
};

const patientCreditCaps: Record<LoyaltyTier, number> = {
  BRONZE: 1,
  SILVER: 2,
  GOLD: 3,
  VIP: 4
};

const patientDiscounts: Record<LoyaltyTier, Prisma.Decimal> = {
  BRONZE: new Prisma.Decimal(0),
  SILVER: new Prisma.Decimal(0.05),
  GOLD: new Prisma.Decimal(0.10),
  VIP: new Prisma.Decimal(0.15)
};

const therapistCommissions: Record<LoyaltyTier, Prisma.Decimal> = {
  BRONZE: new Prisma.Decimal(0.20),
  SILVER: new Prisma.Decimal(0.18),
  GOLD: new Prisma.Decimal(0.15),
  VIP: new Prisma.Decimal(0.12)
};

@Injectable()
export class LoyaltyService {
  getTierForCompleted(completedAppointments: number): LoyaltyTier {
    if (completedAppointments >= 30) return LoyaltyTier.VIP;
    if (completedAppointments >= 15) return LoyaltyTier.GOLD;
    if (completedAppointments >= 5) return LoyaltyTier.SILVER;
    return LoyaltyTier.BRONZE;
  }

  getPatientDiscountRate(tier: LoyaltyTier): Prisma.Decimal {
    return patientDiscounts[tier];
  }

  async applyCompletedAppointment(tx: Prisma.TransactionClient, appointmentId: string) {
    const appointment = await tx.appointment.findUniqueOrThrow({
      where: { id: appointmentId },
      include: { patient: true, therapistProfile: true }
    });

    const patientCompleted = appointment.patient.completedAppointments + 1;
    const patientTier = this.getTierForCompleted(patientCompleted);
    const creditCap = patientCreditCaps[patientTier];
    await tx.user.update({
      where: { id: appointment.patientId },
      data: {
        completedAppointments: patientCompleted,
        loyaltyTier: patientTier,
        cancellationCredits: Math.max(appointment.patient.cancellationCredits, creditCap)
      }
    });

    const therapistCompleted = appointment.therapistProfile.completedAppointments + 1;
    const therapistTier = this.getTierForCompleted(therapistCompleted);
    await tx.therapistProfile.update({
      where: { id: appointment.therapistProfileId },
      data: {
        completedAppointments: therapistCompleted,
        loyaltyTier: therapistTier,
        tier: tierWeights[therapistTier],
        commissionRate: therapistCommissions[therapistTier]
      }
    });

    return { patientTier, therapistTier };
  }
}

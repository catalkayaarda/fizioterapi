import { BadRequestException, Injectable } from "@nestjs/common";
import { AppointmentStatus, CancelledBy, PaymentEventType, PaymentStatus, Prisma } from "@fizioterapi/db";
import { z } from "zod";
import { PrismaService } from "../prisma.service";
import { IyzicoService } from "./iyzico.service";
import { LoyaltyService } from "../loyalty/loyalty.service";

export const webhookSchema = z.object({
  eventId: z.string().min(1),
  paymentId: z.string().optional(),
  conversationId: z.string().optional(),
  status: z.enum(["HELD", "RELEASED", "REFUNDED", "FAILED"]),
  payload: z.record(z.unknown()).default({})
});

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly iyzico: IyzicoService,
    private readonly loyalty: LoyaltyService
  ) {}

  async createSubMerchantForTherapist(therapistId: string) {
    const profile = await this.prisma.therapistProfile.findUnique({
      where: { id: therapistId },
      include: { user: { select: { email: true } } }
    });
    if (!profile) {
      throw new BadRequestException("Terapist profili bulunamadı.");
    }
    if (profile.iyzicoSubMerchantId) {
      return profile;
    }

    const subMerchant = await this.iyzico.createSubMerchant({
      therapistProfileId: profile.id,
      fullName: profile.fullName,
      email: profile.user.email
    });

    return this.prisma.therapistProfile.update({
      where: { id: profile.id },
      data: { iyzicoSubMerchantId: subMerchant.subMerchantKey }
    });
  }

  async holdForConfirmedAppointment(tx: Prisma.TransactionClient, appointmentId: string) {
    const existing = await tx.payment.findUnique({ where: { appointmentId } });
    if (existing) {
      return existing;
    }

    const appointment = await tx.appointment.findUniqueOrThrow({
      where: { id: appointmentId },
      include: { package: true, therapistProfile: true, patient: true }
    });
    if (appointment.status !== AppointmentStatus.CONFIRMED) {
      throw new BadRequestException("Tahsilat yalnızca onaylı randevular için güvenceye alınabilir.");
    }
    if (!appointment.therapistProfile.iyzicoSubMerchantId) {
      throw new BadRequestException("Terapistin iyzico alt üye işyeri bulunmuyor.");
    }

    const originalAmount = new Prisma.Decimal(appointment.package.price);
    const discountRate = this.loyalty.getPatientDiscountRate(appointment.patient.loyaltyTier);
    const discountAmount = originalAmount.mul(discountRate).toDecimalPlaces(2);
    const amount = originalAmount.minus(discountAmount).toDecimalPlaces(2);
    const commission = amount.mul(appointment.therapistProfile.commissionRate).toDecimalPlaces(2);
    const therapistPayout = amount.minus(commission).toDecimalPlaces(2);
    const provider = await this.iyzico.chargeAndHold({
      appointmentId,
      amount: amount.toFixed(2),
      commission: commission.toFixed(2),
      subMerchantKey: appointment.therapistProfile.iyzicoSubMerchantId
    });

    const payment = await tx.payment.create({
      data: {
        appointmentId,
        status: PaymentStatus.HELD,
        amount,
        originalAmount,
        discountAmount,
        discountRate,
        commission,
        therapistPayout,
        iyzicoPaymentId: provider.paymentId,
        iyzicoConversationId: provider.conversationId
      }
    });
    await this.createEvent(tx, payment.id, PaymentEventType.CHARGE_HELD, "hold:" + appointmentId, provider.raw);
    return payment;
  }

  async releaseForCompletedAppointment(tx: Prisma.TransactionClient, appointmentId: string) {
    const payment = await tx.payment.findUnique({
      where: { appointmentId },
      include: { appointment: { include: { therapistProfile: true } } }
    });
    if (!payment) {
      throw new BadRequestException("Ödeme bulunamadı.");
    }
    if (payment.status === PaymentStatus.RELEASED) {
      return payment;
    }
    if (payment.status !== PaymentStatus.HELD) {
      throw new BadRequestException("Yalnızca güvencedeki ödemeler aktarılabilir.");
    }

    const provider = await this.iyzico.release({
      paymentId: payment.iyzicoPaymentId ?? payment.id,
      appointmentId,
      amount: payment.therapistPayout.toFixed(2),
      commission: payment.commission.toFixed(2),
      subMerchantKey: payment.appointment.therapistProfile.iyzicoSubMerchantId ?? ""
    });
    await this.createEvent(tx, payment.id, PaymentEventType.RELEASED, "release:" + appointmentId, provider.raw);
    return tx.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.RELEASED, releasedAt: new Date() }
    });
  }

  async refundForCancelledAppointment(tx: Prisma.TransactionClient, appointmentId: string, cancelledBy: CancelledBy) {
    const payment = await tx.payment.findUnique({ where: { appointmentId } });
    if (!payment) {
      return null;
    }
    if (payment.status === PaymentStatus.REFUNDED) {
      return payment;
    }
    if (payment.status !== PaymentStatus.HELD) {
      throw new BadRequestException("Yalnızca güvencedeki ödemeler iade edilebilir.");
    }

    const provider = await this.iyzico.refund({
      paymentId: payment.iyzicoPaymentId ?? payment.id,
      appointmentId,
      amount: payment.amount.toFixed(2)
    });
    await this.createEvent(tx, payment.id, PaymentEventType.REFUNDED, "refund:" + appointmentId + ":" + cancelledBy, provider.raw);
    return tx.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.REFUNDED, refundId: provider.refundId, refundedAt: new Date() }
    });
  }


  async getMobileCheckout(appointmentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { appointmentId } });
    if (!payment) {
      throw new BadRequestException("Ödeme henüz oluşturulmadı.");
    }
    return {
      appointmentId,
      paymentId: payment.iyzicoPaymentId,
      status: payment.status,
      amount: payment.amount,
      checkoutUrl: "https://sandbox-iyzico.local/mobile-3ds/" + (payment.iyzicoPaymentId ?? payment.id)
    };
  }


  async handleWebhook(input: z.infer<typeof webhookSchema>) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.paymentEvent.findUnique({ where: { idempotencyKey: "webhook:" + input.eventId } });
      if (existing) {
        return { processed: false, eventId: existing.id };
      }

      const payment = input.paymentId
        ? await tx.payment.findFirst({ where: { OR: [{ iyzicoPaymentId: input.paymentId }, { iyzicoConversationId: input.conversationId }] } })
        : input.conversationId
          ? await tx.payment.findUnique({ where: { iyzicoConversationId: input.conversationId } })
          : null;

      const event = await this.createEvent(tx, payment?.id, PaymentEventType.WEBHOOK, "webhook:" + input.eventId, {
        ...input.payload,
        status: input.status,
        paymentId: input.paymentId,
        conversationId: input.conversationId
      }, input.eventId);

      if (payment) {
        await tx.payment.update({ where: { id: payment.id }, data: { status: input.status } });
      }

      return { processed: true, eventId: event.id, paymentId: payment?.id ?? null };
    });
  }

  private async createEvent(
    tx: Prisma.TransactionClient,
    paymentId: string | undefined,
    type: PaymentEventType,
    idempotencyKey: string,
    payload: unknown,
    providerEventId?: string
  ) {
    const existing = await tx.paymentEvent.findUnique({ where: { idempotencyKey } });
    if (existing) {
      return existing;
    }
    return tx.paymentEvent.create({
      data: {
        paymentId,
        type,
        idempotencyKey,
        providerEventId,
        payload: payload as Prisma.InputJsonValue
      }
    });
  }
}

import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { AppointmentStatus, AvailabilityStatus, CancelledBy, PackageMode, Prisma, Role } from "@fizioterapi/db";
import { z } from "zod";
import { PrismaService } from "../prisma.service";
import { PaymentsService } from "../payments/payments.service";
import { LoyaltyService } from "../loyalty/loyalty.service";

export const createAppointmentSchema = z.object({
  slotId: z.string().min(1),
  packageId: z.string().min(1)
});

export const confirmAppointmentSchema = z.object({
  videoLink: z.string().url().optional()
});

export const cancelAppointmentSchema = z.object({
  reason: z.string().max(1000).optional()
});

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly loyalty: LoyaltyService
  ) {}


  async listForUser(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.role === Role.PATIENT) {
      return this.prisma.appointment.findMany({
        where: { patientId: userId },
        include: this.includeGraph(),
        orderBy: { createdAt: "desc" }
      });
    }

    if (user.role === Role.THERAPIST) {
      const profile = await this.prisma.therapistProfile.findUnique({ where: { userId } });
      if (!profile) return [];
      return this.prisma.appointment.findMany({
        where: { therapistProfileId: profile.id },
        include: this.includeGraph(),
        orderBy: { createdAt: "desc" }
      });
    }

    return this.prisma.appointment.findMany({
      include: this.includeGraph(),
      orderBy: { createdAt: "desc" }
    });
  }

  async listIncomingRequests(therapistUserId: string) {
    const profile = await this.prisma.therapistProfile.findUnique({ where: { userId: therapistUserId } });
    if (!profile) {
      throw new ForbiddenException("Terapist profili bulunamadı.");
    }
    return this.prisma.appointment.findMany({
      where: { therapistProfileId: profile.id, status: AppointmentStatus.REQUESTED },
      include: this.includeGraph(),
      orderBy: { createdAt: "asc" }
    });
  }


  async createRequest(patientId: string, input: z.infer<typeof createAppointmentSchema>) {
    const patient = await this.prisma.user.findUniqueOrThrow({ where: { id: patientId } });
    if (patient.role !== Role.PATIENT) {
      throw new ForbiddenException("Randevu talebini yalnızca hastalar oluşturabilir.");
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
      const slot = await tx.availabilitySlot.findUnique({
        where: { id: input.slotId },
        include: { therapistProfile: true }
      });
      if (!slot) {
        throw new NotFoundException("Slot bulunamadı.");
      }
      if (slot.status !== AvailabilityStatus.OPEN) {
        throw new BadRequestException("Slot açık değil.");
      }

      const selectedPackage = await tx.therapistPackage.findUnique({ where: { id: input.packageId } });
      if (!selectedPackage || selectedPackage.therapistProfileId !== slot.therapistProfileId) {
        throw new BadRequestException("Paket bu slotun terapistine ait değil.");
      }

      const updated = await tx.availabilitySlot.updateMany({
        where: { id: input.slotId, status: AvailabilityStatus.OPEN },
        data: { status: AvailabilityStatus.PENDING }
      });
      if (updated.count !== 1) {
        throw new BadRequestException("Slot açık değil.");
      }

      return tx.appointment.create({
        data: {
          patientId,
          therapistProfileId: slot.therapistProfileId,
          packageId: input.packageId,
          slotId: input.slotId,
          status: AppointmentStatus.REQUESTED,
          autoExpireAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        },
        include: this.includeGraph()
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        throw new ConflictException("Slot başka bir talep tarafından alındı. Lütfen başka bir slot seçin.");
      }
      throw error;
    }
  }

  async confirm(therapistUserId: string, appointmentId: string, input: z.infer<typeof confirmAppointmentSchema>) {
    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.therapistProfile.findUnique({ where: { userId: therapistUserId } });
      if (!profile) {
        throw new ForbiddenException("Terapist profili bulunamadı.");
      }

      const appointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
        include: { package: true, slot: true, therapistProfile: true }
      });
      if (!appointment || appointment.therapistProfileId !== profile.id) {
        throw new NotFoundException("Randevu bulunamadı.");
      }
      if (appointment.status !== AppointmentStatus.REQUESTED) {
        throw new BadRequestException("Yalnızca talep edilen randevular onaylanabilir.");
      }
      if (appointment.slot.status !== AvailabilityStatus.PENDING) {
        throw new BadRequestException("Onaydan önce slot beklemede olmalıdır.");
      }
      if ((appointment.package.mode === PackageMode.ONLINE || appointment.package.mode === PackageMode.BOTH) && !input.videoLink) {
        throw new BadRequestException("Online veya karma paketlerde video bağlantısı zorunludur.");
      }

      if (!appointment.therapistProfile.iyzicoSubMerchantId) {
        throw new BadRequestException("Terapistin iyzico alt üye işyeri eksik.");
      }

      await tx.availabilitySlot.update({ where: { id: appointment.slotId }, data: { status: AvailabilityStatus.BOOKED } });
      const confirmed = await tx.appointment.update({
        where: { id: appointment.id },
        data: {
          status: AppointmentStatus.CONFIRMED,
          videoLink: input.videoLink,
          confirmedAt: new Date()
        },
        include: this.includeGraph()
      });
      await this.payments.holdForConfirmedAppointment(tx, appointment.id);
      return confirmed;
    });
  }

  async complete(actorId: string, appointmentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
        include: { therapistProfile: true }
      });
      if (!appointment) {
        throw new NotFoundException("Randevu bulunamadı.");
      }
      if (appointment.status !== AppointmentStatus.CONFIRMED) {
        throw new BadRequestException("Yalnızca onaylı randevular tamamlanabilir.");
      }
      if (appointment.therapistProfile.userId !== actorId) {
        const actor = await tx.user.findUniqueOrThrow({ where: { id: actorId } });
        if (actor.role !== Role.ADMIN) {
          throw new ForbiddenException("Randevuyu yalnızca ilgili terapist veya sistem/yönetici tamamlayabilir.");
        }
      }

      const completed = await tx.appointment.update({
        where: { id: appointment.id },
        data: { status: AppointmentStatus.COMPLETED, completedAt: new Date() },
        include: this.includeGraph()
      });
      await this.payments.releaseForCompletedAppointment(tx, appointment.id);
      await this.loyalty.applyCompletedAppointment(tx, appointment.id);
      return completed;
    });
  }

  async cancelByPatient(patientId: string, appointmentId: string, reason?: string) {
    return this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({ where: { id: appointmentId }, include: { patient: true, slot: true } });
      if (!appointment || appointment.patientId !== patientId) {
        throw new NotFoundException("Randevu bulunamadı.");
      }
      if (appointment.status !== AppointmentStatus.REQUESTED && appointment.status !== AppointmentStatus.CONFIRMED) {
        throw new BadRequestException("Hasta yalnızca talep edilen veya onaylı randevuyu iptal edebilir.");
      }
      if (appointment.patient.cancellationCredits <= 0) {
        throw new ForbiddenException("İptal krediniz kalmadı.");
      }

      await tx.user.update({ where: { id: patientId }, data: { cancellationCredits: { decrement: 1 } } });
      await tx.availabilitySlot.update({ where: { id: appointment.slotId }, data: { status: AvailabilityStatus.OPEN } });
      await this.payments.refundForCancelledAppointment(tx, appointment.id, CancelledBy.PATIENT);
      return tx.appointment.update({
        where: { id: appointment.id },
        data: {
          status: AppointmentStatus.CANCELLED,
          cancelledBy: CancelledBy.PATIENT,
          cancellationReason: reason,
          cancelledAt: new Date()
        },
        include: this.includeGraph()
      });
    });
  }

  async cancelByTherapist(therapistUserId: string, appointmentId: string, reason?: string) {
    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.therapistProfile.findUnique({ where: { userId: therapistUserId } });
      if (!profile) {
        throw new ForbiddenException("Terapist profili bulunamadı.");
      }
      const appointment = await tx.appointment.findUnique({ where: { id: appointmentId } });
      if (!appointment || appointment.therapistProfileId !== profile.id) {
        throw new NotFoundException("Randevu bulunamadı.");
      }
      if (appointment.status !== AppointmentStatus.REQUESTED && appointment.status !== AppointmentStatus.CONFIRMED) {
        throw new BadRequestException("Terapist yalnızca talep edilen veya onaylı randevuyu iptal edebilir.");
      }

      await tx.availabilitySlot.update({ where: { id: appointment.slotId }, data: { status: AvailabilityStatus.OPEN } });
      await tx.therapistProfile.update({ where: { id: profile.id }, data: { penaltyCount: { increment: 1 } } });
      await this.payments.refundForCancelledAppointment(tx, appointment.id, CancelledBy.THERAPIST);
      return tx.appointment.update({
        where: { id: appointment.id },
        data: {
          status: AppointmentStatus.CANCELLED,
          cancelledBy: CancelledBy.THERAPIST,
          cancellationReason: reason,
          cancelledAt: new Date()
        },
        include: this.includeGraph()
      });
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async expireRequestedAppointments() {
    await this.expireNow(new Date());
  }

  async expireNow(now = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      const expired = await tx.appointment.findMany({
        where: { status: AppointmentStatus.REQUESTED, autoExpireAt: { lte: now } },
        select: { id: true, slotId: true }
      });

      for (const appointment of expired) {
        await tx.availabilitySlot.update({ where: { id: appointment.slotId }, data: { status: AvailabilityStatus.OPEN } });
        await tx.appointment.update({
          where: { id: appointment.id },
          data: {
            status: AppointmentStatus.CANCELLED,
            cancelledBy: CancelledBy.SYSTEM,
            cancellationReason: "24 saat içinde onaylanmadığı için otomatik iptal edildi.",
            cancelledAt: now
          }
        });
      }

      return { expiredCount: expired.length };
    });
  }

  private includeGraph() {
    return {
      patient: { select: { id: true, email: true, name: true, cancellationCredits: true } },
      therapistProfile: true,
      package: true,
      slot: true
    } as const;
  }
}

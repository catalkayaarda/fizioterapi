import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { TherapistStatus } from "@fizioterapi/db";
import { z } from "zod";
import { PrismaService } from "../prisma.service";

export const reviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: z.string().max(1000).optional()
});

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  listPendingTherapists() {
    return this.prisma.therapistProfile.findMany({
      where: { status: TherapistStatus.PENDING },
      include: {
        user: { select: { id: true, email: true, name: true } },
        documents: true,
        specialties: { include: { treatmentType: true } }
      },
      orderBy: { createdAt: "asc" }
    });
  }

  async listDocuments(therapistId: string) {
    const profile = await this.prisma.therapistProfile.findUnique({
      where: { id: therapistId },
      include: { documents: true, user: { select: { email: true, name: true } } }
    });

    if (!profile) {
      throw new NotFoundException("Terapist profili bulunamadı.");
    }

    return profile;
  }

  async reviewTherapist(therapistId: string, input: z.infer<typeof reviewSchema>) {
    if (input.status === "REJECTED" && !input.rejectionReason) {
      throw new BadRequestException("Terapist reddedilirken ret sebebi zorunludur.");
    }

    return this.prisma.therapistProfile.update({
      where: { id: therapistId },
      data: {
        status: input.status,
        rejectionReason: input.status === "REJECTED" ? input.rejectionReason : null,
        reviewedAt: new Date()
      },
      include: { documents: true, user: { select: { email: true, name: true } } }
    });
  }
}

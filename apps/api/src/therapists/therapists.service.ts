import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DocumentType, PackageMode, Role, TherapistStatus } from "@fizioterapi/db";
import { z } from "zod";
import { PrismaService } from "../prisma.service";
import { StorageService, UploadableFile } from "../storage/storage.service";

export const profileSchema = z.object({
  fullName: z.string().min(2).max(160),
  bio: z.string().max(2000).optional().nullable()
});

export const specialtySchema = z.object({
  treatmentTypeIds: z.array(z.string().min(1)).min(1)
});

export const packageSchema = z.object({
  name: z.string().min(2).max(160),
  sessionCount: z.coerce.number().int().positive(),
  price: z.coerce.number().positive(),
  mode: z.nativeEnum(PackageMode),
  treatmentTypeId: z.string().min(1)
});

@Injectable()
export class TherapistsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService
  ) {}

  listTreatmentTypes() {
    return this.prisma.treatmentType.findMany({ orderBy: { name: "asc" } });
  }

  discover() {
    return this.prisma.therapistProfile.findMany({
      where: { status: TherapistStatus.APPROVED },
      include: {
        specialties: { include: { treatmentType: true } },
        packages: { include: { treatmentType: true } }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async getMe(userId: string) {
    return this.getOrCreateProfile(userId);
  }

  async updateProfile(userId: string, input: z.infer<typeof profileSchema>) {
    const profile = await this.getOrCreateProfile(userId);
    return this.prisma.therapistProfile.update({
      where: { id: profile.id },
      data: {
        fullName: input.fullName,
        bio: input.bio ?? null
      }
    });
  }

  async uploadDocument(userId: string, type: DocumentType, file: UploadableFile | undefined) {
    if (!file) {
      throw new BadRequestException("Dosya zorunludur");
    }

    if (!Object.values(DocumentType).includes(type)) {
      throw new BadRequestException("Belge türü DIPLOMA veya LICENSE olmalıdır");
    }

    const profile = await this.getOrCreateProfile(userId);
    const stored = await this.storage.save(file, "therapists/" + profile.id);

    return this.prisma.therapistDocument.create({
      data: {
        therapistProfileId: profile.id,
        type,
        fileUrl: stored.fileUrl,
        originalName: stored.originalName,
        mimeType: stored.mimeType
      }
    });
  }

  async setSpecialties(userId: string, treatmentTypeIds: string[]) {
    const profile = await this.requireApprovedProfile(userId);
    const uniqueIds = [...new Set(treatmentTypeIds)];
    const existingCount = await this.prisma.treatmentType.count({
      where: { id: { in: uniqueIds } }
    });

    if (existingCount !== uniqueIds.length) {
      throw new BadRequestException("Bilinmeyen tedavi türü seçildi.");
    }

    await this.prisma.therapistSpecialty.deleteMany({ where: { therapistProfileId: profile.id } });
    await this.prisma.therapistSpecialty.createMany({
      data: uniqueIds.map((treatmentTypeId) => ({
        therapistProfileId: profile.id,
        treatmentTypeId
      }))
    });

    return this.getOrCreateProfile(userId);
  }

  async listPackages(userId: string) {
    const profile = await this.getProfileOrThrow(userId);
    return this.prisma.therapistPackage.findMany({
      where: { therapistProfileId: profile.id },
      include: { treatmentType: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async createPackage(userId: string, input: z.infer<typeof packageSchema>) {
    const profile = await this.requireApprovedProfile(userId);
    await this.ensureTreatmentTypeExists(input.treatmentTypeId);

    return this.prisma.therapistPackage.create({
      data: {
        therapistProfileId: profile.id,
        treatmentTypeId: input.treatmentTypeId,
        name: input.name,
        sessionCount: input.sessionCount,
        price: input.price,
        mode: input.mode
      },
      include: { treatmentType: true }
    });
  }

  async updatePackage(userId: string, packageId: string, input: z.infer<typeof packageSchema>) {
    const profile = await this.requireApprovedProfile(userId);
    await this.ensureTreatmentTypeExists(input.treatmentTypeId);
    await this.ensureOwnPackage(profile.id, packageId);

    return this.prisma.therapistPackage.update({
      where: { id: packageId },
      data: input,
      include: { treatmentType: true }
    });
  }

  async deletePackage(userId: string, packageId: string) {
    const profile = await this.requireApprovedProfile(userId);
    await this.ensureOwnPackage(profile.id, packageId);
    await this.prisma.therapistPackage.delete({ where: { id: packageId } });
    return { ok: true };
  }

  private async getOrCreateProfile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.role !== Role.THERAPIST) {
      throw new ForbiddenException("Terapist profillerini yalnızca fizyoterapistler yönetebilir.");
    }

    return this.prisma.therapistProfile.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        fullName: user.name,
        status: TherapistStatus.PENDING
      },
      include: {
        documents: true,
        specialties: { include: { treatmentType: true } },
        packages: { include: { treatmentType: true } }
      }
    });
  }

  private async getProfileOrThrow(userId: string) {
    const profile = await this.prisma.therapistProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException("Terapist profili bulunamadı.");
    }
    return profile;
  }

  private async requireApprovedProfile(userId: string) {
    const profile = await this.getProfileOrThrow(userId);
    if (profile.status !== TherapistStatus.APPROVED) {
      throw new ForbiddenException("Uzmanlık ve paket yönetimi için terapist onayı gerekir.");
    }
    return profile;
  }

  private async ensureTreatmentTypeExists(treatmentTypeId: string) {
    const treatmentType = await this.prisma.treatmentType.findUnique({ where: { id: treatmentTypeId } });
    if (!treatmentType) {
      throw new BadRequestException("Bilinmeyen tedavi türü seçildi.");
    }
  }

  private async ensureOwnPackage(therapistProfileId: string, packageId: string) {
    const found = await this.prisma.therapistPackage.findFirst({
      where: { id: packageId, therapistProfileId }
    });
    if (!found) {
      throw new NotFoundException("Paket bulunamadı.");
    }
  }
}

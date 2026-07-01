import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PackageMode, Prisma, TherapistStatus } from "@fizioterapi/db";
import { z } from "zod";
import { PrismaService } from "../prisma.service";

export const reviewInputSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
  authorName: z.string().max(120).optional()
});

export const searchSchema = z.object({
  treatmentType: z.string().optional(),
  mode: z.nativeEnum(PackageMode).optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional()
});

type SearchInput = z.infer<typeof searchSchema>;

type SearchableTherapist = {
  id: string;
  fullName: string;
  bio: string | null;
  city: string | null;
  averageRating: number;
  reviewCount: number;
  specialties: unknown[];
  packages: unknown[];
};

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  async searchTherapists(input: SearchInput): Promise<SearchableTherapist[]> {
    const packageWhere: Prisma.TherapistPackageWhereInput = {};
    if (input.mode) {
      packageWhere.mode = input.mode === PackageMode.BOTH ? PackageMode.BOTH : { in: [input.mode, PackageMode.BOTH] };
    }
    if (input.minPrice !== undefined || input.maxPrice !== undefined) {
      packageWhere.price = {
        gte: input.minPrice,
        lte: input.maxPrice
      };
    }
    if (input.treatmentType) {
      packageWhere.treatmentType = {
        OR: [{ id: input.treatmentType }, { slug: input.treatmentType }]
      };
    }

    const where: Prisma.TherapistProfileWhereInput = {
      status: TherapistStatus.APPROVED,
      ...(Object.keys(packageWhere).length ? { packages: { some: packageWhere } } : {}),
      ...(input.treatmentType ? {
        specialties: {
          some: { treatmentType: { OR: [{ id: input.treatmentType }, { slug: input.treatmentType }] } }
        }
      } : {})
    };

    const therapists = await this.prisma.therapistProfile.findMany({
      where,
      include: {
        specialties: { include: { treatmentType: true } },
        packages: { include: { treatmentType: true }, where: packageWhere },
        reviews: true
      }
    });

    return therapists
      .map((therapist) => this.withRating(therapist))
      .sort((a, b) => b.averageRating - a.averageRating || b.reviewCount - a.reviewCount);
  }

  async getTherapistDetail(therapistId: string) {
    const therapist = await this.prisma.therapistProfile.findFirst({
      where: { id: therapistId, status: TherapistStatus.APPROVED },
      include: {
        specialties: { include: { treatmentType: true } },
        packages: { include: { treatmentType: true }, orderBy: { price: "asc" } },
        reviews: { orderBy: { createdAt: "desc" } },
        documents: { orderBy: { createdAt: "desc" } }
      }
    });

    if (!therapist) {
      throw new NotFoundException("Onaylı terapist bulunamadı.");
    }

    return this.withRating(therapist);
  }


  async createReview(therapistId: string, input: z.infer<typeof reviewInputSchema>, patientName?: string) {
    const therapist = await this.prisma.therapistProfile.findFirst({ where: { id: therapistId, status: TherapistStatus.APPROVED } });
    if (!therapist) {
      throw new NotFoundException("Onaylı terapist bulunamadı.");
    }
    if (input.rating < 1 || input.rating > 5) {
      throw new BadRequestException("Puan 1 ile 5 arasında olmalıdır.");
    }
    return this.prisma.therapistReview.create({
      data: {
        therapistProfileId: therapistId,
        rating: input.rating,
        comment: input.comment,
        authorName: input.authorName ?? patientName
      }
    });
  }


  private withRating<T extends { reviews: { rating: number }[] }>(therapist: T): T & { averageRating: number; reviewCount: number } {
    const reviewCount = therapist.reviews.length;
    const averageRating = reviewCount
      ? Number((therapist.reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount).toFixed(2))
      : 0;

    return { ...therapist, averageRating, reviewCount };
  }
}

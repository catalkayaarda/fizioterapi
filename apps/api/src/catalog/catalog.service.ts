import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listTreatmentTypes() {
    return this.prisma.treatmentType.findMany({
      select: { id: true, slug: true, name: true, description: true },
      orderBy: { name: "asc" }
    });
  }
}

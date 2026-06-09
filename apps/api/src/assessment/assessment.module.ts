import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { MarketplaceModule } from "../marketplace/marketplace.module";
import { AssessmentController } from "./assessment.controller";
import { AssessmentService } from "./assessment.service";

@Module({
  imports: [MarketplaceModule],
  controllers: [AssessmentController],
  providers: [PrismaService, AssessmentService]
})
export class AssessmentModule {}

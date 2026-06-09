import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { StorageModule } from "../storage/storage.module";
import { TherapistsController } from "./therapists.controller";
import { TherapistsService } from "./therapists.service";

@Module({
  imports: [StorageModule],
  controllers: [TherapistsController],
  providers: [PrismaService, TherapistsService],
  exports: [TherapistsService]
})
export class TherapistsModule {}

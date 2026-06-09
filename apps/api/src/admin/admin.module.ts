import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { PaymentsModule } from "../payments/payments.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [PaymentsModule],
  controllers: [AdminController],
  providers: [PrismaService, AdminService]
})
export class AdminModule {}

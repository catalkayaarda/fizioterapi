import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { PaymentsModule } from "../payments/payments.module";
import { LoyaltyModule } from "../loyalty/loyalty.module";
import { AppointmentsController } from "./appointments.controller";
import { AppointmentsService } from "./appointments.service";

@Module({
  imports: [PaymentsModule, LoyaltyModule],
  controllers: [AppointmentsController],
  providers: [PrismaService, AppointmentsService]
})
export class AppointmentsModule {}

import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { IyzicoService } from "./iyzico.service";
import { LoyaltyModule } from "../loyalty/loyalty.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [LoyaltyModule],
  controllers: [PaymentsController],
  providers: [PrismaService, IyzicoService, PaymentsService],
  exports: [PaymentsService, IyzicoService]
})
export class PaymentsModule {}

import { Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { MessagingController } from "./messaging.controller";
import { MessagingService } from "./messaging.service";

@Module({
  controllers: [MessagingController],
  providers: [PrismaService, MessagingService]
})
export class MessagingModule {}

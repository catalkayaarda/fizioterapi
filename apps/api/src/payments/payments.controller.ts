import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { PaymentsService, webhookSchema } from "./payments.service";
import { Role } from "@fizioterapi/db";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get("mobile-checkout/:appointmentId")
  @Roles(Role.PATIENT, Role.THERAPIST)
  @UseGuards(JwtAuthGuard, RolesGuard)
  getMobileCheckout(@Param("appointmentId") appointmentId: string) {
    return this.paymentsService.getMobileCheckout(appointmentId);
  }

  @Post("iyzico/webhook")
  handleIyzicoWebhook(@Body() body: unknown) {
    return this.paymentsService.handleWebhook(webhookSchema.parse(body));
  }
}

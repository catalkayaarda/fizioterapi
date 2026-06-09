import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { Role } from "@fizioterapi/db";
import { JwtPayload } from "@fizioterapi/types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AppointmentsService, cancelAppointmentSchema, confirmAppointmentSchema, createAppointmentSchema } from "./appointments.service";

type RequestWithUser = { user: JwtPayload };

@Controller("appointments")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get("mine")
  @Roles(Role.PATIENT, Role.THERAPIST, Role.ADMIN)
  listMine(@Req() request: RequestWithUser) {
    return this.appointmentsService.listForUser(request.user.sub);
  }

  @Get("incoming")
  @Roles(Role.THERAPIST)
  listIncoming(@Req() request: RequestWithUser) {
    return this.appointmentsService.listIncomingRequests(request.user.sub);
  }

  @Post("requests")
  @Roles(Role.PATIENT)
  createRequest(@Req() request: RequestWithUser, @Body() body: unknown) {
    return this.appointmentsService.createRequest(request.user.sub, createAppointmentSchema.parse(body));
  }

  @Patch(":appointmentId/confirm")
  @Roles(Role.THERAPIST)
  confirm(@Req() request: RequestWithUser, @Param("appointmentId") appointmentId: string, @Body() body: unknown) {
    return this.appointmentsService.confirm(request.user.sub, appointmentId, confirmAppointmentSchema.parse(body));
  }

  @Patch(":appointmentId/complete")
  @Roles(Role.THERAPIST, Role.ADMIN)
  complete(@Req() request: RequestWithUser, @Param("appointmentId") appointmentId: string) {
    return this.appointmentsService.complete(request.user.sub, appointmentId);
  }

  @Patch(":appointmentId/cancel/patient")
  @Roles(Role.PATIENT)
  cancelByPatient(@Req() request: RequestWithUser, @Param("appointmentId") appointmentId: string, @Body() body: unknown) {
    const input = cancelAppointmentSchema.parse(body ?? {});
    return this.appointmentsService.cancelByPatient(request.user.sub, appointmentId, input.reason);
  }

  @Patch(":appointmentId/cancel/therapist")
  @Roles(Role.THERAPIST)
  cancelByTherapist(@Req() request: RequestWithUser, @Param("appointmentId") appointmentId: string, @Body() body: unknown) {
    const input = cancelAppointmentSchema.parse(body ?? {});
    return this.appointmentsService.cancelByTherapist(request.user.sub, appointmentId, input.reason);
  }

  @Post("expire-now")
  @Roles(Role.ADMIN)
  expireNow() {
    return this.appointmentsService.expireNow();
  }
}

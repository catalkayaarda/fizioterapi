import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { Role } from "@fizioterapi/db";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AdminService, reviewSchema } from "./admin.service";

@Controller("admin")
@Roles(Role.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("therapists/pending")
  listPendingTherapists() {
    return this.adminService.listPendingTherapists();
  }

  @Get("therapists/:therapistId/documents")
  listDocuments(@Param("therapistId") therapistId: string) {
    return this.adminService.listDocuments(therapistId);
  }

  @Patch("therapists/:therapistId/review")
  reviewTherapist(@Param("therapistId") therapistId: string, @Body() body: unknown) {
    return this.adminService.reviewTherapist(therapistId, reviewSchema.parse(body));
  }
}

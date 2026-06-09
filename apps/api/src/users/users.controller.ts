import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { Role } from "@fizioterapi/db";
import { PrismaService } from "../prisma.service";
import { JwtPayload } from "@fizioterapi/types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

type RequestWithUser = {
  user: JwtPayload;
};

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}
  @Get("me")
  me(@Req() request: RequestWithUser) {
    return request.user;
  }

  @Get("loyalty")
  async loyalty(@Req() request: RequestWithUser) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: request.user.sub },
      select: { id: true, email: true, name: true, role: true, loyaltyTier: true, completedAppointments: true, cancellationCredits: true, therapistProfile: { select: { id: true, loyaltyTier: true, completedAppointments: true, commissionRate: true, tier: true, penaltyCount: true } } }
    });
    return user;
  }

  @Get("admin-only")
  @Roles(Role.ADMIN)
  adminOnly() {
    return { ok: true, scope: "admin" };
  }
}

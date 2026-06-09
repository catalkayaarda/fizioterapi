import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { MarketplaceService, reviewInputSchema, searchSchema } from "./marketplace.service";
import { Role } from "@fizioterapi/db";
import { JwtPayload } from "@fizioterapi/types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

type RequestWithUser = { user: JwtPayload };

@Controller("marketplace")
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get("therapists")
  searchTherapists(@Query() query: unknown) {
    return this.marketplaceService.searchTherapists(searchSchema.parse(query));
  }

  @Get("therapists/:therapistId")
  getTherapistDetail(@Param("therapistId") therapistId: string) {
    return this.marketplaceService.getTherapistDetail(therapistId);
  }

  @Post("therapists/:therapistId/reviews")
  @Roles(Role.PATIENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  createReview(@Req() request: RequestWithUser, @Param("therapistId") therapistId: string, @Body() body: unknown) {
    return this.marketplaceService.createReview(therapistId, reviewInputSchema.parse(body), request.user.email);
  }
}

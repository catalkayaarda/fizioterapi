import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { DocumentType, Role } from "@fizioterapi/db";
import { JwtPayload } from "@fizioterapi/types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { UploadableFile } from "../storage/storage.service";
import { packageSchema, profileSchema, specialtySchema, TherapistsService } from "./therapists.service";

type RequestWithUser = { user: JwtPayload };

@Controller("therapists")
export class TherapistsController {
  constructor(private readonly therapistsService: TherapistsService) {}

  @Get("treatment-types")
  listTreatmentTypes() {
    return this.therapistsService.listTreatmentTypes();
  }

  @Get("discover")
  discover() {
    return this.therapistsService.discover();
  }

  @Get("me")
  @Roles(Role.THERAPIST)
  @UseGuards(JwtAuthGuard, RolesGuard)
  me(@Req() request: RequestWithUser) {
    return this.therapistsService.getMe(request.user.sub);
  }

  @Patch("me")
  @Roles(Role.THERAPIST)
  @UseGuards(JwtAuthGuard, RolesGuard)
  updateProfile(@Req() request: RequestWithUser, @Body() body: unknown) {
    return this.therapistsService.updateProfile(request.user.sub, profileSchema.parse(body));
  }

  @Post("me/documents")
  @Roles(Role.THERAPIST)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(FileInterceptor("file"))
  uploadDocument(@Req() request: RequestWithUser, @Body("type") type: DocumentType, @UploadedFile() file?: UploadableFile) {
    return this.therapistsService.uploadDocument(request.user.sub, type, file);
  }

  @Patch("me/specialties")
  @Roles(Role.THERAPIST)
  @UseGuards(JwtAuthGuard, RolesGuard)
  setSpecialties(@Req() request: RequestWithUser, @Body() body: unknown) {
    const input = specialtySchema.parse(body);
    return this.therapistsService.setSpecialties(request.user.sub, input.treatmentTypeIds);
  }

  @Get("me/packages")
  @Roles(Role.THERAPIST)
  @UseGuards(JwtAuthGuard, RolesGuard)
  listPackages(@Req() request: RequestWithUser) {
    return this.therapistsService.listPackages(request.user.sub);
  }

  @Post("me/packages")
  @Roles(Role.THERAPIST)
  @UseGuards(JwtAuthGuard, RolesGuard)
  createPackage(@Req() request: RequestWithUser, @Body() body: unknown) {
    return this.therapistsService.createPackage(request.user.sub, packageSchema.parse(body));
  }

  @Patch("me/packages/:packageId")
  @Roles(Role.THERAPIST)
  @UseGuards(JwtAuthGuard, RolesGuard)
  updatePackage(@Req() request: RequestWithUser, @Param("packageId") packageId: string, @Body() body: unknown) {
    return this.therapistsService.updatePackage(request.user.sub, packageId, packageSchema.parse(body));
  }

  @Delete("me/packages/:packageId")
  @Roles(Role.THERAPIST)
  @UseGuards(JwtAuthGuard, RolesGuard)
  deletePackage(@Req() request: RequestWithUser, @Param("packageId") packageId: string) {
    return this.therapistsService.deletePackage(request.user.sub, packageId);
  }
}

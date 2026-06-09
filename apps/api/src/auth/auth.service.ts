import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcrypt";
import { Role, TherapistStatus } from "@fizioterapi/db";
import { LoginInput, RegisterInput } from "@fizioterapi/types";
import { PrismaService } from "../prisma.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async register(input: RegisterInput) {
    if (input.role === Role.ADMIN) {
      throw new BadRequestException("Yönetici kullanıcılar seed komutuyla veya mevcut bir yönetici tarafından oluşturulmalıdır.");
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email }
    });

    if (existingUser) {
      throw new ConflictException("Bu e-posta adresi zaten kayıtlı.");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name,
        role: input.role,
        therapistProfile: input.role === Role.THERAPIST ? {
          create: {
            fullName: input.name,
            status: TherapistStatus.PENDING
          }
        } : undefined
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });

    return {
      user,
      accessToken: await this.signToken(user)
    };
  }

  async login(input: LoginInput) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email }
    });

    if (!user) {
      throw new UnauthorizedException("E-posta veya şifre hatalı.");
    }

    const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException("E-posta veya şifre hatalı.");
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };

    return {
      user: safeUser,
      accessToken: await this.signToken(safeUser)
    };
  }

  private signToken(user: { id: string; email: string; role: Role }) {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role
    });
  }
}

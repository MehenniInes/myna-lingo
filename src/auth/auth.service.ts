import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { UsersService } from "../users/users.service.js";
import { CreateUserDto } from "../users/dto/create-user.dto.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { MailService } from "../mail/mail.service.js";

const FORGOT_PASSWORD_GENERIC =
  "If this email exists, we sent a reset link";
const RESET_PASSWORD_GENERIC_ERROR = "Invalid or expired reset token";

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  async register(dto: CreateUserDto, signupIp?: string) {
    return this.usersService.create({ ...dto, signupIp });
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    // Always return the same response so callers can't probe which emails exist.
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return { message: FORGOT_PASSWORD_GENERIC };
    }

    // One active token per user: drop older, still-unused ones.
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    // MailService logs the link in dev mode (no SMTP) and sends via SMTP otherwise.
    await this.mailService.sendPasswordResetEmail(user.email, resetUrl);

    return { message: FORGOT_PASSWORD_GENERIC };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    // Missing, expired, and already-used all resolve to the same generic error.
    if (!record || record.usedAt !== null || record.expiresAt < new Date()) {
      throw new BadRequestException(RESET_PASSWORD_GENERIC_ERROR);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.deleteMany({
        where: { userId: record.userId, id: { not: record.id } },
      }),
    ]);

    return { message: "Password reset successfully" };
  }
}
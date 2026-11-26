import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { JwtStrategy } from "./jwt.strategy.js";
import { RolesGuard } from "./roles.guard.js";
import { UsersModule } from "../users/users.module.js";
import { MailService } from "../mail/mail.service.js";

@Module({
  imports: [
    UsersModule,
    PassportModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }]),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: "7d" },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RolesGuard, MailService],
  exports: [RolesGuard],
})
export class AuthModule {}
import { IsString, Length, MinLength, MaxLength } from "class-validator";

export class ResetPasswordDto {
  @IsString()
  @Length(64, 64, { message: "Invalid reset token" })
  token!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  newPassword!: string;
}
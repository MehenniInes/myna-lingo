import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class AboutDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  countryOfBirth: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsBoolean()
  confirmedOver18: boolean;
}
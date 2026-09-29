import { IsString, IsOptional, IsInt } from 'class-validator';

export class CertificateDto {
  @IsString()
  teacherLanguageId: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  issuedBy?: string;

  @IsOptional()
  @IsInt()
  yearsOfStudy?: number;

  @IsString()
  fileUrl: string;
}
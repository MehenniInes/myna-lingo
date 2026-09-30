import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CertificateDto {
  @IsString()
  teacherLanguageId: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  issuedBy: string;

  @IsInt()
  @Min(1950)
  @Max(2100)
  yearFrom: number;

  @IsInt()
  @Min(1950)
  @Max(2100)
  yearTo: number;

  @IsString()
  fileUrl: string;
}
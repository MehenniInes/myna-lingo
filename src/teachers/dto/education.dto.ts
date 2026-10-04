import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

export class EducationDto {
  @IsString()
  university: string;

  @IsString()
  degree: string;

  @IsOptional()
  @IsString()
  degreeType?: string;

  @IsOptional()
  @IsString()
  specialization?: string;

  @IsInt()
  @Min(1950)
  @Max(2100)
  yearFrom: number;

  @IsInt()
  @Min(1950)
  @Max(2100)
  yearTo: number;

  @IsOptional()
  @IsString()
  diplomaUrl?: string;
}
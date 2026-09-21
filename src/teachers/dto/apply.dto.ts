import { IsString, IsOptional, IsInt, IsArray, ValidateNested, IsIn, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';

class LanguageEntryDto {
  @IsString()
  languageId: string;

  @IsIn(['CONVERSATION_PARTNER', 'PROFESSIONAL_TEACHER'])
  serviceType: 'CONVERSATION_PARTNER' | 'PROFESSIONAL_TEACHER';
}

export class ApplyDto {
  @IsString()
  bio: string;

  @IsInt()
  experienceYears: number;

  @IsOptional()
  @IsUrl()
  introVideoUrl?: string;

  @IsOptional()
  @IsUrl()
  profilePhotoUrl?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LanguageEntryDto)
  languages: LanguageEntryDto[];

  @IsArray()
  @IsUrl({}, { each: true })
  certificateUrls: string[];
}
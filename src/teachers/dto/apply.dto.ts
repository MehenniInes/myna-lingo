import { IsString, IsOptional, IsInt, IsArray, ValidateNested, IsIn, IsUrl, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

class LanguageEntryDto {
  @IsString()
  languageId: string;

  @IsIn(['CONVERSATION_PARTNER', 'PROFESSIONAL_TEACHER'])
  serviceType: 'CONVERSATION_PARTNER' | 'PROFESSIONAL_TEACHER';

   @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  certificateUrls: string[];
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

  @IsString()
  idDocumentUrl: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LanguageEntryDto)
  languages: LanguageEntryDto[];}
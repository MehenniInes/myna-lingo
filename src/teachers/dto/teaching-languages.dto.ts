import { IsArray, ValidateNested, ArrayMinSize, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

class TeachingLanguageEntryDto {
  @IsString()
  languageId: string;

  @IsIn(['CONVERSATION_PARTNER', 'PROFESSIONAL_TEACHER'])
  serviceType: 'CONVERSATION_PARTNER' | 'PROFESSIONAL_TEACHER';
}

export class TeachingLanguagesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TeachingLanguageEntryDto)
  languages: TeachingLanguageEntryDto[];
}
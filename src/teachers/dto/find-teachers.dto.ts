import { IsOptional, IsString, IsBoolean, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export class FindTeachersDto {
  @IsOptional()
  @IsString()
  languageId?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  online?: boolean;

  @IsOptional()
  @IsIn(['CONVERSATION_PARTNER', 'PROFESSIONAL_TEACHER'])
  serviceType?: 'CONVERSATION_PARTNER' | 'PROFESSIONAL_TEACHER';
}
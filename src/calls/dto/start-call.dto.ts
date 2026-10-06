import { IsString, IsOptional, IsIn } from 'class-validator';

export class StartCallDto {
  @IsString()
  teacherId: string;

  @IsOptional()
  @IsIn(['CONVERSATION_PARTNER', 'PROFESSIONAL_TEACHER'])
  serviceType?: 'CONVERSATION_PARTNER' | 'PROFESSIONAL_TEACHER';
}

export class EndCallDto {
  @IsOptional()
  @IsString()
  callId?: string;
}
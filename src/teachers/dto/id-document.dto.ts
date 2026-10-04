import { IsString } from 'class-validator';

export class IdDocumentDto {
  @IsString()
  idDocumentUrl: string;
}
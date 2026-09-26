import { IsArray, ValidateNested, ArrayMinSize, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

class SpokenLanguageEntryDto {
  @IsString()
  languageId: string;

  @IsIn(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'NATIVE'])
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'NATIVE';
}

export class SpokenLanguagesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SpokenLanguageEntryDto)
  languages: SpokenLanguageEntryDto[];
}
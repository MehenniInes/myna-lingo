import { IsString, MinLength } from 'class-validator';

export class DescriptionDto {
  @IsString()
  @MinLength(20)
  description: string;
}
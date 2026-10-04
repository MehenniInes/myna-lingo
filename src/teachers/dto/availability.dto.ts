import { IsArray, ValidateNested, IsIn, IsString, Matches } from 'class-validator';
import { Type } from 'class-transformer';

class SlotDto {
  @IsIn(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])
  day: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'startTime must be HH:mm' })
  startTime: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'endTime must be HH:mm' })
  endTime: string;
}

export class AvailabilityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SlotDto)
  slots: SlotDto[];
}
import { IsInt, Min } from 'class-validator';

export class PricingDto {
  @IsInt()
  @Min(1)
  requestedHourlyRateDA: number;
}
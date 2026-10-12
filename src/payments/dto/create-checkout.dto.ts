import { IsString, IsIn } from 'class-validator';

export class CreatePackageCheckoutDto {
  @IsString()
  packageId: string;
}
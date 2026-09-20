import { IsEmail, IsString, MinLength, IsIn } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  fullName: string;

  @IsIn(['STUDENT', 'PARENT', 'TEACHER', 'ADMIN'])
  role: 'STUDENT' | 'PARENT' | 'TEACHER' | 'ADMIN';
}
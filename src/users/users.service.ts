import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    email: string;
    password: string;
    fullName: string;
    role: 'STUDENT' | 'PARENT' | 'TEACHER' | 'ADMIN';
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    // نستعملو transaction باش نضمنو أن User + Profile يتخلقو بجوج ولا ما يتخلقش حتى واحد
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          fullName: data.fullName,
          role: data.role,
        },
      });

      // نصنعو الـ Profile المناسب حسب الـ Role
      if (data.role === 'STUDENT') {
        await tx.studentProfile.create({
          data: { userId: newUser.id },
        });
      } else if (data.role === 'PARENT') {
        await tx.parentProfile.create({
          data: { userId: newUser.id },
        });
      } else if (data.role === 'TEACHER') {
        await tx.teacherProfile.create({
          data: { userId: newUser.id },
        });
      }

      return newUser;
    });

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }
}
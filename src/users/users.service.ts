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

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        fullName: data.fullName,
        role: data.role,
      },
    });

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }
}
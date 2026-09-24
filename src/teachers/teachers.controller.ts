import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { TeachersService } from './teachers.service.js';
import { ApplyDto } from './dto/apply.dto.js';
import { ReviewDto } from './dto/review.dto.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';

@Controller('teachers')
export class TeachersController {
  constructor(private teachersService: TeachersService) {}

  @Post('apply')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('TEACHER')
  async apply(@Req() req: any, @Body() dto: ApplyDto) {
    return this.teachersService.apply(req.user.userId, dto);
  }

  @Get('applications/pending')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  async listPending() {
    return this.teachersService.listPendingApplications();
  }

  @Patch('applications/:id/review')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  async review(@Req() req: any, @Param('id') id: string, @Body() dto: ReviewDto) {
    return this.teachersService.reviewApplication(id, req.user.userId, dto.decision, dto.note);
  }

  @Post('upload/certificate')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('TEACHER')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/certificates',
        filename: (req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, unique + extname(file.originalname));
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          return cb(new BadRequestException('Only PDF files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadCertificate(@UploadedFile() file: Express.Multer.File) {
    return { url: `/uploads/certificates/${file.filename}` };
  }

  @Post('upload/id-document')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('TEACHER')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/id-documents',
        filename: (req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, unique + extname(file.originalname));
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
          return cb(new BadRequestException('Only JPEG, PNG, or WEBP images are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadIdDocument(@UploadedFile() file: Express.Multer.File) {
    return { url: `/uploads/id-documents/${file.filename}` };
  }
}
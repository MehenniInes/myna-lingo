import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { TeachersService } from './teachers.service.js';
import { ApplyDto } from './dto/apply.dto.js';
import { ReviewDto } from './dto/review.dto.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { AboutDto } from './dto/about.dto.js';
import { SpokenLanguagesDto } from './dto/spoken-languages.dto.js';
import { ProfilePhotoDto } from './dto/profile-photo.dto.js';
import { CertificateDto } from './dto/certificate.dto.js';
import { TeachingLanguagesDto } from './dto/teaching-languages.dto.js';
import { HasTeacherProfileGuard } from './has-teacher-profile.guard.js';
import { IdDocumentDto } from './dto/id-document.dto.js';
import { EducationDto } from './dto/education.dto.js';
import { DescriptionDto } from './dto/description.dto.js';
import { AvailabilityDto } from './dto/availability.dto.js';
import { PricingDto } from './dto/pricing.dto.js';
import { FindTeachersDto } from './dto/find-teachers.dto.js';
import { SetOnlineDto } from './dto/set-online.dto.js';

@Controller('teachers')
export class TeachersController {
  constructor(private teachersService: TeachersService) {}

  @Post('apply')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async apply(@Req() req: any, @Body() dto: ApplyDto) {
    return this.teachersService.apply(req.user.userId, dto);
  }

  @Get('applications/pending')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  @Roles('ADMIN')
  async listPending() {
    return this.teachersService.listPendingApplications();
  }

  @Patch('applications/:id/review')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  @Roles('ADMIN')
  async review(@Req() req: any, @Param('id') id: string, @Body() dto: ReviewDto) {
    return this.teachersService.reviewApplication(id, req.user.userId, dto.decision, dto.note);
  }

  @Post('upload/certificate')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
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
    return { url: `${process.env.BACKEND_URL || 'http://localhost:4000'}/uploads/certificates/${file.filename}` };
  }

  @Post('upload/id-document')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
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
    return { url: `${process.env.BACKEND_URL || 'http://localhost:4000'}/uploads/id-documents/${file.filename}` };
  }

  @Get('draft')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async getDraft(@Req() req: any) {
    return this.teachersService.getOrCreateDraft(req.user.userId);
  }

  @Patch('draft/about')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async updateAbout(@Req() req: any, @Body() dto: AboutDto) {
    return this.teachersService.updateAbout(req.user.userId, dto);
  }

  @Patch('draft/spoken-languages')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async updateSpokenLanguages(@Req() req: any, @Body() dto: SpokenLanguagesDto) {
    return this.teachersService.updateSpokenLanguages(req.user.userId, dto.languages);
  }

  @Post('upload/profile-photo')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/profile-photos',
        filename: (req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, unique + extname(file.originalname));
        },
      }),
      limits: { fileSize: 20 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
          return cb(new BadRequestException('Only JPEG or PNG images are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadProfilePhoto(@UploadedFile() file: Express.Multer.File) {
    return { url: `${process.env.BACKEND_URL || 'http://localhost:4000'}/uploads/profile-photos/${file.filename}` };
  }

  @Patch('draft/profile-photo')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async updateProfilePhoto(@Req() req: any, @Body() dto: ProfilePhotoDto) {
    return this.teachersService.updateProfilePhoto(req.user.userId, dto.profilePhotoUrl);
  }

  @Post('draft/certificate')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async addCertificate(@Req() req: any, @Body() dto: CertificateDto) {
    return this.teachersService.addCertificate(req.user.userId, dto);
  }

  @Patch('draft/teaching-languages')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async updateTeachingLanguages(@Req() req: any, @Body() dto: TeachingLanguagesDto) {
    return this.teachersService.updateTeachingLanguages(req.user.userId, dto.languages);
  }

  @Post('become')
  @UseGuards(AuthGuard('jwt'))
  async becomeTeacher(@Req() req: any) {
    return this.teachersService.becomeTeacher(req.user.userId);
  }

  @Post('draft/submit')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async submitApplication(@Req() req: any) {
    return this.teachersService.submitApplication(req.user.userId);
  }

  @Patch('draft/id-document')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async updateIdDocument(@Req() req: any, @Body() dto: IdDocumentDto) {
    return this.teachersService.updateIdDocument(req.user.userId, dto.idDocumentUrl);
  }

  @Get('online')
  getOnlineTeachers() {
    return this.teachersService.getOnlineTeachers();
  }
    @Post('draft/education')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async addEducation(@Req() req: any, @Body() dto: EducationDto) {
    return this.teachersService.addEducation(req.user.userId, dto);
  }

  @Patch('draft/description')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async updateDescription(@Req() req: any, @Body() dto: DescriptionDto) {
    return this.teachersService.updateDescription(req.user.userId, dto.description);
  }

  @Patch('draft/availability')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async updateAvailability(@Req() req: any, @Body() dto: AvailabilityDto) {
    return this.teachersService.updateAvailability(req.user.userId, dto.slots);
  }

  @Patch('draft/pricing')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async updatePricing(@Req() req: any, @Body() dto: PricingDto) {
    return this.teachersService.updatePricing(req.user.userId, dto.requestedHourlyRateDA);
  }

  @Post('upload/diploma')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/diplomas',
        filename: (req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, unique + extname(file.originalname));
        },
      }),
      limits: { fileSize: 20 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
          return cb(new BadRequestException('Only JPEG or PNG images are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadDiploma(@UploadedFile() file: Express.Multer.File) {
    return { url: `${process.env.BACKEND_URL || 'http://localhost:4000'}/uploads/diplomas/${file.filename}` };
  }
    @Get()
  findAll(@Query() query: FindTeachersDto) {
    return this.teachersService.findPublicTeachers(query);
  }

  @Patch('me/online')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async setOnline(@Req() req: any, @Body() dto: SetOnlineDto) {
    return this.teachersService.setOnline(req.user.userId, dto.isOnline);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.teachersService.getPublicProfile(id);
  }
    @Get('me')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async getMe(@Req() req: any) {
    return this.teachersService.getMyProfile(req.user.userId);
  }

  @Get('me/dashboard')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async getDashboard(@Req() req: any) {
    return this.teachersService.getDashboard(req.user.userId);
  }
}
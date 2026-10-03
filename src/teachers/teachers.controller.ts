import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

import { TeachersService } from './teachers.service.js';

import { ApplyDto } from './dto/apply.dto.js';
import { ReviewDto } from './dto/review.dto.js';
import { AboutDto } from './dto/about.dto.js';
import { SpokenLanguagesDto } from './dto/spoken-languages.dto.js';
import { ProfilePhotoDto } from './dto/profile-photo.dto.js';
import { CertificateDto } from './dto/certificate.dto.js';
import { TeachingLanguagesDto } from './dto/teaching-languages.dto.js';
import { IdDocumentDto } from './dto/id-document.dto.js';
import { EducationDto } from './dto/education.dto.js';
import { DescriptionDto } from './dto/description.dto.js';
import { AvailabilityDto } from './dto/availability.dto.js';
import { PricingDto } from './dto/pricing.dto.js';
import { FindTeachersDto } from './dto/find-teachers.dto.js';
import { SetOnlineDto } from './dto/set-online.dto.js';

import { HasTeacherProfileGuard } from './has-teacher-profile.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';

@Controller('teachers')
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  // =========================================================
  // TEACHER APPLICATION
  // =========================================================

  @Post('apply')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async apply(@Req() req: any, @Body() dto: ApplyDto) {
    return this.teachersService.apply(req.user.userId, dto);
  }

  // =========================================================
  // ADMIN APPLICATIONS
  // =========================================================

  @Get('applications/pending')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  async listPending() {
    return this.teachersService.listPendingApplications();
  }

  @Patch('applications/:id/review')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  async review(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: ReviewDto,
  ) {
    return this.teachersService.reviewApplication(
      id,
      req.user.userId,
      dto.decision,
      dto.note,
    );
  }

  // =========================================================
  // CERTIFICATE UPLOAD
  // PDF ONLY - MAX 10 MB
  // =========================================================

  @Post('upload/certificate')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/certificates',
        filename: (req, file, cb) => {
          const unique =
            Date.now() + '-' + Math.round(Math.random() * 1e9);

          cb(null, unique + extname(file.originalname));
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
      fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          return cb(
            new BadRequestException(
              'Only PDF files are allowed.',
            ),
            false,
          );
        }

        cb(null, true);
      },
    }),
  )
  uploadCertificate(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        'Please upload a certificate PDF.',
      );
    }

    return {
      url: `${
        process.env.BACKEND_URL || 'http://localhost:4000'
      }/uploads/certificates/${file.filename}`,
    };
  }

  // =========================================================
  // ID DOCUMENT UPLOAD
  // JPG / JPEG / PNG / WEBP - MAX 5 MB
  // =========================================================

  @Post('upload/id-document')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/id-documents',
        filename: (req, file, cb) => {
          const unique =
            Date.now() + '-' + Math.round(Math.random() * 1e9);

          cb(null, unique + extname(file.originalname));
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = [
          'image/jpeg',
          'image/png',
          'image/webp',
        ];

        if (!allowedTypes.includes(file.mimetype)) {
          return cb(
            new BadRequestException(
              'Only JPEG, PNG, or WEBP images are allowed.',
            ),
            false,
          );
        }

        cb(null, true);
      },
    }),
  )
  uploadIdDocument(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        'Please upload an ID document.',
      );
    }

    return {
      url: `${
        process.env.BACKEND_URL || 'http://localhost:4000'
      }/uploads/id-documents/${file.filename}`,
    };
  }

  // =========================================================
  // DRAFT
  // =========================================================

  @Get('draft')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async getDraft(@Req() req: any) {
    return this.teachersService.getOrCreateDraft(req.user.userId);
  }

  @Patch('draft/about')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async updateAbout(
    @Req() req: any,
    @Body() dto: AboutDto,
  ) {
    return this.teachersService.updateAbout(
      req.user.userId,
      dto,
    );
  }

  @Patch('draft/spoken-languages')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async updateSpokenLanguages(
    @Req() req: any,
    @Body() dto: SpokenLanguagesDto,
  ) {
    return this.teachersService.updateSpokenLanguages(
      req.user.userId,
      dto.languages,
    );
  }

  // =========================================================
  // PROFILE PHOTO
  // JPG / JPEG / PNG - MAX 20 MB
  // =========================================================

  @Post('upload/profile-photo')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/profile-photos',
        filename: (req, file, cb) => {
          const unique =
            Date.now() + '-' + Math.round(Math.random() * 1e9);

          cb(null, unique + extname(file.originalname));
        },
      }),
      limits: {
        fileSize: 20 * 1024 * 1024,
      },
      fileFilter: (req, file, cb) => {
        if (
          !['image/jpeg', 'image/png'].includes(
            file.mimetype,
          )
        ) {
          return cb(
            new BadRequestException(
              'Only JPEG or PNG images are allowed.',
            ),
            false,
          );
        }

        cb(null, true);
      },
    }),
  )
  uploadProfilePhoto(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Please upload a profile photo.',
      );
    }

    return {
      url: `${
        process.env.BACKEND_URL || 'http://localhost:4000'
      }/uploads/profile-photos/${file.filename}`,
    };
  }

  @Patch('draft/profile-photo')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async updateProfilePhoto(
    @Req() req: any,
    @Body() dto: ProfilePhotoDto,
  ) {
    return this.teachersService.updateProfilePhoto(
      req.user.userId,
      dto.profilePhotoUrl,
    );
  }

  // =========================================================
  // CERTIFICATE
  // =========================================================

  @Post('draft/certificate')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async addCertificate(
    @Req() req: any,
    @Body() dto: CertificateDto,
  ) {
    return this.teachersService.addCertificate(
      req.user.userId,
      dto,
    );
  }

  // =========================================================
  // TEACHING LANGUAGES
  // =========================================================

  @Patch('draft/teaching-languages')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async updateTeachingLanguages(
    @Req() req: any,
    @Body() dto: TeachingLanguagesDto,
  ) {
    return this.teachersService.updateTeachingLanguages(
      req.user.userId,
      dto.languages,
    );
  }

  // =========================================================
  // BECOME A TEACHER
  // =========================================================

  @Post('become')
  @UseGuards(AuthGuard('jwt'))
  async becomeTeacher(@Req() req: any) {
    return this.teachersService.becomeTeacher(req.user.userId);
  }

  // =========================================================
  // SUBMIT APPLICATION
  // =========================================================

  @Post('draft/submit')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async submitApplication(@Req() req: any) {
    return this.teachersService.submitApplication(
      req.user.userId,
    );
  }

  // =========================================================
  // ID DOCUMENT
  // =========================================================

  @Patch('draft/id-document')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async updateIdDocument(
    @Req() req: any,
    @Body() dto: IdDocumentDto,
  ) {
    return this.teachersService.updateIdDocument(
      req.user.userId,
      dto.idDocumentUrl,
    );
  }

  // =========================================================
  // EDUCATION
  // =========================================================

  @Post('draft/education')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async addEducation(
    @Req() req: any,
    @Body() dto: EducationDto,
  ) {
    return this.teachersService.addEducation(
      req.user.userId,
      dto,
    );
  }

  // =========================================================
  // DESCRIPTION
  // =========================================================

  @Patch('draft/description')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async updateDescription(
    @Req() req: any,
    @Body() dto: DescriptionDto,
  ) {
    return this.teachersService.updateDescription(
      req.user.userId,
      dto.description,
    );
  }

  // =========================================================
  // AVAILABILITY
  // =========================================================

  @Patch('draft/availability')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async updateAvailability(
    @Req() req: any,
    @Body() dto: AvailabilityDto,
  ) {
    return this.teachersService.updateAvailability(
      req.user.userId,
      dto.slots,
    );
  }

  // =========================================================
  // PRICING
  // =========================================================

  @Patch('draft/pricing')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async updatePricing(
    @Req() req: any,
    @Body() dto: PricingDto,
  ) {
    return this.teachersService.updatePricing(
      req.user.userId,
      dto.requestedHourlyRateDA,
    );
  }

  // =========================================================
  // DIPLOMA UPLOAD
  // PDF ONLY - MAX 10 MB
  // =========================================================

  @Post('upload/diploma')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/diplomas',
        filename: (req, file, cb) => {
          const unique =
            Date.now() + '-' + Math.round(Math.random() * 1e9);

          cb(null, unique + extname(file.originalname));
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
      fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          return cb(
            new BadRequestException(
              'Only PDF files are allowed.',
            ),
            false,
          );
        }

        cb(null, true);
      },
    }),
  )
  uploadDiploma(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        'Please upload a diploma PDF.',
      );
    }

    return {
      url: `${
        process.env.BACKEND_URL || 'http://localhost:4000'
      }/uploads/diplomas/${file.filename}`,
    };
  }

  // =========================================================
  // PUBLIC TEACHER SEARCH
  // =========================================================

  @Get('search')
  async searchTeachers(
    @Query('languageId') languageId?: string,
    @Query('serviceType') serviceType?: string,
    @Query('onlineOnly') onlineOnly?: string,
  ) {
    return this.teachersService.findPublicTeachers({
      languageId: languageId || undefined,
      serviceType: serviceType || undefined,
      online: onlineOnly === 'true' ? true : undefined,
    });
  }

  // =========================================================
  // ONLINE TEACHERS
  // =========================================================

  @Get('online')
  getOnlineTeachers() {
    return this.teachersService.getOnlineTeachers();
  }

  // =========================================================
  // PUBLIC TEACHER LIST
  // =========================================================

  @Get()
  findAll(@Query() query: FindTeachersDto) {
    return this.teachersService.findPublicTeachers(query);
  }

  // =========================================================
  // CURRENT TEACHER PROFILE
  // =========================================================

  @Get('me')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async getMe(@Req() req: any) {
    return this.teachersService.getMyProfile(req.user.userId);
  }

  // =========================================================
  // CURRENT TEACHER DASHBOARD
  // =========================================================

  @Get('me/dashboard')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async getDashboard(@Req() req: any) {
    return this.teachersService.getDashboard(req.user.userId);
  }

  // =========================================================
  // CURRENT TEACHER ONLINE STATUS
  // =========================================================

  @Patch('me/online')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  async setOnline(
    @Req() req: any,
    @Body() dto: SetOnlineDto,
  ) {
    return this.teachersService.setOnline(
      req.user.userId,
      dto.isOnline,
    );
  }

  @Patch('online-status')
  @UseGuards(AuthGuard('jwt'))
  async setOnlineStatus(
    @Req() req: any,
    @Body() body: { isOnline: boolean },
  ) {
    return this.teachersService.setOnline(
      req.user.userId,
      body.isOnline,
    );
  }

  // =========================================================
  // PUBLIC SINGLE TEACHER PROFILE
  // MUST REMAIN LAST
  // =========================================================

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.teachersService.getPublicProfile(id);
  }
}
import { Body, Controller, Get, Post, Patch, Delete, Param, Query, Req, UseGuards, UseInterceptors, BadRequestException, UploadedFile } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';



@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private adminService: AdminService) {}

  // ---------- Stats ----------
  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('analytics')
  getAnalytics() {
    return this.adminService.getAnalytics();
  }

  // ---------- Pricing rules ----------
  @Get('pricing')
  listPricing() {
    return this.adminService.listPricingRules();
  }

  @Patch('pricing/:id')
  updatePricing(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.adminService.updatePricingRule(id, req.user.userId, body);
  }

  // ---------- Agora call monitoring ----------
  @Get('calls')
  listCalls(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? parseInt(limit, 10) : undefined;
    return this.adminService.listCalls({
      status,
      limit: Number.isFinite(parsed) ? parsed : undefined,
    });
  }

  @Get('calls/stats')
  getCallStats() {
    return this.adminService.getCallStats();
  }

  // ---------- Teachers ----------
  @Get('teachers')
  listTeachers(
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.listTeachers({ search, status });
  }

  @Patch('teachers/:id/suspend')
  suspendTeacher(@Param('id') id: string, @Req() req: any) {
    return this.adminService.suspendTeacher(id, req.user.userId);
  }

  @Patch('teachers/:id/reactivate')
  reactivateTeacher(@Param('id') id: string, @Req() req: any) {
    return this.adminService.reactivateTeacher(id, req.user.userId);
  }

  // ---------- Teacher internal rates (private) ----------
  @Get('teacher-rates')
  listTeacherRates() {
    return this.adminService.listTeacherRates();
  }

  @Patch('teacher-rates/:id')
  setTeacherRate(
    @Param('id') id: string,
    @Body() body: { internalHourlyRateDA: number | null },
  ) {
    return this.adminService.setTeacherRate(id, body.internalHourlyRateDA);
  }

  // ---------- Packages ----------
  @Get('packages')
  getAllPackages() {
    return this.adminService.getAllPackages();
  }

  @Post('packages')
  createPackage(@Body() body: any) {
    return this.adminService.createPackage(body);
  }

  @Patch('packages/:id')
  updatePackage(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updatePackage(id, body);
  }

  @Delete('packages/:id')
  deletePackage(@Param('id') id: string) {
    return this.adminService.deletePackage(id);
  }

  // ---------- Podcasts ----------
  @Get('podcasts')
  getAllPodcasts() {
    return this.adminService.getAllPodcasts();
  }

  @Post('podcasts')
  createPodcast(@Body() body: any) {
    return this.adminService.createPodcast(body);
  }

  @Patch('podcasts/:id')
  updatePodcast(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updatePodcast(id, body);
  }

  @Delete('podcasts/:id')
  deletePodcast(@Param('id') id: string) {
    return this.adminService.deletePodcast(id);
  }

  // ---------- Users ----------
  @Get('users')
  getAllUsers(
    @Query('role') role?: string,
    @Query('filter') filter?: string,
  ) {
    return this.adminService.getAllUsers(role, filter);
  }

  @Get('users/pending')
  getPendingStudents() {
    return this.adminService.getPendingStudents();
  }

  @Patch('users/:id/tier')
  updateUserTier(@Param('id') id: string, @Body() body: { tier: string }) {
    return this.adminService.updateUserTier(id, body.tier);
  }

  @Patch('users/:id/payment-status')
  updateUserPaymentStatus(
    @Param('id') id: string,
    @Body() body: { paymentStatus: string },
  ) {
    return this.adminService.updateUserPaymentStatus(id, body.paymentStatus);
  }

  @Post('users/bulk-activate')
  bulkActivatePending() {
    return this.adminService.bulkActivatePending();
  }

  @Patch('users/:id/toggle-active')
  toggleUserActive(@Param('id') id: string) {
    return this.adminService.toggleUserActive(id);
  }

  // ---------- Activities ----------
  @Get('activities')
  getAllActivities() {
    return this.adminService.getAllActivities();
  }

  @Post('activities')
  createActivity(@Body() body: any) {
    return this.adminService.createActivity(body);
  }

  @Patch('activities/:id')
  updateActivity(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateActivity(id, body);
  }

  @Delete('activities/:id')
  deleteActivity(@Param('id') id: string) {
    return this.adminService.deleteActivity(id);
  }

    // ---------- File Upload (Podcasts: video/audio/cover) ----------
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req: any, file: any, cb: any) => {
          const type = req.query.type || 'video';
          const folder =
            type === 'cover' ? 'covers' :
            type === 'audio' ? 'audio' : 'videos';
          cb(null, join(process.cwd(), 'uploads', 'podcasts', folder));
        },
        filename: (req: any, file: any, cb: any) => {
          const ext = extname(file.originalname);
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: {
        fileSize: 1024 * 1024 * 1024, // 1 GB
      },
      fileFilter: (req: any, file: any, cb: any) => {
        const ok = /image\/(jpeg|png|jpg|webp)|audio\/(mpeg|mp3|wav|ogg)|video\/(mp4|webm|quicktime)/.test(file.mimetype);
        if (!ok) return cb(new BadRequestException('Only images, audio, and video files allowed'), false);
        cb(null, true);
      },
    }),
  )
  async uploadFile(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No file uploaded');
    const relativePath = file.path.split('uploads')[1].replace(/\\/g, '/');
    return {
      url: `/uploads${relativePath}`,
      size: file.size,
      mimetype: file.mimetype,
      filename: file.filename,
    };
  }
}
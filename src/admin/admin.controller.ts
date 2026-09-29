import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';



@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }
    @Get('analytics')
  getAnalytics() {
    return this.adminService.getAnalytics();
  }

  // Packages
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
    // Podcasts
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
    // Users
  @Get('users')
  getAllUsers(@Query('role') role?: string) {
    return this.adminService.getAllUsers(role);
  }

  @Patch('users/:id/toggle-active')
  toggleUserActive(@Param('id') id: string) {
    return this.adminService.toggleUserActive(id);
  }

    // Activities
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
}
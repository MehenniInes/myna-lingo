import { Controller, Get, Post, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PackagesService } from './packages.service.js';

@Controller('packages')
export class PackagesController {
  constructor(private packagesService: PackagesService) {}

  @Get()
  findAll() {
    return this.packagesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.packagesService.findOne(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/purchase')
  purchase(@Param('id') id: string, @Req() req: any) {
    return this.packagesService.purchase(req.user.userId, id);
  }
}
import { Controller, Get, Post, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ChildrenService } from './children.service.js';

@Controller('children')
@UseGuards(AuthGuard('jwt'))
export class ChildrenController {
  constructor(private childrenService: ChildrenService) {}

  @Post()
  create(
    @Body() body: { fullName: string; dateOfBirth: string },
    @Req() req: any,
  ) {
    return this.childrenService.create(req.user.userId, body);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.childrenService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.childrenService.findOne(req.user.userId, id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.childrenService.remove(req.user.userId, id);
  }
}
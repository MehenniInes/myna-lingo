import { Controller, Get } from '@nestjs/common';
import { LanguagesService } from './languages.service.js';

@Controller('languages')
export class LanguagesController {
  constructor(private languagesService: LanguagesService) {}

  @Get()
  async findAll() {
    return this.languagesService.findAllActive();
  }
}
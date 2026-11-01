import { Controller, Get, Post, Param, UseGuards, Req, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ChatService } from './chat.service.js';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';

@Controller('chat')
@UseGuards(AuthGuard('jwt'))
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get('conversations')
  getConversations(@Req() req: any) {
    return this.chatService.getConversations(req.user.userId);
  }

  @Get('history/:userId')
  getHistory(@Req() req: any, @Param('userId') otherUserId: string) {
    return this.chatService.getHistory(req.user.userId, otherUserId);
  }

  @Get('users')
  getUsers(@Req() req: any) {
    return this.chatService.getAvailableUsers(req.user.userId);
  }

  // 👈 الـ Endpoint الجديد ديال رفع الملفات فـ الشات
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          cb(null, join(process.cwd(), 'uploads', 'chat'));
        },
        filename: (req, file, cb) => {
          const ext = extname(file.originalname);
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
      fileFilter: (req, file, cb) => {
        const ok = /image\/(jpeg|png|jpg|webp|gif)|application\/(pdf|zip)/.test(file.mimetype);
        if (!ok) return cb(new BadRequestException('Only images and PDFs/ZIPs are allowed'), false);
        cb(null, true);
      },
    }),
  )
  async uploadChatFile(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No file uploaded');
    const relativePath = file.path.split('uploads')[1].replace(/\\/g, '/');
    return {
      url: `/uploads${relativePath}`,
      mimetype: file.mimetype,
      fileName: file.originalname,
    };
  }
}
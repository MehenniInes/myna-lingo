import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ChatService } from './chat.service.js';

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
}
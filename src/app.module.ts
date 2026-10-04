import { Module } from '@nestjs/common';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { TeachersModule } from './teachers/teachers.module.js';
import { PackagesModule } from './packages/packages.module.js';
import { MinutesModule } from './minutes/minutes.module.js';
import { PodcastsModule } from './podcasts/podcasts.module.js';
import { XpModule } from './xp/xp.module.js';
import { ActivitiesModule } from './activities/activities.module.js';
import { ChildrenModule } from './children/children.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { GroupClassesModule } from './group-classes/group-classes.module.js';
import { AdminModule } from './admin/admin.module.js';
import { CallsModule } from './calls/calls.module.js';
import { BookingsModule } from './bookings/bookings.module.js';
import { GroupSessionsModule } from './group-sessions/group-sessions.module.js';
import { ScheduleModule } from '@nestjs/schedule';
import { AgoraModule } from './agora/agora.module.js';
import { LanguagesModule } from './languages/languages.module.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    PrismaModule,
    TeachersModule,
    PackagesModule,
    MinutesModule,
    PodcastsModule,
    XpModule,
    ActivitiesModule,
    ChildrenModule,
    NotificationsModule,
    GroupClassesModule,
    AdminModule,
    CallsModule,
    BookingsModule,
    GroupSessionsModule,
    AgoraModule,
    LanguagesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
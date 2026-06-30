import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ConversationStatus, Role } from "@fizioterapi/db";
import { JwtPayload } from "@fizioterapi/types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { MessagingService, sendMessageSchema, startConversationSchema } from "./messaging.service";

type RequestWithUser = { user: JwtPayload };

@Controller("conversations")
@UseGuards(JwtAuthGuard, RolesGuard)
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get()
  @Roles(Role.PATIENT, Role.THERAPIST)
  list(@Req() request: RequestWithUser) {
    return this.messaging.listConversations(request.user.sub);
  }

  @Get("unread-count")
  @Roles(Role.PATIENT, Role.THERAPIST)
  unread(@Req() request: RequestWithUser) {
    return this.messaging.unreadCount(request.user.sub);
  }

  @Post()
  @Roles(Role.PATIENT)
  start(@Req() request: RequestWithUser, @Body() body: unknown) {
    return this.messaging.startConversation(request.user.sub, startConversationSchema.parse(body));
  }

  @Get(":conversationId/messages")
  @Roles(Role.PATIENT, Role.THERAPIST)
  messages(@Req() request: RequestWithUser, @Param("conversationId") conversationId: string) {
    return this.messaging.listMessages(request.user.sub, conversationId);
  }

  @Post(":conversationId/messages")
  @Roles(Role.PATIENT, Role.THERAPIST)
  send(@Req() request: RequestWithUser, @Param("conversationId") conversationId: string, @Body() body: unknown) {
    return this.messaging.sendMessage(request.user.sub, conversationId, sendMessageSchema.parse(body));
  }

  @Patch(":conversationId/accept")
  @Roles(Role.THERAPIST)
  accept(@Req() request: RequestWithUser, @Param("conversationId") conversationId: string) {
    return this.messaging.setStatus(request.user.sub, conversationId, ConversationStatus.ACCEPTED);
  }

  @Patch(":conversationId/reject")
  @Roles(Role.THERAPIST)
  reject(@Req() request: RequestWithUser, @Param("conversationId") conversationId: string) {
    return this.messaging.setStatus(request.user.sub, conversationId, ConversationStatus.REJECTED);
  }
}

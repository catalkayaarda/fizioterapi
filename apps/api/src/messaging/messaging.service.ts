import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConversationStatus, MessageSenderRole, Prisma, Role, TherapistStatus } from "@fizioterapi/db";
import { z } from "zod";
import { PrismaService } from "../prisma.service";

export const startConversationSchema = z.object({
  therapistProfileId: z.string().min(1),
  message: z.string().trim().min(1).max(2000).optional()
});

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1).max(2000)
});

type ConversationParticipant = {
  conversation: Prisma.ConversationGetPayload<{
    include: {
      patient: { select: { id: true; name: true; email: true } };
      therapistProfile: { select: { id: true; userId: true; fullName: true } };
    };
  }>;
  viewerRole: MessageSenderRole;
};

@Injectable()
export class MessagingService {
  constructor(private readonly prisma: PrismaService) {}

  async startConversation(patientId: string, input: z.infer<typeof startConversationSchema>) {
    const patient = await this.prisma.user.findUniqueOrThrow({ where: { id: patientId } });
    if (patient.role !== Role.PATIENT) {
      throw new ForbiddenException("Mesaj talebini yalnızca hastalar başlatabilir.");
    }

    const therapist = await this.prisma.therapistProfile.findFirst({
      where: { id: input.therapistProfileId, status: TherapistStatus.APPROVED }
    });
    if (!therapist) {
      throw new NotFoundException("Onaylı terapist bulunamadı.");
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.conversation.findUnique({
        where: { patientId_therapistProfileId: { patientId, therapistProfileId: therapist.id } }
      });

      const conversation = existing
        ? await tx.conversation.update({
            where: { id: existing.id },
            // A rejected request can be re-sent; it returns to the pending queue.
            data: existing.status === ConversationStatus.REJECTED ? { status: ConversationStatus.PENDING } : {}
          })
        : await tx.conversation.create({
            data: { patientId, therapistProfileId: therapist.id, status: ConversationStatus.PENDING }
          });

      if (input.message) {
        await this.appendMessage(tx, conversation.id, patientId, MessageSenderRole.PATIENT, input.message);
      }

      return this.loadConversation(tx, conversation.id);
    });
  }

  async listConversations(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { therapistProfile: { select: { id: true } } }
    });

    const where: Prisma.ConversationWhereInput =
      user.role === Role.THERAPIST
        ? { therapistProfileId: user.therapistProfile?.id ?? "__none__" }
        : { patientId: userId };

    const viewerRole = user.role === Role.THERAPIST ? MessageSenderRole.THERAPIST : MessageSenderRole.PATIENT;

    const conversations = await this.prisma.conversation.findMany({
      where,
      include: {
        patient: { select: { id: true, name: true, email: true } },
        therapistProfile: { select: { id: true, userId: true, fullName: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 }
      },
      orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }]
    });

    const unreadGroups = await this.prisma.message.groupBy({
      by: ["conversationId"],
      where: {
        conversation: where,
        readAt: null,
        senderRole: viewerRole === MessageSenderRole.THERAPIST ? MessageSenderRole.PATIENT : MessageSenderRole.THERAPIST
      },
      _count: { _all: true }
    });
    const unreadByConversation = new Map(unreadGroups.map((group) => [group.conversationId, group._count._all]));

    return conversations.map((conversation) => ({
      ...conversation,
      viewerRole,
      lastMessage: conversation.messages[0] ?? null,
      unreadCount: unreadByConversation.get(conversation.id) ?? 0
    }));
  }

  async unreadCount(userId: string) {
    const conversations = await this.listConversations(userId);
    const total = conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0);
    return { unreadCount: total };
  }

  async listMessages(userId: string, conversationId: string) {
    const { conversation, viewerRole } = await this.resolveParticipant(userId, conversationId);

    const incomingRole = viewerRole === MessageSenderRole.THERAPIST ? MessageSenderRole.PATIENT : MessageSenderRole.THERAPIST;
    await this.prisma.message.updateMany({
      where: { conversationId: conversation.id, senderRole: incomingRole, readAt: null },
      data: { readAt: new Date() }
    });

    const messages = await this.prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" }
    });

    return { conversation: { ...conversation, viewerRole }, messages };
  }

  async sendMessage(userId: string, conversationId: string, input: z.infer<typeof sendMessageSchema>) {
    const { conversation, viewerRole } = await this.resolveParticipant(userId, conversationId);

    if (conversation.status === ConversationStatus.REJECTED) {
      throw new BadRequestException("Bu görüşme talebi reddedildi.");
    }
    // Before approval only the patient (who initiated the request) may write; the
    // therapist must accept first so the two sides can converse.
    if (conversation.status === ConversationStatus.PENDING && viewerRole !== MessageSenderRole.PATIENT) {
      throw new BadRequestException("Mesajlaşmadan önce görüşme talebini kabul etmelisiniz.");
    }

    await this.prisma.$transaction(async (tx) => {
      await this.appendMessage(tx, conversation.id, userId, viewerRole, input.body);
    });

    return this.listMessages(userId, conversationId);
  }

  async setStatus(therapistUserId: string, conversationId: string, status: ConversationStatus) {
    const profile = await this.prisma.therapistProfile.findUnique({ where: { userId: therapistUserId } });
    if (!profile) {
      throw new ForbiddenException("Terapist profili bulunamadı.");
    }
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation || conversation.therapistProfileId !== profile.id) {
      throw new NotFoundException("Görüşme bulunamadı.");
    }
    if (conversation.status !== ConversationStatus.PENDING) {
      throw new BadRequestException("Yalnızca bekleyen talepler yanıtlanabilir.");
    }

    await this.prisma.conversation.update({ where: { id: conversation.id }, data: { status } });
    return this.prisma.conversation
      .findUniqueOrThrow({
        where: { id: conversation.id },
        include: {
          patient: { select: { id: true, name: true, email: true } },
          therapistProfile: { select: { id: true, userId: true, fullName: true } }
        }
      });
  }

  private async resolveParticipant(userId: string, conversationId: string): Promise<ConversationParticipant> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        patient: { select: { id: true, name: true, email: true } },
        therapistProfile: { select: { id: true, userId: true, fullName: true } }
      }
    });
    if (!conversation) {
      throw new NotFoundException("Görüşme bulunamadı.");
    }
    if (conversation.patientId === userId) {
      return { conversation, viewerRole: MessageSenderRole.PATIENT };
    }
    if (conversation.therapistProfile.userId === userId) {
      return { conversation, viewerRole: MessageSenderRole.THERAPIST };
    }
    throw new ForbiddenException("Bu görüşmeye erişiminiz yok.");
  }

  private async appendMessage(
    tx: Prisma.TransactionClient,
    conversationId: string,
    senderId: string,
    senderRole: MessageSenderRole,
    body: string
  ) {
    const message = await tx.message.create({
      data: { conversationId, senderId, senderRole, body }
    });
    await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: message.createdAt } });
    return message;
  }

  private loadConversation(tx: Prisma.TransactionClient, conversationId: string) {
    return tx.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: {
        patient: { select: { id: true, name: true, email: true } },
        therapistProfile: { select: { id: true, userId: true, fullName: true } },
        messages: { orderBy: { createdAt: "asc" } }
      }
    });
  }
}

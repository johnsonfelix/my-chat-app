// app/api/conversations/[conversationId]/messages/route.ts
import { prisma } from '@/app/lib/prisma';
import { getFirebaseApp } from '@/app/lib/firebaseAdmin';
import { getMessaging } from 'firebase-admin/messaging';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const sendSchema = z.object({
  senderId: z.string(),
  content: z.string().min(1),
});

export async function GET(
  req: NextRequest,
  // Change for GET: The 'params' object is now wrapped in a Promise.
  { params }: { params: Promise<{ conversationId: string }> }
) {
  // Change for GET: You must 'await' the params to access its properties.
  const { conversationId } = await params;

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    include: {
      readBy: { select: { id: true, name: true } },
      sender: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(messages);
}

export async function POST(
  req: NextRequest,
  // Change for POST: The 'params' object is now wrapped in a Promise.
  { params }: { params: Promise<{ conversationId:string }> }
) {
  try {
    // Change for POST: You must 'await' the params to access its properties.
    const { conversationId } = await params;
    const body = await req.json();
    const { senderId, content } = sendSchema.parse(body);

    // Basic authorization check: ensure sender belongs to conversation
    const convo = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: { select: { id: true } } },
    });
    if (!convo) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const isParticipant = convo.participants.some((p) => p.id === senderId);
    if (!isParticipant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const message = await prisma.message.create({
      data: {
        content,
        sender: { connect: { id: senderId } },
        conversation: { connect: { id: conversationId } },
      },
      include: {
        sender: { select: { id: true, name: true } }, // Crucial: Include sender details
      },
    });

    // Update last message preview
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageText: content,
        lastMessageAt: new Date(),
      },
    });
    

    // Emit realtime update to conversation room and participant rooms
    if (global.serverSocket?.io) {
      global.serverSocket.io.to(`conversation:${conversationId}`).emit('message:new', {
        conversationId,
        message, // This 'message' object is what your Flutter app receives
      });
      convo.participants.forEach((p) => {
        global.serverSocket!.io?.to(`company:${p.id}`).emit('conversation:update', {
          conversationId,
          lastMessageText: content,
          lastMessageAt: new Date().toISOString(),
        });
      });
    }

    // Dispatch FCM Push Notification to offline/closed devices
    try {
      const recipientIds = convo.participants
        .filter((p) => p.id !== senderId)
        .map((p) => p.id);

      if (recipientIds.length > 0) {
        const deviceTokens = await prisma.deviceToken.findMany({
          where: { companyId: { in: recipientIds } },
          select: { token: true },
        });

        const tokens = deviceTokens.map((dt) => dt.token).filter(Boolean);
        if (tokens.length > 0) {
          const fbApp = getFirebaseApp();
          if (fbApp) {
            const senderName = message.sender?.name || 'New Message';
            await getMessaging(fbApp).sendEachForMulticast({
              tokens,
              notification: {
                title: senderName,
                body: content,
              },
              data: {
                conversationId: String(conversationId),
                senderId: String(senderId),
                senderName: String(senderName),
                content: String(content),
              },
              android: {
                priority: 'high',
                notification: {
                  channelId: 'chat_messages_channel',
                  priority: 'high',
                  sound: 'default',
                },
              },
            });
          }
        }
      }
    } catch (fcmErr) {
      console.error('FCM Push Notification error:', fcmErr);
    }

    return NextResponse.json(message, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e }, { status: 400 });
  }
}

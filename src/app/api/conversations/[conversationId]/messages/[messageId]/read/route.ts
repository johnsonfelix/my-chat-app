// app/api/messages/[messageId]/read/route.ts
import { prisma } from '@/app/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const bodySchema = z.object({
  companyId: z.string(),
});

export async function POST(
  req: NextRequest,
  // Change 1: The 'params' object is now wrapped in a Promise.
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    // Change 2: You must 'await' the params to access its properties.
    const { messageId } = await params;
    const body = await req.json();
    const { companyId } = bodySchema.parse(body);

    const msg = await prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: { select: { id: true } } },
    });

    if (!msg) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.message.update({
      where: { id: messageId },
      data: {
        readBy: { connect: { id: companyId } },
      },
    });

    if (global.serverSocket?.io) {
      global.serverSocket.io
        .to(`conversation:${msg.conversationId}`)
        .emit('message:read', { messageId, companyId });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e }, { status: 400 });
  }
}

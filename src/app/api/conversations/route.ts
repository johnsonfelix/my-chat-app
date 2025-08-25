// app/api/conversations/route.ts
import { prisma } from '@/app/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const createSchema = z.object({
  participantCompanyIds: z.array(z.string()).min(2),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { participantCompanyIds } = createSchema.parse(body);

    const conversation = await prisma.conversation.create({
      data: {
        participants: {
          connect: participantCompanyIds.map((id) => ({ id })),
        },
      },
      include: { participants: true },
    });

    // Optional: notify participants via WS
    if (global.serverSocket?.io) {
      participantCompanyIds.forEach((id) => {
        global.serverSocket!.io?.to(`company:${id}`).emit('conversation:new', {
          conversationId: conversation.id,
        });
      });
    }

    return NextResponse.json(conversation, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    if (!companyId) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: { id: companyId },
        },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        participants: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(conversations, { status: 200 });
  } catch (e: unknown) {
    // Log the error server-side and respond with a safe JSON error
    console.error('GET /api/conversations error', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

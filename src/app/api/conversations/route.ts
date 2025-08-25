import { prisma } from '@/app/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';

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

    // Use Prisma's typed payload for include: { participants: true }
    const conversations = (await prisma.conversation.findMany({
      where: {
        participants: {
          some: { id: companyId },
        },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        participants: true,
      },
    })) as Prisma.ConversationGetPayload<{ include: { participants: true } }>[]; 

    // Normalize participants to always provide `logoUrl`
    const normalized = conversations.map((conv) => {
      // Each participant is typed from Prisma; convert to flexible record to probe possible fields
      const participants = conv.participants.map((p) => {
        const pRec = p as unknown as Record<string, unknown>;

        const logoUrlCandidate =
          (pRec['logoUrl'] ?? pRec['logo'] ?? pRec['logo_url'] ?? pRec['avatarUrl'] ?? pRec['avatar']) ??
          null;

        const logoUrl = typeof logoUrlCandidate === 'string' ? logoUrlCandidate : null;

        return {
          id: p.id,
          name: p.name ?? null,
          logoUrl,
        };
      });

      // Return conversation with normalized participants
      return {
        ...conv,
        participants,
      };
    });

    return NextResponse.json(normalized, { status: 200 });
  } catch (e: unknown) {
    console.error('GET /api/conversations error', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

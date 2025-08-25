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

    // Include full participants (avoid unknown select properties)
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: { id: companyId },
        },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        participants: true, // include full participants object
      },
    });

    // Normalize participants to always provide `logoUrl` (try common field names)
    const normalized = conversations.map((conv) => {
      // conv.participants might be strongly typed; cast to `any` for safe mapping
      const participants = ((conv as any).participants || []).map((p: any) => {
        return {
          id: p.id,
          name: p.name ?? null,
          // Try multiple common DB/Prisma field names and fall back to null
          logoUrl: p.logoUrl ?? p.logo ?? p.logo_url ?? p.avatarUrl ?? p.avatar ?? null,
        };
      });

      // Spread conv but replace participants with the normalized array.
      // Convert any `Date` objects to ISO strings (JSON.stringify will do this, but being explicit avoids surprises)
      const safeConv: any = {
        ...conv,
        participants,
      };

      return safeConv;
    });

    return NextResponse.json(normalized, { status: 200 });
  } catch (e: unknown) {
    console.error('GET /api/conversations error', e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

import { prisma } from '@/app/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyId, token } = body;

    if (!companyId || !token) {
      return NextResponse.json({ error: 'Missing companyId or token' }, { status: 400 });
    }

    await prisma.deviceToken.upsert({
      where: { token },
      create: {
        companyId,
        token,
      },
      update: {
        companyId,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error saving device token:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

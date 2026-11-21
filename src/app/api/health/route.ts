import { prisma } from '@/app/lib/prisma';
import { getFirebaseApp } from '@/app/lib/firebaseAdmin';
import { NextResponse } from 'next/server';

export async function GET() {
  const hasDbUrl = Boolean(process.env.DATABASE_URL);
  const hasFirebaseKey = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  let dbStatus = 'untested';
  let dbError = null;

  try {
    const count = await prisma.company.count();
    dbStatus = `connected (companies: ${count})`;
  } catch (err: any) {
    dbStatus = 'failed';
    dbError = err?.message || String(err);
  }

  const fbApp = getFirebaseApp();
  const fbStatus = fbApp ? 'initialized' : 'missing credentials';

  return NextResponse.json({
    status: 'ok',
    environment: {
      hasDatabaseUrl: hasDbUrl,
      hasFirebaseKey: hasFirebaseKey,
    },
    database: {
      status: dbStatus,
      error: dbError,
    },
    firebase: {
      status: fbStatus,
    },
  });
}

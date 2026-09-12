import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { globalSearch } from '@/data/search';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';

  const results = await globalSearch(q);
  return NextResponse.json({ results });
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listFolderFiles } from '@/lib/google-drive';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/drive/list?folderId=... — list files in a Drive folder for the
 * authenticated user. Requires the user to have connected Google (with the
 * drive.readonly scope) on /schedule. */
export async function GET(req: NextRequest) {
  const folderId = req.nextUrl.searchParams.get('folderId');
  if (!folderId) return NextResponse.json({ error: 'folderId required' }, { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const files = await listFolderFiles(user.email, folderId);
    return NextResponse.json({ files });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Drive list failed' }, { status: 500 });
  }
}

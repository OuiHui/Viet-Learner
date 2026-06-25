import { NextResponse } from 'next/server';
import db from '../../../../lib/db';

export async function POST(req) {
  await db.connect();
  try {
    const { articleId } = await req.json();
    if (!articleId) {
      return NextResponse.json({ error: 'articleId is required' }, { status: 400 });
    }

    const progress = await db.getProgress();
    const articlesRead = progress.articlesRead || [];
    
    if (!articlesRead.includes(articleId)) {
      articlesRead.push(articleId);
    }

    const updated = await db.saveProgress({
      articlesRead,
      lastActive: new Date().toISOString()
    });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

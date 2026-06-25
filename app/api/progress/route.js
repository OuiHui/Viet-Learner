import { NextResponse } from 'next/server';
import db from '../../../lib/db';

export async function GET() {
  await db.connect();
  try {
    const progress = await db.getProgress();
    return NextResponse.json(progress);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

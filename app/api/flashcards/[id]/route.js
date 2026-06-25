import { NextResponse } from 'next/server';
import db from '../../../../lib/db';

export async function DELETE(req, { params }) {
  await db.connect();
  try {
    const id = params.id;
    const result = await db.deleteFlashcard(id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

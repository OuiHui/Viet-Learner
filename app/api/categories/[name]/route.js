import { NextResponse } from 'next/server';
import db from '../../../../lib/db';

export async function DELETE(req, { params }) {
  await db.connect();
  try {
    const name = decodeURIComponent(params.name);
    const result = await db.deleteCategory(name);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import db from '../../../lib/db';

export async function GET() {
  await db.connect();
  try {
    const categories = await db.getCategories();
    return NextResponse.json(categories);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  await db.connect();
  try {
    const { name } = await req.json();
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const category = await db.createCategory(name);
    return NextResponse.json(category);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

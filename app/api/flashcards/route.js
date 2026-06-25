import { NextResponse } from 'next/server';
import db from '../../../lib/db';

export async function GET() {
  await db.connect();
  try {
    const flashcards = await db.getFlashcards();
    return NextResponse.json(flashcards);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  await db.connect();
  try {
    const cardData = await req.json();
    if (!cardData.word || !cardData.definition || !cardData.category) {
      return NextResponse.json(
        { error: 'Word, definition, and category are required' },
        { status: 400 }
      );
    }
    const card = await db.createFlashcard(cardData);
    return NextResponse.json(card);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

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

export async function PUT(req, { params }) {
  await db.connect();
  try {
    const id = params.id;
    const cardData = await req.json();
    if (!cardData.word || !cardData.definition || !cardData.category) {
      return NextResponse.json(
        { error: 'Word, definition, and category are required' },
        { status: 400 }
      );
    }
    const updatedCard = await db.updateFlashcard(id, cardData);
    return NextResponse.json(updatedCard);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


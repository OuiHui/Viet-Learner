import { NextResponse } from 'next/server';
import db from '../../../../lib/db';

export async function DELETE(req, { params }) {
  await db.connect();
  try {
    const id = params.id;
    const result = await db.deleteVocabulary(id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  await db.connect();
  try {
    const id = params.id;
    const vocabData = await req.json();
    if (!vocabData.word || !vocabData.definition || !vocabData.contextSentence || !vocabData.contextTranslation || !vocabData.source) {
      return NextResponse.json(
        { error: 'All fields (word, definition, contextSentence, contextTranslation, source) are required' },
        { status: 400 }
      );
    }
    const updatedVocab = await db.updateVocabulary(id, vocabData);
    return NextResponse.json(updatedVocab);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


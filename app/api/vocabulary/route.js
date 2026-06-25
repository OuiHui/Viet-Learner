import { NextResponse } from 'next/server';
import db from '../../../lib/db';

export async function GET() {
  await db.connect();
  try {
    const vocabulary = await db.getVocabulary();
    return NextResponse.json(vocabulary);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  await db.connect();
  try {
    const vocabData = await req.json();
    if (!vocabData.word || !vocabData.definition || !vocabData.contextSentence || !vocabData.contextTranslation || !vocabData.source) {
      return NextResponse.json(
        { error: 'All fields (word, definition, contextSentence, contextTranslation, source) are required' },
        { status: 400 }
      );
    }
    const result = await db.createVocabulary(vocabData);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

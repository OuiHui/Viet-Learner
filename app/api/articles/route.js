import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { ARTICLES } from '../../../lib/articlesData';

export async function GET() {
  await db.connect();
  try {
    const dbArticles = await db.getArticles();
    // Convert Mongoose documents or local JSON items to plain JS objects, and combine with static ones
    const plainDbArticles = JSON.parse(JSON.stringify(dbArticles));
    
    // Ensure all items have standard 'id' properties if they only have '_id'
    const formattedDbArticles = plainDbArticles.map(art => ({
      ...art,
      id: art.id || art._id
    }));

    return NextResponse.json([...ARTICLES, ...formattedDbArticles]);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  await db.connect();
  try {
    const { title, level, sentences, source } = await req.json();
    if (!title || !level || !sentences || !Array.isArray(sentences)) {
      return NextResponse.json({ error: 'title, level, and sentences array are required' }, { status: 400 });
    }
    const newArticle = await db.createArticle({ title, level, sentences, source });
    return NextResponse.json(newArticle);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

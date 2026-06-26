import { NextResponse } from 'next/server';
import db from '../../../../lib/db';


function cleanText(str) {
  if (!str) return '';
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/<[^>]*>/g, '') // strip html tags
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function googleTranslate(text, from = 'vi', to = 'en') {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Google Translate API error');
    const json = await res.json();
    if (json && json[0]) {
      return json[0].map(item => item[0]).join('');
    }
  } catch (err) {
    console.error('Translation failed inside scraper:', err);
  }
  return 'Translation unavailable';
}

// Split Vietnamese text into sentences
function splitSentences(text) {
  // Regex to split by sentence-ending punctuation followed by space or end of string, keeping punctuation
  const sentenceRegex = /[^.!?\s][^.!?]*(?:[.!?](?!\d)+|$)/g;
  const matches = text.match(sentenceRegex) || [];
  return matches
    .map(s => s.trim())
    .filter(s => s.length > 10 && !s.includes('VnExpress') && !s.includes('Ảnh:'));
}

export async function POST(req) {
  await db.connect();
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)'
      }
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Failed to fetch URL: status ${response.status}` }, { status: 500 });
    }

    const htmlOrXml = await response.text();
    let title = '';
    let bodyText = '';
    let isRss = url.includes('/rss/') || url.endsWith('.rss') || htmlOrXml.includes('<rss') || htmlOrXml.includes('<feed');

    if (isRss) {
      // Parse RSS
      const itemMatch = htmlOrXml.match(/<item>([\s\S]*?)<\/item>/);
      if (!itemMatch) {
        return NextResponse.json({ error: 'Could not find any items in the RSS feed' }, { status: 400 });
      }
      
      const itemContent = itemMatch[1];
      const titleMatch = itemContent.match(/<title>([\s\S]*?)<\/title>/);
      const descMatch = itemContent.match(/<description>([\s\S]*?)<\/description>/);
      
      title = titleMatch ? cleanText(titleMatch[1]) : 'VnExpress News Article';
      bodyText = descMatch ? cleanText(descMatch[1]) : '';
    } else {
      // Parse standard HTML web article
      const titleMatch = htmlOrXml.match(/<title>([\s\S]*?)<\/title>/) || htmlOrXml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
      title = titleMatch ? cleanText(titleMatch[1]) : 'Scraped Web Article';
      
      // Clean up common news site title suffixes
      title = title.split(' - ')[0].split(' | ')[0];

      // Extract all paragraph texts from normal HTML articles (VnExpress specific and generic)
      const pMatches = htmlOrXml.match(/<p[^>]*class="Normal"[^>]*>([\s\S]*?)<\/p>/gi) || htmlOrXml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
      if (pMatches) {
        // Take the first 3-5 paragraphs to keep the article manageable for learners
        bodyText = pMatches
          .slice(0, 5)
          .map(p => cleanText(p))
          .filter(txt => txt.length > 30)
          .join(' ');
      }
    }

    if (!bodyText) {
      return NextResponse.json({ error: 'Failed to extract text content from the page' }, { status: 400 });
    }

    // Process text into sentences
    const rawSentences = splitSentences(bodyText).slice(0, 6); // limit to 6 sentences for learnability
    if (rawSentences.length === 0) {
      return NextResponse.json({ error: 'No readable sentences found in the content' }, { status: 400 });
    }

    const sentences = [];
    for (const textItem of rawSentences) {
      const translation = await googleTranslate(textItem);
      sentences.push({ text: textItem, translation });
    }

    // Save article to database
    const savedArticle = await db.createArticle({
      title: `${title} (News)`,
      level: 'Advanced', // authentic materials are generally advanced
      sentences,
      source: 'VnExpress News'
    });

    return NextResponse.json(savedArticle);
  } catch (err) {
    console.error('Error scraping news:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

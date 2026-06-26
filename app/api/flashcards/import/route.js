import { NextResponse } from 'next/server';
import db from '../../../../lib/db';


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
    console.error('Translation failed inside importer:', err);
  }
  return '';
}

// Same Tatoeba helper as in translate route
async function getTatoebaSentence(viWord) {
  const url = `https://tatoeba.org/en/api_v0/search?from=vie&to=eng&query=${encodeURIComponent(viWord)}&orphans=no&sort=relevance`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)'
      },
      timeout: 2000
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.results && json.results.length > 0) {
        for (const result of json.results) {
          if (result.text && result.translations) {
            for (const transGroup of result.translations) {
              for (const trans of transGroup) {
                if (trans.lang === 'eng' && trans.text) {
                  return {
                    sentence: result.text.trim(),
                    translation: trans.text.trim()
                  };
                }
              }
            }
          }
        }
      }
    }
  } catch (e) {
    // Ignore Tatoeba errors and fallback
  }
  return null;
}

export async function POST(req) {
  await db.connect();
  try {
    const { category, listText } = await req.json();
    if (!category || !listText) {
      return NextResponse.json({ error: 'category and listText are required' }, { status: 400 });
    }

    // Split input into lines or comma-separated tokens
    let rawEntries = [];
    if (listText.includes('\n')) {
      rawEntries = listText.split('\n');
    } else if (listText.includes(';')) {
      rawEntries = listText.split(';');
    } else {
      rawEntries = listText.split(',');
    }

    const importedCards = [];

    // Make sure category exists in database
    try {
      const existingCats = await db.getCategories();
      const plainCats = JSON.parse(JSON.stringify(existingCats));
      const hasCat = plainCats.some(c => c.name.toLowerCase() === category.trim().toLowerCase());
      if (!hasCat) {
        await db.createCategory(category.trim());
      }
    } catch (e) {
      console.warn('Could not verify/create category, proceeding:', e.message);
    }

    for (let entry of rawEntries) {
      entry = entry.trim();
      if (!entry) continue;

      let word = entry;
      let definition = '';
      let example = '';
      let translation = '';

      // Parse structures like "word : definition | example | translation"
      if (entry.includes(':') || entry.includes('-')) {
        const separator = entry.includes(':') ? ':' : '-';
        const parts = entry.split(separator);
        word = parts[0].trim();
        
        const rightSide = parts.slice(1).join(separator).trim();
        if (rightSide.includes('|')) {
          const detailParts = rightSide.split('|');
          definition = detailParts[0].trim();
          example = detailParts[1] ? detailParts[1].trim() : '';
          translation = detailParts[2] ? detailParts[2].trim() : '';
        } else {
          definition = rightSide;
        }
      }

      // If definition is empty, auto-translate the word
      if (!definition) {
        definition = await googleTranslate(word, 'vi', 'en');
      }

      // If example is empty, try getting one from Tatoeba or fallback template
      if (!example) {
        const cleanWord = word.replace(/[.,!?;:"'()]/g, '').trim();
        const tatoebaResult = await getTatoebaSentence(cleanWord);
        
        if (tatoebaResult) {
          example = tatoebaResult.sentence;
          translation = tatoebaResult.translation;
        } else {
          // Fallback sentence template translated
          const englishSentence = `I want to learn the word ${definition.toLowerCase() || 'this'}.`;
          example = await googleTranslate(englishSentence, 'en', 'vi');
          translation = englishSentence;
        }
      }

      try {
        const newCard = await db.createFlashcard({
          word,
          definition,
          category: category.trim(),
          example,
          translation
        });
        importedCards.push(newCard);
      } catch (err) {
        console.warn(`Word "${word}" already exists in category "${category}" or failed to save.`);
      }
    }

    return NextResponse.json({
      success: true,
      count: importedCards.length,
      cards: importedCards
    });
  } catch (err) {
    console.error('Error importing flashcards:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

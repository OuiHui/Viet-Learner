import { NextResponse } from 'next/server';
import https from 'https';
import { dialectDatabase } from '../../../lib/dialectDatabase';

function translateText(text, from = 'vi', to = 'en') {
  return new Promise((resolve, reject) => {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json && json[0]) {
            const translated = json[0].map(item => item[0]).join('');
            resolve(translated);
          } else {
            reject(new Error('Invalid response structure from translation service'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

function findDialectDifference(englishWord) {
  if (!englishWord) return null;
  const normalized = englishWord.toLowerCase().trim()
    .replace(/^(a|an|the)\s+/, '')
    .replace(/s$/, '');

  const match = dialectDatabase.find(entry => {
    return entry.keys.some(k => {
      const normalizedKey = k.toLowerCase().trim();
      return normalizedKey === normalized || normalizedKey === englishWord.toLowerCase().trim();
    });
  });

  return match || null;
}

function getTatoebaSentence(viWord) {
  return new Promise((resolve) => {
    const url = `https://tatoeba.org/en/api_v0/search?from=vie&to=eng&query=${encodeURIComponent(viWord)}&orphans=no&sort=relevance`;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 2000
    };
    
    const req = https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json && json.results && json.results.length > 0) {
            for (const result of json.results) {
              if (result.text && result.translations) {
                for (const transGroup of result.translations) {
                  for (const trans of transGroup) {
                    if (trans.lang === 'eng' && trans.text) {
                      return resolve({
                        sentence: result.text.trim(),
                        translation: trans.text.trim()
                      });
                    }
                  }
                }
              }
            }
          }
          resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
    });
    
    req.on('error', () => {
      resolve(null);
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

export async function POST(req) {
  try {
    const { text, source, target } = await req.json();
    if (!text) {
      return NextResponse.json({ error: 'Text parameter is required' }, { status: 400 });
    }

    const fromLang = source || 'vi';
    const toLang = target || 'en';

    const translatedText = await translateText(text, fromLang, toLang);
    
    let dialectDiff = null;
    if (fromLang === 'en' && toLang === 'vi') {
      const match = findDialectDifference(text);
      if (match) {
        dialectDiff = {
          hasDiff: true,
          northern: match.northern,
          southern: match.southern,
          category: match.category,
          notes: match.notes,
          contextSentence: match.contextSentence,
          contextTranslation: match.contextTranslation
        };
      }
    }

    let exampleSentence = null;
    let exampleTranslation = null;

    if (text.trim().split(/\s+/).length <= 5) {
      const cleanWord = (toLang === 'vi' ? translatedText : text)
        .replace(/^(cái|con|quả|trái|chiếc|đôi|bộ)\s+/i, '')
        .replace(/[.,!?;:"'()]/g, '')
        .trim();

      const tatoebaResult = await getTatoebaSentence(cleanWord);
      if (tatoebaResult) {
        exampleSentence = tatoebaResult.sentence;
        exampleTranslation = tatoebaResult.translation;
      } else {
        const englishWord = toLang === 'en' ? translatedText : text;
        const vietnameseWord = toLang === 'vi' ? translatedText : text;
        
        const templates = [
          `I want to learn more about [word].`,
          `Can you show me the [word]?`,
          `This [word] is very interesting.`,
          `I use this [word] every day.`
        ];
        const templateIndex = Math.abs(englishWord.length) % templates.length;
        const englishSentence = templates[templateIndex].replace('[word]', englishWord.toLowerCase());
        
        try {
          const translatedSentence = await translateText(englishSentence, 'en', 'vi');
          exampleSentence = translatedSentence;
          exampleTranslation = englishSentence;
        } catch (err) {
          exampleSentence = `Tôi muốn học từ "${vietnameseWord}" ngày hôm nay.`;
          exampleTranslation = `I want to learn the word "${englishWord}" today.`;
        }
      }
    }

    return NextResponse.json({
      translation: translatedText,
      dialectDiff,
      exampleSentence,
      exampleTranslation
    });
  } catch (err) {
    console.error('Translation error:', err);
    return NextResponse.json({ error: 'Translation failed: ' + err.message }, { status: 500 });
  }
}

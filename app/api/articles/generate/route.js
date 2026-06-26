import { NextResponse } from 'next/server';
import db from '../../../../lib/db';


export async function POST(req) {
  await db.connect();
  try {
    const { topic, level } = await req.json();
    if (!topic || !level) {
      return NextResponse.json({ error: 'topic and level are required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI generation failed: GEMINI_API_KEY is not configured.' }, { status: 500 });
    }

    let generatedData = null;

    // Call Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const prompt = `Write a short story or reading passage in Vietnamese on the topic "${topic}" tailored for a ${level} level language learner.
For ${level} level:
- Beginner: Use extremely simple grammar, basic vocabulary, short sentences.
- Intermediate: Use compound sentences, common expressions, standard difficulty.
- Advanced: Use rich vocabulary, formal tones, complex clauses, authentic news or literary style.

You must output a JSON object with this exact structure:
{
  "title": "A fitting title in Vietnamese (with English in parentheses)",
  "sentences": [
    { "text": "Vietnamese sentence", "translation": "English translation" }
  ],
  "vocab": [
    { "word": "vietnamese word or phrase", "definition": "English definition", "pronunciation": "Approximate pronunciation guide for English speakers" }
  ]
}
Ensure the "sentences" array contains between 4 and 8 sentences. The "vocab" array should contain 4 to 8 key vocabulary items from the passage. Do not include markdown formatting or wrappers outside of the JSON object.`;

    try {
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      });

      if (response.ok) {
        const resJson = await response.json();
        let responseText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
        if (responseText) {
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            responseText = jsonMatch[0];
          }
          generatedData = JSON.parse(responseText.trim());
        }
      } else {
        const errorText = await response.text();
        console.warn('Gemini API call failed, status:', response.status, errorText);
        throw new Error(`API returned ${response.status}`);
      }
    } catch (err) {
      console.error('Failed to parse Gemini response:', err);
      return NextResponse.json({ error: 'AI Generation failed. ' + err.message }, { status: 500 });
    }

    if (!generatedData) {
      return NextResponse.json({ error: 'AI Generation failed: No data was generated.' }, { status: 500 });
    }

    // Save generated article to the database
    const savedArticle = await db.createArticle({
      title: generatedData.title,
      level,
      sentences: generatedData.sentences,
      source: 'AI Generated'
    });

    // Auto-create flashcards for the generated vocabulary words so the user can study them
    if (generatedData.vocab && Array.isArray(generatedData.vocab)) {
      for (const item of generatedData.vocab) {
        try {
          // Find an example sentence from the article text that contains the word
          const matchedSentence = generatedData.sentences.find(s => 
            s.text.toLowerCase().includes(item.word.toLowerCase())
          );
          
          await db.createFlashcard({
            word: item.word,
            definition: `${item.definition} (${item.pronunciation})`,
            category: 'Context',
            example: matchedSentence ? matchedSentence.text : '',
            translation: matchedSentence ? matchedSentence.translation : ''
          });
        } catch (e) {
          // Ignore duplicates
        }
      }
    }

    return NextResponse.json(savedArticle);
  } catch (err) {
    console.error('Error generating article:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

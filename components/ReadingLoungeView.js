'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ARTICLES, DICTIONARY } from '../lib/articlesData';

export default function ReadingLoungeView({ savedWords, onVocabSaved, onMarkAsRead }) {
  const [activeLevel, setActiveLevel] = useState('Beginner');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [highlightedWord, setHighlightedWord] = useState(null);
  const [translatorState, setTranslatorState] = useState({
    isOpen: false,
    word: '',
    definition: '',
    pronunciation: '',
    contextSentence: '',
    contextTranslation: '',
  });
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const viewerContentRef = useRef(null);
  const audioRef = useRef(null);

  // Mark article read on open
  useEffect(() => {
    if (selectedArticle) {
      onMarkAsRead(selectedArticle.id);
    }
  }, [selectedArticle, onMarkAsRead]);

  // Check if current word is saved in database
  useEffect(() => {
    if (translatorState.word) {
      setIsSaved(savedWords.includes(translatorState.word.toLowerCase()));
    }
  }, [translatorState.word, savedWords]);

  const speakText = (text) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audioUrl = `/api/translate/tts?q=${encodeURIComponent(text)}`;
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.play().catch((err) => {
      console.warn('Google TTS failed, falling back to Web Speech synthesis:', err);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'vi-VN';
        const voices = window.speechSynthesis.getVoices();
        const viVoice = voices.find((v) => v.lang.startsWith('vi'));
        if (viVoice) {
          utterance.voice = viVoice;
        }
        window.speechSynthesis.speak(utterance);
      }
    });
  };

  const handleSelection = () => {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (
      text &&
      text.length > 1 &&
      selection.anchorNode &&
      viewerContentRef.current?.contains(selection.anchorNode)
    ) {
      // Find sentence context
      let sentence = text;
      let parent = selection.anchorNode.parentElement;
      while (parent && parent !== viewerContentRef.current) {
        if (parent.tagName === 'P') {
          sentence = parent.textContent;
          break;
        }
        parent = parent.parentElement;
      }
      translatePhrase(text, sentence);
    }
  };

  const alignWordInContext = (word, sentenceText) => {
    const phrases = Object.keys(DICTIONARY).filter(
      (k) => k.length > word.length && k.includes(word.toLowerCase())
    );
    for (const phrase of phrases) {
      if (sentenceText.toLowerCase().includes(phrase)) {
        return phrase;
      }
    }
    return word.toLowerCase();
  };

  const translatePhrase = async (phrase, sentenceText) => {
    const cleanPhrase = phrase.replace(/[.,!?;:"'()]/g, '').toLowerCase().trim();
    if (!cleanPhrase) return;
    await translateWord(cleanPhrase, sentenceText);
  };

  const translateWord = async (word, sentenceText) => {
    const contextWord = alignWordInContext(word, sentenceText);
    setHighlightedWord(contextWord);

    setTranslatorState({
      isOpen: true,
      word: contextWord,
      definition: 'Loading...',
      pronunciation: '[No guide]',
      contextSentence: sentenceText,
      contextTranslation: 'Translating...',
    });

    let entry = DICTIONARY[contextWord.toLowerCase()];
    if (!entry) {
      setIsTranslating(true);
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: contextWord.toLowerCase(), source: 'vi', target: 'en' }),
        });
        if (res.ok) {
          const data = await res.json();
          entry = {
            definition: data.translation,
            pronunciation: '[No guide]',
          };
        }
      } catch (err) {
        console.error('Translation error:', err);
      }
      setIsTranslating(false);
    }

    if (!entry) {
      entry = { definition: 'Unknown word', pronunciation: '[No guide]' };
    }

    // Try finding the sentence translation
    let sentenceTranslation = '';
    if (selectedArticle) {
      const sentenceObj = selectedArticle.sentences.find(
        (s) => s.text.toLowerCase().includes(sentenceText.toLowerCase()) || sentenceText.toLowerCase().includes(s.text.toLowerCase())
      );
      if (sentenceObj) {
        sentenceTranslation = sentenceObj.translation;
      }
    }

    setTranslatorState({
      isOpen: true,
      word: contextWord,
      definition: entry.definition,
      pronunciation: entry.pronunciation || '[No guide]',
      contextSentence: sentenceText,
      contextTranslation: sentenceTranslation || 'Sentence context translation',
    });
  };

  const saveToVocabulary = async () => {
    if (isSaved || !translatorState.word) return;
    try {
      const res = await fetch('/api/vocabulary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: translatorState.word.toLowerCase(),
          definition: translatorState.definition,
          contextSentence: translatorState.contextSentence,
          contextTranslation: translatorState.contextTranslation,
          source: `Reading: ${selectedArticle ? selectedArticle.title : 'Graded Article'}`,
          category: 'Context',
        }),
      });

      if (res.ok) {
        setIsSaved(true);
        if (onVocabSaved) {
          onVocabSaved();
        }
      } else {
        const err = await res.json();
        alert('Could not save word: ' + (err.error || 'Server error'));
      }
    } catch (err) {
      alert('Failed to save word: ' + err.message);
    }
  };

  const tokenizeSentence = (sentenceText) => {
    const phrases = Object.keys(DICTIONARY).sort((a, b) => b.length - a.length);
    const segments = [];
    let index = 0;

    const regexBoundary = /[^a-zA-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸđĐ]/;

    while (index < sentenceText.length) {
      let matched = false;

      for (const phrase of phrases) {
        const len = phrase.length;
        if (index + len <= sentenceText.length) {
          const sub = sentenceText.substring(index, index + len).toLowerCase();
          if (sub === phrase) {
            const prevChar = index > 0 ? sentenceText[index - 1] : ' ';
            const nextChar = index + len < sentenceText.length ? sentenceText[index + len] : ' ';

            if (regexBoundary.test(prevChar) && regexBoundary.test(nextChar)) {
              segments.push({
                text: sentenceText.substring(index, index + len),
                phraseKey: phrase,
              });
              index += len;
              matched = true;
              break;
            }
          }
        }
      }

      if (!matched) {
        let wordEnd = index;
        const regexAlpha = /[a-zA-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸđĐ]/;
        const isAlpha = regexAlpha.test(sentenceText[index]);

        if (isAlpha) {
          while (wordEnd < sentenceText.length && regexAlpha.test(sentenceText[wordEnd])) {
            wordEnd++;
          }
        } else {
          wordEnd++;
        }
        segments.push({
          text: sentenceText.substring(index, wordEnd),
          phraseKey: null,
        });
        index = wordEnd;
      }
    }

    return segments;
  };

  const renderSentenceText = (sentence) => {
    const segments = tokenizeSentence(sentence.text);
    const regexWord = /[a-zA-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸđĐ]/;

    return segments.map((segment, idx) => {
      const isWord = regexWord.test(segment.text);
      if (isWord) {
        const cleanWord = segment.text.replace(/[.,!?;:\"\'\-\(\)]/g, '').toLowerCase().trim();
        const saved = savedWords.includes(cleanWord);
        const highlighted = highlightedWord === cleanWord || highlightedWord === alignWordInContext(cleanWord, sentence.text);

        return (
          <span
            key={idx}
            className={`word-span ${saved ? 'saved' : ''} ${highlighted ? 'highlighted' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              // Prevent firing if user is selecting text
              if (window.getSelection().toString().trim().length > 0) {
                return;
              }
              translateWord(cleanWord, sentence.text);
            }}
          >
            {segment.text}
          </span>
        );
      } else {
        return <React.Fragment key={idx}>{segment.text}</React.Fragment>;
      }
    });
  };

  const filteredArticles = ARTICLES.filter((a) => a.level === activeLevel);

  return (
    <div className="page-section">
      {!selectedArticle ? (
        <div>
          <div className="level-filters">
            {['Beginner', 'Intermediate', 'Advanced'].map((level) => (
              <button
                key={level}
                className={`level-btn ${activeLevel === level ? 'active' : ''}`}
                onClick={() => setActiveLevel(level)}
              >
                {level}
              </button>
            ))}
          </div>

          <div className="article-selector">
            {filteredArticles.map((art) => (
              <div
                key={art.id}
                className="card-glass article-card"
                onClick={() => setSelectedArticle(art)}
              >
                <h3>{art.title}</h3>
                <div className="meta">
                  <span>📶 {art.level}</span>
                  <span>📝 {art.sentences.length} sentences</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <button
            className="btn btn-secondary article-back-btn"
            style={{ marginBottom: '20px' }}
            onClick={() => {
              setSelectedArticle(null);
              setHighlightedWord(null);
              setTranslatorState({ ...translatorState, isOpen: false });
            }}
          >
            &larr; Back to Articles
          </button>

          <div className="reading-layout">
            <div className="article-viewer">
              <h2 className="article-title">{selectedArticle.title}</h2>
              <div
                className="article-content"
                ref={viewerContentRef}
                onMouseUp={handleSelection}
                onTouchEnd={handleSelection}
              >
                {selectedArticle.sentences.map((sentence, idx) => (
                  <p key={idx} style={{ marginBottom: '16px' }}>
                    {renderSentenceText(sentence)}
                  </p>
                ))}
              </div>
            </div>

            {/* Translation sidebar panel */}
            <div className="card-glass translator-panel">
              {!translatorState.isOpen ? (
                <div className="translation-placeholder">
                  <span style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }}>👆</span>
                  Tap on any word in the article to view translations and play voice clips.
                </div>
              ) : (
                <div className="translation-result">
                  <div className="trans-word-header">
                    <span className="trans-word">{translatorState.word}</span>
                    <button
                      className="btn-audio"
                      title="Pronounce Word"
                      onClick={() => speakText(translatorState.word)}
                    >
                      🔊
                    </button>
                  </div>
                  <p className="trans-definition">{translatorState.definition}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Pronunciation: {translatorState.pronunciation}
                  </p>

                  <div className="trans-context">
                    <h5
                      style={{
                        fontSize: '0.8rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--text-secondary)',
                        marginBottom: '6px',
                      }}
                    >
                      Sentence Context
                    </h5>
                    <p style={{ fontWeight: 500, marginBottom: '4px' }}>
                      {translatorState.contextSentence}
                    </p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {translatorState.contextTranslation}
                    </p>
                  </div>

                  <button
                    className={`btn ${isSaved ? 'btn-secondary' : 'btn-primary'}`}
                    style={{ width: '100%', marginTop: '12px' }}
                    onClick={saveToVocabulary}
                    disabled={isSaved || isTranslating}
                  >
                    {isSaved ? 'Saved!' : 'Save to Vocab Context'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

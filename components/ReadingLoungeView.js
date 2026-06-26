'use client';

import React, { useState, useEffect, useRef } from 'react';
import { DICTIONARY } from '../lib/articlesData';

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

  // Dynamic articles state
  const [articles, setArticles] = useState([]);
  const [loadingArticles, setLoadingArticles] = useState(true);
  
  // Importer Panel state
  const [showImporter, setShowImporter] = useState(false);
  const [importTab, setImportTab] = useState('ai'); // 'ai' or 'news'
  const [aiTopic, setAiTopic] = useState('');
  const [aiLevel, setAiLevel] = useState('Beginner');
  const [newsFeed, setNewsFeed] = useState('https://vnexpress.net/rss/du-lich.rss');
  const [customNewsUrl, setCustomNewsUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState({ type: '', text: '' });

  // Fetch articles from API
  const fetchArticles = async () => {
    setLoadingArticles(true);
    try {
      const res = await fetch('/api/articles');
      if (res.ok) {
        const data = await res.json();
        setArticles(data);
      } else {
        console.error('Failed to fetch articles');
      }
    } catch (err) {
      console.error('Error fetching articles:', err);
    } finally {
      setLoadingArticles(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, []);

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

    const regexBoundary = /[^\p{L}\p{M}]/u;

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
        const regexAlpha = /[\p{L}\p{M}]/u;
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
    const regexWord = /[\p{L}\p{M}]/u;

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

  // AI Generator Submission
  const handleGenerateAI = async (e) => {
    e.preventDefault();
    if (!aiTopic.trim()) return;
    setIsImporting(true);
    setImportMessage({ type: '', text: '' });
    try {
      const res = await fetch('/api/articles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: aiTopic.trim(), level: aiLevel }),
      });
      if (res.ok) {
        const newArt = await res.json();
        setImportMessage({ type: 'success', text: `Successfully generated AI article: "${newArt.title}"!` });
        setAiTopic('');
        await fetchArticles(); // Refresh list
        setSelectedArticle(newArt); // View immediately
        setShowImporter(false);
      } else {
        const err = await res.json();
        setImportMessage({ type: 'error', text: err.error || 'AI generation failed.' });
      }
    } catch (err) {
      setImportMessage({ type: 'error', text: err.message });
    } finally {
      setIsImporting(false);
    }
  };

  // News Importer Submission
  const handleImportNews = async (e) => {
    e.preventDefault();
    const urlToScrape = customNewsUrl.trim() || newsFeed;
    if (!urlToScrape) return;
    setIsImporting(true);
    setImportMessage({ type: '', text: '' });
    try {
      const res = await fetch('/api/articles/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToScrape }),
      });
      if (res.ok) {
        const newArt = await res.json();
        setImportMessage({ type: 'success', text: `Successfully imported article: "${newArt.title}"!` });
        setCustomNewsUrl('');
        await fetchArticles(); // Refresh list
        setSelectedArticle(newArt); // View immediately
        setShowImporter(false);
      } else {
        const err = await res.json();
        setImportMessage({ type: 'error', text: err.error || 'News scrape failed.' });
      }
    } catch (err) {
      setImportMessage({ type: 'error', text: err.message });
    } finally {
      setIsImporting(false);
    }
  };

  const filteredArticles = articles.filter((a) => a.level === activeLevel);

  return (
    <div className="page-section">
      {!selectedArticle ? (
        <div>
          {/* Header Row with Filter & Import triggers */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div className="level-filters" style={{ marginBottom: 0 }}>
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

            <button
              className="btn btn-primary"
              onClick={() => {
                setShowImporter(!showImporter);
                setImportMessage({ type: '', text: '' });
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>{showImporter ? '✕ Close Panel' : '➕ Load New Content'}</span>
            </button>
          </div>

          {/* Collapsible Importer Panel */}
          {showImporter && (
            <div className="card-glass" style={{ padding: '20px', marginBottom: '24px', animation: 'fadeIn 0.3s ease-out' }}>
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '16px', gap: '16px' }}>
                <button
                  className={`level-btn ${importTab === 'ai' ? 'active' : ''}`}
                  style={{ background: 'none', borderBottom: importTab === 'ai' ? '2px solid var(--accent-primary)' : 'none', borderRadius: 0, paddingBottom: '8px' }}
                  onClick={() => setImportTab('ai')}
                >
                  🤖 AI Story Generator
                </button>
                <button
                  className={`level-btn ${importTab === 'news' ? 'active' : ''}`}
                  style={{ background: 'none', borderBottom: importTab === 'news' ? '2px solid var(--accent-primary)' : 'none', borderRadius: 0, paddingBottom: '8px' }}
                  onClick={() => setImportTab('news')}
                >
                  📰 VnExpress News Importer
                </button>
              </div>

              {importTab === 'ai' ? (
                <form onSubmit={handleGenerateAI}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    Generate a customized graded reading passage in Vietnamese on any topic. The AI will construct the story, translate it, and auto-populate key vocabulary list.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
                    <div style={{ flex: '1 1 250px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Topic or Idea</label>
                      <input
                        type="text"
                        placeholder="e.g., Coffee culture, Hanoi Train Street, Autumn weather"
                        value={aiTopic}
                        onChange={(e) => setAiTopic(e.target.value)}
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                        disabled={isImporting}
                      />
                    </div>
                    <div style={{ flex: '0 0 150px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Proficiency Level</label>
                      <select
                        value={aiLevel}
                        onChange={(e) => setAiLevel(e.target.value)}
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                        disabled={isImporting}
                      >
                        <option value="Beginner" style={{ background: '#222' }}>Beginner</option>
                        <option value="Intermediate" style={{ background: '#222' }}>Intermediate</option>
                        <option value="Advanced" style={{ background: '#222' }}>Advanced</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isImporting || !aiTopic.trim()}
                      style={{ padding: '11px 20px' }}
                    >
                      {isImporting ? 'Generating...' : '✨ Generate'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleImportNews}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    Load live, authentic news articles from Vietnam. We will fetch the contents, divide it into study paragraphs, and auto-translate sentences.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Select Live RSS Feed Channel</label>
                      <select
                        value={newsFeed}
                        onChange={(e) => setNewsFeed(e.target.value)}
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                        disabled={isImporting || !!customNewsUrl}
                      >
                        <option value="https://vnexpress.net/rss/du-lich.rss" style={{ background: '#222' }}>🏝️ Du lịch (Travel News)</option>
                        <option value="https://vnexpress.net/rss/gia-dinh.rss" style={{ background: '#222' }}>🍲 Ẩm thực & Đời sống (Family & Food)</option>
                        <option value="https://vnexpress.net/rss/the-gioi.rss" style={{ background: '#222' }}>🌐 Tin thế giới (World News)</option>
                        <option value="https://vnexpress.net/rss/giai-tri.rss" style={{ background: '#222' }}>🎭 Giải trí (Entertainment)</option>
                      </select>
                    </div>
                    <div style={{ alignSelf: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>— OR —</div>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Paste custom VnExpress article link</label>
                      <input
                        type="url"
                        placeholder="https://vnexpress.net/du-lich-viet-nam-..."
                        value={customNewsUrl}
                        onChange={(e) => setCustomNewsUrl(e.target.value)}
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                        disabled={isImporting}
                      />
                    </div>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isImporting}
                      style={{ alignSelf: 'flex-end', padding: '11px 20px' }}
                    >
                      {isImporting ? 'Importing & Translating...' : '📥 Import News'}
                    </button>
                  </div>
                </form>
              )}

              {/* Status messages */}
              {importMessage.text && (
                <div
                  style={{
                    marginTop: '16px',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    background: importMessage.type === 'success' ? 'rgba(46, 213, 115, 0.15)' : 'rgba(255, 71, 87, 0.15)',
                    border: importMessage.type === 'success' ? '1px solid rgba(46, 213, 115, 0.3)' : '1px solid rgba(255, 71, 87, 0.3)',
                    color: importMessage.type === 'success' ? '#2ed573' : '#ff4757',
                  }}
                >
                  {importMessage.text}
                </div>
              )}
            </div>
          )}

          {/* Articles list */}
          {loadingArticles ? (
            <div style={{ textAlign: 'center', padding: '40px', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
              Loading reading lounge materials...
            </div>
          ) : filteredArticles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '8px' }}>📖</span>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>No articles found for the "{activeLevel}" level.</p>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowImporter(true)}>
                Generate or load one now!
              </button>
            </div>
          ) : (
            <div className="article-selector">
              {filteredArticles.map((art) => (
                <div
                  key={art.id}
                  className="card-glass article-card"
                  onClick={() => setSelectedArticle(art)}
                  style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                >
                  <h3>{art.title}</h3>
                  <div className="meta">
                    <span>📶 {art.level}</span>
                    <span>📝 {art.sentences.length} sentences</span>
                    {art.source && <span style={{ opacity: 0.7 }}>🏷️ {art.source}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
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

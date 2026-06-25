'use client';

import React, { useState, useEffect, useRef } from 'react';

export default function TranslatorView({ savedWords, categories = [], onVocabSaved }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // States to track save operations
  const [localSavedStates, setLocalSavedStates] = useState({});
  const [savingStates, setSavingStates] = useState({});
  const [wordConfig, setWordConfig] = useState({});

  const audioRef = useRef(null);

  // Sync saved state when savedWords changes
  useEffect(() => {
    if (result) {
      const states = {};
      if (result.dialectDiff && result.dialectDiff.hasDiff) {
        states[result.dialectDiff.northern.toLowerCase()] = savedWords.includes(result.dialectDiff.northern.toLowerCase());
        states[result.dialectDiff.southern.toLowerCase()] = savedWords.includes(result.dialectDiff.southern.toLowerCase());
      } else {
        states[result.translation.toLowerCase()] = savedWords.includes(result.translation.toLowerCase());
      }
      setLocalSavedStates(states);
    }
  }, [result, savedWords]);

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

  const handleTranslate = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: searchQuery, source: 'en', target: 'vi' }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
      } else {
        const err = await res.json();
        setError(err.error || 'Translation failed.');
      }
    } catch (err) {
      setError('An error occurred during translation: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveWord = async (word, defaultDefinition, contextSentence, contextTranslation, isNorth, config) => {
    const wordKey = word.toLowerCase();
    if (localSavedStates[wordKey]) return;

    setSavingStates(prev => ({ ...prev, [wordKey]: true }));

    // Format definition to clarify dialect in study list
    const suffix = result?.dialectDiff?.hasDiff ? (isNorth ? ' (North)' : ' (South)') : '';
    const formattedDefinition = `${defaultDefinition}${suffix}`;

    try {
      const promises = [];
      
      if (config.saveToVocab) {
        promises.push(
          fetch('/api/vocabulary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              word: wordKey,
              definition: formattedDefinition,
              contextSentence,
              contextTranslation,
              source: 'English Translator',
              category: config.category
            }),
          })
        );
      }

      if (config.saveToFlashcard) {
        promises.push(
          fetch('/api/flashcards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              word: wordKey,
              definition: formattedDefinition,
              category: config.category,
              example: contextSentence,
              translation: contextTranslation
            }),
          })
        );
      }

      const responses = await Promise.all(promises);
      const allOk = responses.every(r => r.ok);

      if (allOk) {
        setLocalSavedStates(prev => ({ ...prev, [wordKey]: true }));
        if (onVocabSaved) {
          onVocabSaved(); // reload stats and list
        }
      } else {
        const failedResponse = responses.find(r => !r.ok);
        const err = await failedResponse.json();
        alert('Could not save card: ' + (err.error || 'Server error'));
      }
    } catch (err) {
      alert('Failed to save card: ' + err.message);
    } finally {
      setSavingStates(prev => ({ ...prev, [wordKey]: false }));
    }
  };

  // Helper for generic fallback sentences
  const generateFallbackSentence = (viWord, enWord) => {
    const wordClean = viWord.replace(/[.,!?;:"'()]/g, '').trim();
    return {
      sentence: `Tôi muốn học từ "${wordClean}" ngày hôm nay.`,
      translation: `I want to learn the word "${enWord}" today.`
    };
  };

  const renderSaveConfig = (word, isNorth, defaultCat) => {
    const wordKey = word.toLowerCase();
    const isSaved = localSavedStates[wordKey];
    const isSaving = savingStates[wordKey];
    
    // Get or initialize config for this word
    const config = wordConfig[wordKey] || {
      saveToVocab: true,
      saveToFlashcard: true,
      category: categories.includes(defaultCat) ? defaultCat : (categories[0] || 'Common Words')
    };

    const updateConfig = (field, value) => {
      setWordConfig(prev => ({
        ...prev,
        [wordKey]: {
          ...(prev[wordKey] || config),
          [field]: value
        }
      }));
    };

    if (isSaved) {
      return (
        <div className="save-status-success">
          <span>✓ Saved to Learner Stack!</span>
        </div>
      );
    }

    return (
      <div className="save-config-panel">
        <div className="save-config-row">
          <label className="save-checkbox-label">
            <input
              type="checkbox"
              checked={config.saveToVocab}
              onChange={(e) => updateConfig('saveToVocab', e.target.checked)}
            />
            <span>Add Vocab</span>
          </label>
          <label className="save-checkbox-label">
            <input
              type="checkbox"
              checked={config.saveToFlashcard}
              onChange={(e) => updateConfig('saveToFlashcard', e.target.checked)}
            />
            <span>Add Flashcard</span>
          </label>
        </div>

        <div className="save-config-row select-row">
          <span className="select-label">Category:</span>
          <select
            className="form-input select-deck"
            value={config.category}
            onChange={(e) => updateConfig('category', e.target.value)}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className={`btn-primary save-action-btn ${isNorth ? 'north-btn' : 'south-btn'}`}
          onClick={() => saveWord(
            word,
            searchQuery.trim(),
            result?.dialectDiff?.contextSentence || result?.exampleSentence || generateFallbackSentence(word, searchQuery).sentence,
            result?.dialectDiff?.contextTranslation || result?.exampleTranslation || generateFallbackSentence(word, searchQuery).translation,
            isNorth,
            config
          )}
          disabled={isSaving || (!config.saveToVocab && !config.saveToFlashcard)}
        >
          {isSaving ? 'Saving...' : `+ Add to Stack`}
        </button>
      </div>
    );
  };

  return (
    <div className="page-section">
      <div className="card-glass translator-input-card" style={{ padding: '30px', marginBottom: '30px' }}>
        <form onSubmit={handleTranslate} style={{ display: 'flex', gap: '15px', alignItems: 'stretch' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              className="form-input"
              style={{ width: '100%', paddingLeft: '45px', fontSize: '1.1rem' }}
              placeholder="🔍 Type an English word to translate..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={loading}
            />
            <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '1.2rem', opacity: 0.6 }}>
              🇬🇧
            </span>
          </div>
          <button type="submit" className="btn-primary" style={{ padding: '0 30px' }} disabled={loading || !searchQuery.trim()}>
            {loading ? 'Translating...' : 'Translate'}
          </button>
        </form>
      </div>

      {loading && (
        <div className="card-glass" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
          <div className="spinner" style={{ marginRight: '15px' }}></div>
          Analyzing dialect differences & translating...
        </div>
      )}

      {error && (
        <div className="card-glass" style={{ border: '1px solid var(--color-danger)', padding: '20px', color: 'var(--color-danger)', display: 'flex', gap: '10px' }}>
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="translator-result-wrapper fade-in">
          {result.dialectDiff && result.dialectDiff.hasDiff ? (
            <div className="card-glass dialect-container-card">
              <div className="dialect-badge-header">
                <span className="dialect-accent-tag">Dialect Variations</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Default Category: <strong>{result.dialectDiff.category}</strong>
                </span>
              </div>

              <div className="dialect-grid">
                {/* Northern Dialect Card */}
                <div className="dialect-card north">
                  <div className="dialect-card-header">
                    <span className="dialect-tag-north">North / Bắc</span>
                    <button
                      type="button"
                      className="btn-audio"
                      style={{ width: '32px', height: '32px', fontSize: '0.9rem' }}
                      onClick={() => speakText(result.dialectDiff.northern)}
                    >
                      🔊
                    </button>
                  </div>
                  <h2 className="dialect-word north-word">{result.dialectDiff.northern}</h2>
                  {renderSaveConfig(result.dialectDiff.northern, true, result.dialectDiff.category)}
                </div>

                {/* Southern Dialect Card */}
                <div className="dialect-card south">
                  <div className="dialect-card-header">
                    <span className="dialect-tag-south">South / Nam</span>
                    <button
                      type="button"
                      className="btn-audio"
                      style={{ width: '32px', height: '32px', fontSize: '0.9rem' }}
                      onClick={() => speakText(result.dialectDiff.southern)}
                    >
                      🔊
                    </button>
                  </div>
                  <h2 className="dialect-word south-word">{result.dialectDiff.southern}</h2>
                  {renderSaveConfig(result.dialectDiff.southern, false, result.dialectDiff.category)}
                </div>
              </div>

              {/* Shared Context Sentence */}
              <div className="dialect-sentence-box">
                <h4>Context Sentence (Southern-slanted by default)</h4>
                <p className="sentence-text">“{result.dialectDiff.contextSentence}”</p>
                <p className="sentence-translation">{result.dialectDiff.contextTranslation}</p>
              </div>

              {/* Explanatory Notes */}
              <div className="dialect-notes-box">
                <span className="note-icon">💡</span>
                <p className="note-text">{result.dialectDiff.notes}</p>
              </div>
            </div>
          ) : (
            /* Standard Translation Result */
            <div className="card-glass dialect-container-card" style={{ maxWidth: '640px', margin: '0 auto' }}>
              <div className="dialect-badge-header">
                <span className="dialect-accent-tag-standard">Standard Translation</span>
              </div>
              
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                  <h2 className="standard-word" style={{ fontSize: '2.5rem', color: 'var(--color-primary)', fontWeight: '700' }}>
                    {result.translation}
                  </h2>
                  <button
                    type="button"
                    className="btn-audio"
                    style={{ width: '38px', height: '38px', fontSize: '1rem' }}
                    onClick={() => speakText(result.translation)}
                  >
                    🔊
                  </button>
                </div>
                
                {(() => {
                  const sentence = result?.exampleSentence || generateFallbackSentence(result.translation, searchQuery).sentence;
                  const translation = result?.exampleTranslation || generateFallbackSentence(result.translation, searchQuery).translation;
                  return (
                    <>
                      <div className="dialect-sentence-box" style={{ marginTop: '25px', textAlign: 'left', marginBottom: '20px' }}>
                        <h4>Example Context Sentence</h4>
                        <p className="sentence-text">“{sentence}”</p>
                        <p className="sentence-translation">{translation}</p>
                      </div>
                      
                      <div style={{ maxWidth: '320px', margin: '0 auto' }}>
                        {renderSaveConfig(result.translation, false, 'Common Words')}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

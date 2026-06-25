'use client';

import React, { useState, useEffect, useRef } from 'react';

export default function DictionaryView({ vocabulary, onVocabDeleted }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const audioRef = useRef(null);
  const timeoutRef = useRef(null);

  // Clear confirmation timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

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

  const handleDeleteClick = async (vocabId, e) => {
    e.stopPropagation();

    if (confirmingDeleteId === vocabId) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setConfirmingDeleteId(null);

      try {
        const res = await fetch(`/api/vocabulary/${vocabId}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          onVocabDeleted();
        } else {
          const err = await res.json();
          alert('Failed to delete word: ' + (err.error || 'Server error'));
        }
      } catch (err) {
        alert('Failed to delete word: ' + err.message);
      }
    } else {
      setConfirmingDeleteId(vocabId);
      // Reset after 3 seconds
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setConfirmingDeleteId(null);
      }, 3000);
    }
  };

  // Helper to highlight the target word in context sentence
  const renderHighlightedSentence = (sentence, word) => {
    if (!sentence || !word) return sentence;
    const escapedWord = word.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');

    const parts = sentence.split(regex);
    const matches = sentence.match(regex);

    if (!matches) return sentence;

    return parts.reduce((acc, part, i) => {
      return (
        <>
          {acc}
          {part}
          {matches[i] && (
            <strong
              style={{
                color: 'var(--color-primary)',
                textShadow: '0 0 4px var(--color-primary-glow)',
              }}
            >
              {matches[i]}
            </strong>
          )}
        </>
      );
    }, null);
  };

  // Filter vocabulary based on search query
  const filteredVocabulary = vocabulary.filter(
    (item) =>
      item.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.definition.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.contextSentence.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="page-section">
      <div className="dict-search-wrapper" onClick={() => setConfirmingDeleteId(null)}>
        <input
          type="text"
          className="form-input"
          style={{ maxWidth: '480px' }}
          placeholder="🔍 Search saved words or context sentences..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="vocab-grid">
        {filteredVocabulary.length === 0 ? (
          <div
            className="card-glass"
            style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}
          >
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '12px' }}>📖</span>
            <p>{searchQuery ? 'No matching words found.' : 'Your dictionary is empty.'}</p>
            <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
              Go to the <strong>Reading Lounge</strong> and tap on words to save them in context!
            </p>
          </div>
        ) : (
          filteredVocabulary.map((vocab) => (
            <div
              key={vocab._id}
              className="card-glass vocab-card"
              onClick={() => setConfirmingDeleteId(null)}
            >
              <div className="vocab-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="vocab-word">
                    {vocab.word.charAt(0).toUpperCase() + vocab.word.slice(1)}
                  </span>
                  <button
                    className="btn-audio"
                    style={{ width: '32px', height: '32px', fontSize: '0.9rem' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      speakText(vocab.word);
                    }}
                  >
                    🔊
                  </button>
                </div>
                <span className="vocab-source-tag">{vocab.source || 'Context'}</span>
              </div>
              <p className="vocab-meaning">{vocab.definition}</p>
              <div className="vocab-context-box">
                <p className="vocab-sentence">
                  &ldquo;{renderHighlightedSentence(vocab.contextSentence, vocab.word)}&rdquo;
                </p>
                <p className="vocab-translation">{vocab.contextTranslation}</p>
              </div>
              <button
                className={`vocab-delete ${confirmingDeleteId === vocab._id ? 'confirming' : ''}`}
                onClick={(e) => handleDeleteClick(vocab._id, e)}
              >
                {confirmingDeleteId === vocab._id ? 'Confirm?' : '× Delete'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

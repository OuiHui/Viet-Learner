'use client';

import React, { useState, useEffect, useRef } from 'react';

export default function DictionaryView({ vocabulary, onVocabDeleted, setVocabulary }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  
  // Edit vocab state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingVocab, setEditingVocab] = useState({
    _id: '',
    word: '',
    definition: '',
    contextSentence: '',
    contextTranslation: '',
    source: 'Context',
  });
  const [isTranslating, setIsTranslating] = useState({
    word: false,
    definition: false,
    contextSentence: false,
    contextTranslation: false,
  });

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

      const backupVocab = [...vocabulary];
      // Optimistic delete
      setVocabulary(prev => prev.filter(v => v._id !== vocabId));

      try {
        const res = await fetch(`/api/vocabulary/${vocabId}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          onVocabDeleted();
        } else {
          setVocabulary(backupVocab);
          const err = await res.json();
          alert('Failed to delete word: ' + (err.error || 'Server error'));
        }
      } catch (err) {
        setVocabulary(backupVocab);
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
      }, 15000);

    }
  };

  const handleEditClick = (vocab, e) => {
    e.stopPropagation();
    setConfirmingDeleteId(null);
    setEditingVocab({
      _id: vocab._id,
      word: vocab.word,
      definition: vocab.definition,
      contextSentence: vocab.contextSentence,
      contextTranslation: vocab.contextTranslation,
      source: vocab.source || 'Context',
    });
    setIsEditModalOpen(true);
  };

  const translateField = async (sourceField, targetField, sourceLang, targetLang) => {
    const textToTranslate = editingVocab[sourceField];
    if (!textToTranslate || !textToTranslate.trim()) return;

    setIsTranslating((prev) => ({ ...prev, [sourceField]: true }));
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToTranslate.trim(), source: sourceLang, target: targetLang }),
      });
      if (res.ok) {
        const data = await res.json();
        setEditingVocab((prev) => ({
          ...prev,
          [targetField]: data.translation
        }));
      }
    } catch (err) {
      console.error('Translation helper failed:', err);
    }
    setIsTranslating((prev) => ({ ...prev, [sourceField]: false }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingVocab.word.trim() || !editingVocab.definition.trim() || !editingVocab.contextSentence.trim() || !editingVocab.contextTranslation.trim()) return;

    const backupVocab = [...vocabulary];
    // Optimistic state update
    setVocabulary(prev => prev.map(v => v._id === editingVocab._id ? { ...v, ...editingVocab } : v));
    setIsEditModalOpen(false);

    try {
      const res = await fetch(`/api/vocabulary/${editingVocab._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: editingVocab.word.trim(),
          definition: editingVocab.definition.trim(),
          contextSentence: editingVocab.contextSentence.trim(),
          contextTranslation: editingVocab.contextTranslation.trim(),
          source: editingVocab.source,
        }),
      });
      if (res.ok) {
        onVocabDeleted(); // reload lists and sync with flashcards
      } else {
        setVocabulary(backupVocab);
        const err = await res.json();
        alert(err.error || 'Failed to update vocabulary');
      }
    } catch (err) {
      setVocabulary(backupVocab);
      alert('Failed to update vocabulary: ' + err.message);
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
              </div>
              <p className="vocab-meaning">{vocab.definition}</p>
              <div className="vocab-context-box">
                <p className="vocab-sentence">
                  &ldquo;{renderHighlightedSentence(vocab.contextSentence, vocab.word)}&rdquo;
                </p>
                <p className="vocab-translation">{vocab.contextTranslation}</p>
              </div>
              <button
                type="button"
                className="vocab-edit"
                onClick={(e) => handleEditClick(vocab, e)}
              >
                ✏️ Edit
              </button>
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

      {/* Edit Vocabulary Modal */}
      <div className={`modal-overlay ${isEditModalOpen ? 'open' : ''}`}>
        <div className="modal-content">
          <button className="modal-close" onClick={() => setIsEditModalOpen(false)}>
            &times;
          </button>
          <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: '20px' }}>Edit Vocabulary Item</h2>
          <form onSubmit={handleEditSubmit}>
            <div className="form-group">
              <label htmlFor="editVocabWord" className="form-label">
                Vietnamese Word
              </label>
              <div className="input-group-row">
                <input
                  type="text"
                  id="editVocabWord"
                  className="form-input"
                  placeholder="e.g. Chào buổi sáng"
                  value={editingVocab.word}
                  onChange={(e) => setEditingVocab({ ...editingVocab, word: e.target.value })}
                  required
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-inline-translate"
                  onClick={() => translateField('word', 'definition', 'vi', 'en')}
                  disabled={isTranslating.word}
                >
                  {isTranslating.word ? '...' : '✨ to English'}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="editVocabDef" className="form-label">
                English Translation
              </label>
              <div className="input-group-row">
                <input
                  type="text"
                  id="editVocabDef"
                  className="form-input"
                  placeholder="e.g. Good morning"
                  value={editingVocab.definition}
                  onChange={(e) => setEditingVocab({ ...editingVocab, definition: e.target.value })}
                  required
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-inline-translate"
                  onClick={() => translateField('definition', 'word', 'en', 'vi')}
                  disabled={isTranslating.definition}
                >
                  {isTranslating.definition ? '...' : '✨ to Vietnamese'}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="editVocabSentence" className="form-label">
                Context Sentence
              </label>
              <div className="input-group-row">
                <input
                  type="text"
                  id="editVocabSentence"
                  className="form-input"
                  placeholder="e.g. Chào buổi sáng cô ạ."
                  value={editingVocab.contextSentence}
                  onChange={(e) => setEditingVocab({ ...editingVocab, contextSentence: e.target.value })}
                  required
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-inline-translate"
                  onClick={() => translateField('contextSentence', 'contextTranslation', 'vi', 'en')}
                  disabled={isTranslating.contextSentence}
                >
                  {isTranslating.contextSentence ? '...' : '✨ to English'}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="editVocabTranslation" className="form-label">
                Sentence Translation
              </label>
              <div className="input-group-row">
                <input
                  type="text"
                  id="editVocabTranslation"
                  className="form-input"
                  placeholder="e.g. Good morning, ma'am."
                  value={editingVocab.contextTranslation}
                  onChange={(e) => setEditingVocab({ ...editingVocab, contextTranslation: e.target.value })}
                  required
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-inline-translate"
                  onClick={() => translateField('contextTranslation', 'contextSentence', 'en', 'vi')}
                  disabled={isTranslating.contextTranslation}
                >
                  {isTranslating.contextTranslation ? '...' : '✨ to Vietnamese'}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
              Save Changes
            </button>
          </form>
        </div>
      </div>

    </div>
  );
}

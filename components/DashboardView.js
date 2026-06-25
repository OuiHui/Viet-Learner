'use client';

import React from 'react';

export default function DashboardView({ progress, vocabCount, flashcardCount, onNavigate }) {
  // Generate recommendations dynamically based on vocabulary count
  const recommendations = [];

  if (vocabCount === 0) {
    recommendations.push({
      title: 'Start your first Graded Reading',
      desc: 'Learn words directly from real context sentences. Tap any word to translate it instantly!',
      icon: '📚',
      action: 'reading',
    });
  } else {
    recommendations.push({
      title: 'Review your Vocabulary in Context',
      desc: `Test yourself on the ${vocabCount} words you've collected from news articles.`,
      icon: '🧠',
      action: 'dictionary',
    });
  }

  recommendations.push({
    title: 'Review Flashcards Decks',
    desc: 'Check customized flashcard decks filtered by food, family, and custom categories.',
    icon: '🎴',
    action: 'flashcards',
  });

  return (
    <div className="page-section">
      <div className="stats-grid">
        <div className="card-glass stat-card">
          <div className="stat-icon">🔥</div>
          <div>
            <div className="stat-value">{progress?.streak || 0} days</div>
            <div className="stat-label">Daily Streak</div>
          </div>
        </div>
        <div className="card-glass stat-card">
          <div className="stat-icon">📖</div>
          <div>
            <div className="stat-value">{vocabCount}</div>
            <div className="stat-label">Words in Context</div>
          </div>
        </div>
        <div className="card-glass stat-card">
          <div className="stat-icon">🎴</div>
          <div>
            <div className="stat-value">{flashcardCount}</div>
            <div className="stat-label">Flashcard Count</div>
          </div>
        </div>
      </div>

      <div className="dashboard-sections">
        <div className="card-glass">
          <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>
            Study Recommendations
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
            Based on your activity, here is what you should try next:
          </p>
          <div className="recommendations-list">
            {recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="rec-item"
                onClick={() => onNavigate(rec.action)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontSize: '1.75rem' }}>{rec.icon}</span>
                  <div>
                    <h4 style={{ fontWeight: 600, marginBottom: '2px' }}>{rec.title}</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {rec.desc}
                    </p>
                  </div>
                </div>
                <span style={{ color: 'var(--color-primary)', fontWeight: 'bold', fontSize: '1.25rem' }}>
                  &rarr;
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          className="card-glass"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '3rem', marginBottom: '12px' }}>🇻🇳</span>
          <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>Xin Chào!</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Welcome to your Vietnamese study deck. Build a daily habit by completing reading exercises.
          </p>
        </div>
      </div>
    </div>
  );
}

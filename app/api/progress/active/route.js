import { NextResponse } from 'next/server';
import db from '../../../../lib/db';

export async function POST() {
  await db.connect();
  try {
    const progress = await db.getProgress();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let updatedStreak = progress.streak || 0;
    
    if (progress.lastActive) {
      const lastActiveDate = new Date(progress.lastActive);
      const lastActiveDay = new Date(
        lastActiveDate.getFullYear(),
        lastActiveDate.getMonth(),
        lastActiveDate.getDate()
      );

      const diffTime = Math.abs(today - lastActiveDay);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        updatedStreak += 1;
      } else if (diffDays > 1) {
        updatedStreak = 1;
      }
      // If diffDays is 0, they already checked in today, keep the same streak
    } else {
      updatedStreak = 1;
    }

    const updated = await db.saveProgress({
      streak: updatedStreak,
      lastActive: now.toISOString()
    });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Student long-term memory + flashcards.
 * Storage lives in client_kv:
 *   client_id = student email
 *   keys      = 'flashcards' | 'memory'
 *
 * Both are simple lists; UI handles ordering, filtering, and review state.
 */

export type Flashcard = {
  id: string;
  question: string;
  answer: string;
  subject: string;          // 'Spanish', 'History', 'Math', etc.
  source?: string;          // tutor id where it came from
  reviewedCount: number;
  knownCount: number;       // times marked "I knew this"
  createdAt: string;
  lastReviewedAt?: string;
};

export type MemoryItem = {
  id: string;
  title: string;            // short label
  body: string;             // the saved content
  subject?: string;
  source?: string;
  tags: string[];
  createdAt: string;
};

export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

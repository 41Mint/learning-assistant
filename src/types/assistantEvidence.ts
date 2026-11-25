import { reviewRecord, reviewText } from './logReview.ts';

export const EVIDENCE_TITLE_LIMIT = 200;
export const EVIDENCE_EXCERPT_LIMIT = 1200;

export interface EvidenceSource {
  kind: 'practice' | 'log' | 'entry' | 'code';
  title: string;
  excerpt: string;
}

export interface EvidenceFinding {
  text: string;
  source: number;
  quote: string;
}

export function readEvidenceSource(value: unknown): EvidenceSource | undefined {
  if (!reviewRecord(value)) return;
  const { kind, title, excerpt } = value;
  if ((kind === 'log' || kind === 'entry' || kind === 'code' || kind === 'practice')
    && typeof title === 'string' && title.trim() && title.length <= EVIDENCE_TITLE_LIMIT
    && typeof excerpt === 'string' && excerpt.length <= EVIDENCE_EXCERPT_LIMIT) {
    return { kind, title, excerpt };
  }
}

export function readEvidenceFinding(value: unknown, sources: EvidenceSource[]): EvidenceFinding | undefined {
  if (!reviewRecord(value) || typeof value.source !== 'number' || !Number.isInteger(value.source)) return;
  const source = sources[value.source - 1];
  const text = reviewText(value.text, 320);
  const quote = typeof value.quote === 'string' ? value.quote.trim() : '';
  if (text && quote && quote.length <= 180 && source?.excerpt.includes(quote)) {
    return { text, source: value.source, quote };
  }
}

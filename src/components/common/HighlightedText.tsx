import { splitMatches, textMatches } from '../../utils/searchMatches';

export default function HighlightedText({ text, words }: { text: string; words?: string[] }) {
  if (!words?.length) return text;
  return splitMatches(text, textMatches(text, words)).map((part, index) => part.matched
    ? <mark key={index} className="search-match">{part.text}</mark> : part.text);
}

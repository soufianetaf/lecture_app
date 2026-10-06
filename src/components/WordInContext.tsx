import { splitOnWord } from '../services/vocabulary/sentence';

/** Phrase du livre avec le mot appris mis en valeur. */
export default function WordInContext({ context, word }: { context: string; word: string }) {
  return (
    <>
      {splitOnWord(context, word).map((part, i) =>
        part.match ? (
          <mark key={i} className="rounded bg-amber-300/40 px-0.5 font-semibold text-inherit">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

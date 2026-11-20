interface QuizTilesProps {
  compact?: boolean;
}

const TILES = [
  { letter: 'Q', bg: 'bg-white', text: 'text-[#141414]', tilt: '-rotate-6' },
  { letter: 'U', bg: 'bg-[#8ABBB9]', text: 'text-white', tilt: '-rotate-2 translate-y-0.5' },
  { letter: 'I', bg: 'bg-white', text: 'text-[#141414]', tilt: 'rotate-1' },
  { letter: 'Z', bg: 'bg-[#EA4C2A]', text: 'text-white', tilt: 'rotate-6 translate-y-0.5' },
];

export function QuizTiles({ compact = false }: QuizTilesProps) {
  return (
    <div className="inline-flex items-center gap-1.5 select-none" aria-hidden="true">
      {TILES.map((tile) => (
        <span
          key={tile.letter}
          className={`inline-flex items-center justify-center rounded-xl border-2 border-[#141414] shadow-[0_3px_0_#141414] font-display font-bold transition-transform ${tile.bg} ${tile.text} ${tile.tilt} ${
            compact ? 'h-9 w-9 text-lg' : 'h-12 w-12 sm:h-14 sm:w-14 text-2xl sm:text-3xl'
          }`}
        >
          {tile.letter}
        </span>
      ))}
    </div>
  );
}

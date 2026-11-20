import { Star } from 'lucide-react';

interface AvatarProps {
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  rank?: number | null;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-20 w-20 text-xl',
};

export function Avatar({ firstName, lastName, avatarUrl, size = 'md', rank }: AvatarProps) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  const ringClass =
    rank === 1
      ? 'ring-4 ring-[#FFFDF2] border-2 border-[#141414]'
      : rank === 2
        ? 'ring-3 ring-[#8ABBB9] border-2 border-[#141414]'
        : rank === 3
          ? 'ring-3 ring-[#EA4C2A] border-2 border-[#141414]'
          : 'border-2 border-[#141414]/20';

  const bgTone =
    rank === 1
      ? 'bg-[#FFF3C4] text-[#141414]'
      : rank === 2
        ? 'bg-[#D7ECEB] text-[#141414]'
        : rank === 3
          ? 'bg-[#FADAD2] text-[#141414]'
          : 'bg-[#E9EFEF] text-[#141414]';

  return (
    <div className="relative inline-flex shrink-0">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={`${firstName} ${lastName}`}
          referrerPolicy="no-referrer"
          className={`${SIZE_CLASSES[size]} rounded-2xl object-cover ${ringClass} bg-white`}
        />
      ) : (
        <div
          aria-hidden="true"
          className={`${SIZE_CLASSES[size]} rounded-2xl ${bgTone} ${ringClass} flex items-center justify-center font-display font-bold tracking-wide select-none`}
        >
          {initials}
        </div>
      )}

      {rank && rank <= 3 && (size === 'lg' || size === 'xl') && (
        <span
          aria-hidden="true"
          className={`absolute -bottom-2 left-1/2 -translate-x-1/2 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#141414] shadow-sm ${
            rank === 1
              ? 'bg-[#F4C424] text-[#141414]'
              : rank === 2
                ? 'bg-[#8ABBB9] text-[#141414]'
                : 'bg-[#EA4C2A] text-white'
          }`}
        >
          <Star className="h-3 w-3 fill-current" />
        </span>
      )}
    </div>
  );
}

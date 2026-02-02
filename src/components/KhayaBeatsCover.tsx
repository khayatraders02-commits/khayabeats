import { useMemo } from 'react';
import { cn } from '@/lib/utils';

// Generate consistent gradient based on string hash
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Curated gradient pairs for KHAYABEATS branding
const BRAND_GRADIENTS = [
  { from: 'hsl(280, 70%, 40%)', to: 'hsl(320, 80%, 50%)' },  // Purple-Pink
  { from: 'hsl(200, 80%, 35%)', to: 'hsl(240, 70%, 45%)' },  // Blue-Indigo
  { from: 'hsl(340, 75%, 45%)', to: 'hsl(20, 90%, 50%)' },   // Rose-Orange
  { from: 'hsl(160, 70%, 35%)', to: 'hsl(200, 80%, 40%)' },  // Teal-Blue
  { from: 'hsl(260, 65%, 45%)', to: 'hsl(300, 70%, 40%)' },  // Violet-Purple
  { from: 'hsl(30, 90%, 45%)', to: 'hsl(350, 80%, 50%)' },   // Orange-Red
  { from: 'hsl(180, 70%, 35%)', to: 'hsl(220, 75%, 45%)' },  // Cyan-Blue
  { from: 'hsl(320, 70%, 45%)', to: 'hsl(280, 65%, 50%)' },  // Pink-Purple
];

interface KhayaBeatsCoverProps {
  title: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showWatermark?: boolean;
  variant?: 'waves' | 'circles' | 'lines' | 'mesh';
}

export const KhayaBeatsCover = ({
  title,
  subtitle,
  size = 'md',
  className,
  showWatermark = true,
  variant = 'waves',
}: KhayaBeatsCoverProps) => {
  const gradientIndex = hashString(title) % BRAND_GRADIENTS.length;
  const gradient = BRAND_GRADIENTS[gradientIndex];

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-32 h-32',
    lg: 'w-40 h-40',
    xl: 'w-full aspect-square',
  };

  const textSizes = {
    sm: { title: 'text-[8px]', subtitle: 'text-[6px]', watermark: 'text-[4px]' },
    md: { title: 'text-xs', subtitle: 'text-[10px]', watermark: 'text-[6px]' },
    lg: { title: 'text-sm', subtitle: 'text-xs', watermark: 'text-[8px]' },
    xl: { title: 'text-lg', subtitle: 'text-sm', watermark: 'text-xs' },
  };

  return (
    <div
      className={cn(
        sizeClasses[size],
        'relative rounded-xl overflow-hidden',
        className
      )}
      style={{
        background: `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)`,
      }}
    >
      {/* Abstract pattern overlay */}
      <AbstractPattern variant={variant} />
      
      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-2">
        {subtitle && (
          <span className={cn(textSizes[size].subtitle, 'text-white/70 font-medium truncate')}>
            {subtitle}
          </span>
        )}
        <span className={cn(textSizes[size].title, 'text-white font-bold truncate')}>
          {title}
        </span>
      </div>

      {/* KHAYABEATS Watermark */}
      {showWatermark && (
        <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5">
          <div className="w-1 h-1 rounded-full bg-white/50" />
          <span className={cn(textSizes[size].watermark, 'text-white/50 font-bold')}>
            KB
          </span>
        </div>
      )}
    </div>
  );
};

// Abstract pattern overlays
const AbstractPattern = ({ variant }: { variant: 'waves' | 'circles' | 'lines' | 'mesh' }) => {
  const patterns = {
    waves: (
      <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path
          d="M0 60 Q 25 40, 50 60 T 100 60 L 100 100 L 0 100 Z"
          fill="white"
        />
        <path
          d="M0 70 Q 30 50, 60 70 T 100 70 L 100 100 L 0 100 Z"
          fill="white"
          opacity="0.5"
        />
        <path
          d="M0 80 Q 35 65, 70 80 T 100 80 L 100 100 L 0 100 Z"
          fill="white"
          opacity="0.3"
        />
      </svg>
    ),
    circles: (
      <svg className="absolute inset-0 w-full h-full opacity-15" viewBox="0 0 100 100">
        <circle cx="20" cy="20" r="15" fill="white" />
        <circle cx="70" cy="30" r="25" fill="white" opacity="0.5" />
        <circle cx="40" cy="70" r="20" fill="white" opacity="0.3" />
        <circle cx="80" cy="80" r="12" fill="white" opacity="0.4" />
      </svg>
    ),
    lines: (
      <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 100">
        <line x1="0" y1="20" x2="100" y2="40" stroke="white" strokeWidth="1" />
        <line x1="0" y1="40" x2="100" y2="55" stroke="white" strokeWidth="1.5" opacity="0.7" />
        <line x1="0" y1="60" x2="100" y2="70" stroke="white" strokeWidth="2" opacity="0.5" />
        <line x1="0" y1="80" x2="100" y2="85" stroke="white" strokeWidth="2.5" opacity="0.3" />
      </svg>
    ),
    mesh: (
      <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 100 100">
        <defs>
          <pattern id="mesh" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 10" stroke="white" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#mesh)" />
      </svg>
    ),
  };

  return patterns[variant];
};

// Pre-built cover components for common use cases
export const PlaylistCover = ({ name, trackCount }: { name: string; trackCount?: number }) => (
  <KhayaBeatsCover
    title={name}
    subtitle={trackCount ? `${trackCount} tracks` : undefined}
    size="lg"
    variant="waves"
  />
);

export const ArtistMixCover = ({ artistName }: { artistName: string }) => (
  <KhayaBeatsCover
    title={`${artistName} Mix`}
    subtitle="KHAYABEATS"
    size="lg"
    variant="circles"
  />
);

export const DailyMixCover = ({ number }: { number: number }) => (
  <KhayaBeatsCover
    title={`Daily Mix ${number}`}
    subtitle="Made for you"
    size="lg"
    variant="lines"
  />
);

export const RadioCover = ({ basedOn }: { basedOn: string }) => (
  <KhayaBeatsCover
    title={`${basedOn} Radio`}
    subtitle="Endless music"
    size="lg"
    variant="mesh"
  />
);

export default KhayaBeatsCover;

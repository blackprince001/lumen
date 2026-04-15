import { useTheme } from '@/lib/theme';

interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 40, className }: LogoProps) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  // Paper card theme colors — light vs dark variants
  const colors = dark ? {
    rim:      '#FDFDFD',
    lat1:     '#FDFDFD',
    lat2:     '#FDFDFD',
    lat3:     '#FDFDFD',
    lat4:     '#FDFDFD',
    lon1:     '#FDFDFD',
    lon2:     '#FDFDFD',
    lon3:     '#FDFDFD',
    lon4:     '#FDFDFD',
    axis1:    '#4CFFA9',
    axis2:    '#3C91E6',
    axis3:    '#E45B3C',
    shaft:    ['#E45B3C', '#ff7a5c'],
    arrow:    ['#4CFFA9', '#2ECC80'],
    label:    '#4CFFA9',
    dot1:     '#3C91E6',
    dot2:     '#E45B3C',
  } : {
    rim:      '#FDFDFD',
    lat1:     '#FDFDFD',
    lat2:     '#FDFDFD',
    lat3:     '#FDFDFD',
    lat4:     '#FDFDFD',
    lon1:     '#FDFDFD',
    lon2:     '#FDFDFD',
    lon3:     '#FDFDFD',
    lon4:     '#FDFDFD',
    axis1:    '#4CFFA9',
    axis2:    '#3C91E6',
    axis3:    '#E45B3C',
    shaft:    ['#E45B3C', '#c0392b'],
    arrow:    ['#4CFFA9', '#1DB870'],
    label:    '#553c9a',
    dot1:     '#3C91E6',
    dot2:     '#E45B3C',
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 500 500"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Papers logo"
    >
      <defs>
        <linearGradient id="vShaft" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor={colors.shaft[1]} />
          <stop offset="50%"  stopColor={colors.shaft[0]} />
          <stop offset="100%" stopColor={colors.shaft[1]} />
        </linearGradient>
        <linearGradient id="hShaft" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor={colors.arrow[0]} />
          <stop offset="100%" stopColor={colors.arrow[1]} />
        </linearGradient>
      </defs>

      {/* Sphere grid — each ring a different theme color */}
      <g fill="none" strokeWidth="1.2" opacity="0.85">
        <circle cx="250" cy="250" r="180" stroke={colors.rim} strokeWidth="1.8" />
        {/* Latitudes */}
        <ellipse cx="250" cy="250" rx="180" ry="65"  stroke={colors.lat1} />
        <ellipse cx="250" cy="170" rx="160" ry="40"  stroke={colors.lat2} />
        <ellipse cx="250" cy="330" rx="160" ry="40"  stroke={colors.lat2} />
        <ellipse cx="250" cy="110" rx="110" ry="25"  stroke={colors.lat3} />
        <ellipse cx="250" cy="390" rx="110" ry="25"  stroke={colors.lat3} />
        {/* Longitudes */}
        <ellipse cx="250" cy="250" rx="60"  ry="180" stroke={colors.lon1} />
        <ellipse cx="250" cy="250" rx="120" ry="180" stroke={colors.lon2} />
        <ellipse cx="250" cy="250" rx="180" ry="180" stroke={colors.lon3} transform="rotate(45, 250, 250) scale(0.3, 1)" />
        <ellipse cx="250" cy="250" rx="180" ry="180" stroke={colors.lon4} transform="rotate(-45, 250, 250) scale(0.3, 1)" />
      </g>

      {/* Axis lines — each a different accent */}
      <g strokeWidth="1.5" opacity="0.7">
        <line x1="250" y1="70"  x2="250" y2="430" stroke={colors.axis1} />
        <line x1="120" y1="310" x2="380" y2="190" stroke={colors.axis2} />
        <line x1="120" y1="190" x2="380" y2="310" stroke={colors.axis3} />
      </g>

      {/* Vertical arrow — coral */}
      <g>
        <rect x="246" y="100" width="8" height="150" fill={`url(#vShaft)`} />
        <path d="M 235 110 L 250 70 L 265 110 Z" fill={colors.shaft[0]} />
      </g>

      {/* Horizontal arrow — mint */}
      <g transform="rotate(25, 250, 250)">
        <rect x="250" y="246" width="130" height="10" fill={`url(#hShaft)`} />
        <path d="M 375 240 L 405 251 L 375 262 Z" fill={colors.arrow[0]} />
      </g>

      {/* Labels */}
      <g fontFamily="Arial, sans-serif" fontSize="24" fontWeight="bold">
        <text x="238" y="55"  fill={colors.arrow[0]}>|0⟩</text>
        <text x="238" y="465" fill={colors.shaft[0]}>|1⟩</text>
        <text x="85"  y="345" fill={colors.axis2}>|x⟩</text>
        <text x="405" y="330" fill={colors.label}>|y⟩</text>
      </g>

      {/* Detail dots */}
      <circle cx="250" cy="205" r="6"   fill={colors.dot1} />
      <circle cx="250" cy="250" r="2.5" fill={colors.dot2} />
    </svg>
  );
}

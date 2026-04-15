export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="Papers logo">
      <defs>
        <linearGradient id="vShaft" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#c0392b" />
          <stop offset="50%" stopColor="#E45B3C" />
          <stop offset="100%" stopColor="#c0392b" />
        </linearGradient>
        <linearGradient id="hShaft" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4CFFA9" />
          <stop offset="100%" stopColor="#1DB870" />
        </linearGradient>
      </defs>
      <g fill="none" strokeWidth="1.2" opacity="0.85">
        <circle cx="250" cy="250" r="180" stroke="#FDFDFD" strokeWidth="1.8" />
        <ellipse cx="250" cy="250" rx="180" ry="65" stroke="#FDFDFD" />
        <ellipse cx="250" cy="170" rx="160" ry="40" stroke="#FDFDFD" />
        <ellipse cx="250" cy="330" rx="160" ry="40" stroke="#FDFDFD" />
        <ellipse cx="250" cy="110" rx="110" ry="25" stroke="#FDFDFD" />
        <ellipse cx="250" cy="390" rx="110" ry="25" stroke="#FDFDFD" />
        <ellipse cx="250" cy="250" rx="60" ry="180" stroke="#FDFDFD" />
        <ellipse cx="250" cy="250" rx="120" ry="180" stroke="#FDFDFD" />
        <ellipse cx="250" cy="250" rx="180" ry="180" stroke="#FDFDFD" transform="rotate(45, 250, 250) scale(0.3, 1)" />
        <ellipse cx="250" cy="250" rx="180" ry="180" stroke="#FDFDFD" transform="rotate(-45, 250, 250) scale(0.3, 1)" />
      </g>
      <g strokeWidth="1.5" opacity="0.7">
        <line x1="250" y1="70" x2="250" y2="430" stroke="#4CFFA9" />
        <line x1="120" y1="310" x2="380" y2="190" stroke="#3C91E6" />
        <line x1="120" y1="190" x2="380" y2="310" stroke="#E45B3C" />
      </g>
      <g>
        <rect x="246" y="100" width="8" height="150" fill="url(#vShaft)" />
        <path d="M 235 110 L 250 70 L 265 110 Z" fill="#E45B3C" />
      </g>
      <g transform="rotate(25, 250, 250)">
        <rect x="250" y="246" width="130" height="10" fill="url(#hShaft)" />
        <path d="M 375 240 L 405 251 L 375 262 Z" fill="#4CFFA9" />
      </g>
      <g fontFamily="Arial, sans-serif" fontSize="24" fontWeight="bold">
        <text x="238" y="55" fill="#4CFFA9">|0⟩</text>
        <text x="238" y="465" fill="#E45B3C">|1⟩</text>
        <text x="85" y="345" fill="#3C91E6">|x⟩</text>
        <text x="405" y="330" fill="#553c9a">|y⟩</text>
      </g>
      <circle cx="250" cy="205" r="6" fill="#3C91E6" />
      <circle cx="250" cy="250" r="2.5" fill="#E45B3C" />
    </svg>
  );
}

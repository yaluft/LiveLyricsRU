interface Props {
  name: 'play' | 'pause' | 'prev' | 'next' | 'search' | 'volume';
  size?: number;
}

/**
 * Inline SVG for the controls that must always be legible. The decorative
 * glyphs elsewhere (★ ✂ ↻ ⚙) are safe in system fonts; the transport symbols
 * are not — ⏸/⏭ fall back to tofu boxes on several platforms.
 */
export function Icon({ name, size = 16 }: Props): JSX.Element {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'currentColor',
    'aria-hidden': true,
    focusable: false as const,
  };

  switch (name) {
    case 'play':
      return (
        <svg {...common}>
          <path d="M8 5.5v13a1 1 0 0 0 1.53.85l10.2-6.5a1 1 0 0 0 0-1.7L9.53 4.65A1 1 0 0 0 8 5.5Z" />
        </svg>
      );
    case 'pause':
      return (
        <svg {...common}>
          <rect x="6.5" y="5" width="4" height="14" rx="1.3" />
          <rect x="13.5" y="5" width="4" height="14" rx="1.3" />
        </svg>
      );
    case 'prev':
      return (
        <svg {...common}>
          <rect x="5" y="5.5" width="2.4" height="13" rx="1.2" />
          <path d="M19 6.4v11.2a1 1 0 0 1-1.54.84l-8.4-5.6a1 1 0 0 1 0-1.68l8.4-5.6A1 1 0 0 1 19 6.4Z" />
        </svg>
      );
    case 'next':
      return (
        <svg {...common}>
          <rect x="16.6" y="5.5" width="2.4" height="13" rx="1.2" />
          <path d="M5 6.4v11.2a1 1 0 0 0 1.54.84l8.4-5.6a1 1 0 0 0 0-1.68l-8.4-5.6A1 1 0 0 0 5 6.4Z" />
        </svg>
      );
    case 'search':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="6" />
          <path d="m15.6 15.6 3.4 3.4" />
        </svg>
      );
    case 'volume':
      return (
        <svg {...common}>
          <path d="M4 9.5h3.2L11.4 6a.8.8 0 0 1 1.3.63v10.74a.8.8 0 0 1-1.3.63L7.2 14.5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z" />
          <path
            d="M15.8 8.6a4.6 4.6 0 0 1 0 6.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

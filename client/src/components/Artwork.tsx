import { useState, type ReactNode } from 'react';
import { useT } from '../state/settings';

interface ArtworkProps {
  src?: string;
  alt?: string;
  /** Size/shape class, e.g. `row__art`. Composed on top of the `.art` placeholder. */
  className?: string;
  /** When present the artwork becomes a button (search results, queue rows). */
  onClick?: () => void;
  /** Native tooltip — the discography grid labels covers this way. */
  title?: string;
  /** Accessible name for the button form. */
  ariaLabel?: string;
  /** Placeholder-only caption, kept for the artist photo slot. */
  children?: ReactNode;
}

/**
 * Thumbnail with a graceful fallback: CDN artwork URLs from yt-dlp go stale, so a
 * failed load drops back to the `.art` gradient placeholder instead of a broken image.
 */
export function Artwork(props: ArtworkProps): JSX.Element {
  const t = useT();
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  // Comparing against the failed URL (rather than a boolean) resets automatically
  // when the component is reused for a different track.
  const usable = props.src && props.src !== failedSrc ? props.src : null;
  const className = props.className ? `art ${props.className}` : 'art';

  const body = usable ? (
    <img
      className="art__img"
      src={usable}
      alt={props.alt ?? t('artworkAlt')}
      loading="lazy"
      onError={() => setFailedSrc(usable)}
    />
  ) : (
    props.children ?? null
  );

  if (props.onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={props.onClick}
        title={props.title}
        aria-label={props.ariaLabel}
      >
        {body}
      </button>
    );
  }

  return (
    <div className={className} title={props.title}>
      {body}
    </div>
  );
}

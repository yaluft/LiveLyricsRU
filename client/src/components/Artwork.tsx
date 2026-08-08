interface Props {
  url?: string | null;
  className: string;
  alt?: string;
  onClick?: () => void;
  ariaLabel?: string;
}

/** A track/album art slot: the real thumbnail when we have one, the existing
 * striped placeholder otherwise. `className` carries the size/shape variant
 * (e.g. `stage__art`, `row__art`) shared with the placeholder's own styling.
 * With `onClick`, renders as a button (some rows use the art itself as the
 * play target) — a `background-image` on the button rather than a nested
 * `<img>`, so it stays the single flex item the row's CSS already expects. */
export function Artwork({ url, className, alt = '', onClick, ariaLabel }: Props): JSX.Element {
  if (onClick) {
    return (
      <button
        type="button"
        className={`art ${className}`}
        onClick={onClick}
        aria-label={ariaLabel}
        style={url ? { backgroundImage: `url("${url}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      />
    );
  }
  if (!url) return <div className={`art ${className}`} />;
  return <img className={`art ${className}`} src={url} alt={alt} loading="lazy" />;
}

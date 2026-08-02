import { useEffect, useState } from 'react';

interface Props {
  src?: string;
  className: string;
  as?: 'div' | 'button';
  onClick?: () => void;
  'aria-label'?: string;
  title?: string;
  children?: JSX.Element | string | null;
}

/** Renders `.art` (the striped placeholder) with a real image layered on top when `src` loads. */
export function Thumb({
  src,
  className,
  as = 'div',
  children,
  ...rest
}: Props): JSX.Element {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const content =
    src && !failed ? (
      <img className="art__img" src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
    ) : (
      (children ?? null)
    );

  if (as === 'button') {
    return (
      <button type="button" className={`art ${className}`} {...rest}>
        {content}
      </button>
    );
  }
  return (
    <div className={`art ${className}`} {...rest}>
      {content}
    </div>
  );
}

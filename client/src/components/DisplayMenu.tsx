import { useEffect, useRef } from 'react';
import { useSettings, useT } from '../state/settings';
import { Slider } from './Slider';

interface Props {
  onClose: () => void;
}

export function DisplayMenu({ onClose }: Props): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const t = useT();
  const showTranslit = useSettings((s) => s.showTranslit);
  const showTranslation = useSettings((s) => s.showTranslation);
  const lyricBlur = useSettings((s) => s.lyricBlur);
  const set = useSettings((s) => s.set);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    // Deferred so the click that opened the menu doesn't immediately close it.
    const id = setTimeout(() => document.addEventListener('mousedown', onDown));
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="display-menu" ref={ref}>
      <span className="label">{t('displaySection')}</span>
      <button
        type="button"
        className="display-menu__row"
        onClick={() => set('showTranslit', !showTranslit)}
      >
        <span>{t('showTranslit')}</span>
        <span className={`switch switch--sm${showTranslit ? ' is-on' : ''}`} />
      </button>
      <button
        type="button"
        className="display-menu__row"
        onClick={() => set('showTranslation', !showTranslation)}
      >
        <span>{t('showTranslation')}</span>
        <span className={`switch switch--sm${showTranslation ? ' is-on' : ''}`} />
      </button>
      <div className="slider-row">
        <span>{t('lyricBlur')}</span>
        <Slider
          value={lyricBlur}
          min={0}
          max={40}
          step={1}
          label={t('lyricBlur')}
          onChange={(next) => set('lyricBlur', next)}
        />
        <span className="value">{lyricBlur}px</span>
      </div>
    </div>
  );
}

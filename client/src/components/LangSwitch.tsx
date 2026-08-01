import type { Lang } from '../i18n';
import { useSettings } from '../state/settings';

const OPTIONS: { id: Lang; label: string }[] = [
  { id: 'ru', label: 'RU' },
  { id: 'en', label: 'EN' },
  { id: 'both', label: 'RU+EN' },
];

interface Props {
  /** Renders a single pill that cycles languages — for headers with no room. */
  compact?: boolean;
}

export function LangSwitch({ compact }: Props): JSX.Element {
  const lang = useSettings((s) => s.lang);
  const set = useSettings((s) => s.set);

  if (compact) {
    const index = OPTIONS.findIndex((o) => o.id === lang);
    const current = OPTIONS[index] ?? OPTIONS[0]!;
    const nextOption = OPTIONS[(index + 1) % OPTIONS.length]!;
    return (
      <button
        type="button"
        className="langswitch langswitch--compact"
        onClick={() => set('lang', nextOption.id)}
        aria-label={`Язык: ${current.label}`}
      >
        {current.label}
      </button>
    );
  }

  return (
    <div className="langswitch" role="group" aria-label="Язык интерфейса">
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`langswitch__btn${lang === option.id ? ' is-active' : ''}`}
          onClick={() => set('lang', option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

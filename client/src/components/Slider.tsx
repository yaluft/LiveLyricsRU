interface Props {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  label: string;
  className?: string;
}

/**
 * Range input with the filled track the design shows. Native `input[range]`
 * has no fill, so it is painted as a gradient stop at the current value.
 */
export function Slider({ value, min, max, step, onChange, label, className }: Props): JSX.Element {
  const percent = ((value - min) / (max - min)) * 100;
  return (
    <input
      className={`slider${className ? ` ${className}` : ''}`}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={label}
      onChange={(event) => onChange(Number(event.target.value))}
      style={{
        background: `linear-gradient(90deg, var(--accent) ${percent}%, rgba(120,215,255,.16) ${percent}%)`,
      }}
    />
  );
}

import { WAVE_PRESETS, WAVE_THEMES } from '@lyrika/shared';
import type { LyricSourceId, WavePreset } from '@lyrika/shared';
import type { Lang } from '../i18n';
import { useSettings, useT } from '../state/settings';
import { Slider } from './Slider';
import type { LayoutId } from '../state/settings';

const PRESET_LABEL = {
  calm: 'waveCalm',
  surf: 'waveSurf',
  night: 'waveNight',
  lagoon: 'waveLagoon',
} as const;

const SOURCE_LABEL = {
  lrclib: 'sourceLrclib',
  netease: 'sourceNetease',
  genius: 'sourceGenius',
  custom: 'sourceCustom',
  ai: 'aiSection',
} as const;

const SOURCE_NOTE: Record<LyricSourceId, 'sourceSynced' | 'sourceUntimed' | 'sourceUnset'> = {
  lrclib: 'sourceSynced',
  netease: 'sourceSynced',
  genius: 'sourceUntimed',
  custom: 'sourceUnset',
  ai: 'sourceUntimed',
};

const LANGS: { id: Lang; key: 'langRu' | 'langEn' | 'langBoth' }[] = [
  { id: 'ru', key: 'langRu' },
  { id: 'en', key: 'langEn' },
  { id: 'both', key: 'langBoth' },
];

const LAYOUTS: { id: LayoutId; key: 'layoutStage' | 'layoutStudio'; hint: 'layoutStageHint' | 'layoutStudioHint' }[] = [
  { id: 'stage', key: 'layoutStage', hint: 'layoutStageHint' },
  { id: 'studio', key: 'layoutStudio', hint: 'layoutStudioHint' },
];

export function SettingsView(): JSX.Element {
  const t = useT();
  const s = useSettings();

  return (
    <section className="view scroll-y">
      <header className="view__head">
        <h1 className="view__title">{t('settingsTitle')}</h1>
      </header>

      <section className="card">
        <span className="label">{t('bgSection')}</span>
        <div className="presets">
          {WAVE_PRESETS.map((preset: WavePreset) => (
            <button
              key={preset}
              type="button"
              className={`preset${s.wavePreset === preset ? ' is-active' : ''}`}
              style={{
                background: `linear-gradient(180deg, ${WAVE_THEMES[preset].fog}, ${WAVE_THEMES[preset].surface})`,
              }}
              onClick={() => s.set('wavePreset', preset)}
            >
              <span>{t(PRESET_LABEL[preset])}</span>
            </button>
          ))}
        </div>

        <div className="stack stack--tight">
          <div className="slider-row">
            <span>{t('waveHeight')}</span>
            <Slider
              value={s.waveHeight}
              min={0}
              max={1}
              step={0.01}
              label={t('waveHeight')}
              onChange={(next) => s.set('waveHeight', next)}
            />
            <span className="value">{s.waveHeight.toFixed(2)}</span>
          </div>
          <div className="slider-row">
            <span>{t('reactivity')}</span>
            <Slider
              value={s.reactivity}
              min={0}
              max={1}
              step={0.01}
              label={t('reactivity')}
              onChange={(next) => s.set('reactivity', next)}
            />
            <span className="value">{s.reactivity.toFixed(2)}</span>
          </div>
          <div className="slider-row">
            <span>{t('lyricBlur')}</span>
            <Slider
              value={s.lyricBlur}
              min={0}
              max={40}
              step={1}
              label={t('lyricBlur')}
              onChange={(next) => s.set('lyricBlur', next)}
            />
            <span className="value">{s.lyricBlur}px</span>
          </div>
        </div>

        <button type="button" className="toggle-row" onClick={() => s.set('ecoMode', !s.ecoMode)}>
          <span>{t('ecoMode')}</span>
          <span className={`switch${s.ecoMode ? ' is-on' : ''}`} />
        </button>
      </section>

      <section className="card">
        <span className="label">{t('layoutSection')}</span>
        <div className="layouts">
          {LAYOUTS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`layoutcard${s.layout === option.id ? ' is-active' : ''}`}
              onClick={() => s.set('layout', option.id)}
            >
              <span className="layoutcard__name">{t(option.key)}</span>
              <span className="layoutcard__hint">{t(option.hint)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <span className="label">{t('sourcesSection')}</span>
        <div className="stack stack--tight">
          {s.sources.map((source, index) => (
            <div className={`source${source.enabled ? '' : ' is-off'}`} key={source.id}>
              <div className="source__order">
                <button
                  type="button"
                  className="source__move"
                  disabled={index === 0}
                  onClick={() => s.moveSource(source.id, -1)}
                  aria-label="Выше"
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="source__move"
                  disabled={index === s.sources.length - 1}
                  onClick={() => s.moveSource(source.id, 1)}
                  aria-label="Ниже"
                >
                  ▼
                </button>
              </div>
              <span className="mono source__rank">{index + 1}</span>
              <span className="source__name">{t(SOURCE_LABEL[source.id])}</span>
              <span className="mono source__note">{t(SOURCE_NOTE[source.id])}</span>
              <button
                type="button"
                className={`switch switch--sm${source.enabled ? ' is-on' : ''}`}
                onClick={() => s.toggleSource(source.id)}
                aria-label={t(SOURCE_LABEL[source.id])}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="card card--accent">
        <div className="card__head">
          <span className="card__icon">✦</span>
          <span className="card__title">{t('aiSection')}</span>
          <button
            type="button"
            className={`switch switch--sm${s.aiEnabled ? ' is-on' : ''}`}
            onClick={() => s.set('aiEnabled', !s.aiEnabled)}
            aria-label={t('aiSection')}
          />
        </div>
        <span className="card__body">{t('aiBlurb')}</span>
        <div className="chiprow">
          <button
            type="button"
            className={`chip${s.aiAuto ? ' is-active' : ''}`}
            onClick={() => s.set('aiAuto', !s.aiAuto)}
          >
            {t('aiAuto')}
          </button>
          <button
            type="button"
            className={`chip${s.aiTranslit ? ' is-active' : ''}`}
            onClick={() => s.set('aiTranslit', !s.aiTranslit)}
          >
            {t('aiTranslit')}
          </button>
          <button
            type="button"
            className={`chip${s.aiTranslation ? ' is-active' : ''}`}
            onClick={() => s.set('aiTranslation', !s.aiTranslation)}
          >
            {t('aiTranslation')}
          </button>
          <button
            type="button"
            className={`chip${s.aiShare ? ' is-active' : ''}`}
            onClick={() => s.set('aiShare', !s.aiShare)}
          >
            {t('aiShare')}
          </button>
        </div>
        <span className="card__note mono">{t('simulatedBadge')}</span>
      </section>

      <section className="card">
        <span className="label">{t('langSection')}</span>
        <div className="chiprow">
          {LANGS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`btn${s.lang === option.id ? ' is-active' : ''}`}
              onClick={() => s.set('lang', option.id)}
            >
              {t(option.key)}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <span className="label">{t('displaySection')}</span>
        <button
          type="button"
          className="toggle-row"
          onClick={() => s.set('showTranslit', !s.showTranslit)}
        >
          <span>{t('showTranslit')}</span>
          <span className={`switch${s.showTranslit ? ' is-on' : ''}`} />
        </button>
        <button
          type="button"
          className="toggle-row"
          onClick={() => s.set('showTranslation', !s.showTranslation)}
        >
          <span>{t('showTranslation')}</span>
          <span className={`switch${s.showTranslation ? ' is-on' : ''}`} />
        </button>
      </section>
    </section>
  );
}

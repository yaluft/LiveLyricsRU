import { usePlayer } from '../state/player';
import { useLibrary } from '../state/library';
import { useSettings, useT } from '../state/settings';
import type { ViewId } from '../state/ui';
import { useUi } from '../state/ui';
import { LangSwitch } from './LangSwitch';
import { Icon } from './Icon';

interface NavItem {
  id: ViewId;
  icon: string;
  key: 'navNowPlaying' | 'navQueue' | 'navVocabulary' | 'navClips' | 'navSession' | 'navSettings';
  count?: number;
}

export function Sidebar(): JSX.Element {
  const t = useT();
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const openSearch = useUi((s) => s.openSearch);

  const queueLength = usePlayer((s) => s.queue.length);
  const recents = usePlayer((s) => s.recents);
  const playTrack = usePlayer((s) => s.playTrack);
  const wordCount = useLibrary((s) => s.words.length);
  const layout = useSettings((s) => s.layout);
  const setSetting = useSettings((s) => s.set);

  const items: NavItem[] = [
    { id: 'now', icon: '▶', key: 'navNowPlaying' },
    { id: 'queue', icon: '☰', key: 'navQueue', count: queueLength },
    { id: 'vocabulary', icon: '★', key: 'navVocabulary', count: wordCount },
    { id: 'clips', icon: '✂', key: 'navClips' },
    { id: 'session', icon: '✦', key: 'navSession' },
    { id: 'settings', icon: '⚙', key: 'navSettings' },
  ];

  return (
    <aside className="rail">
      <div className="rail__head">
        <div className="rail__brand">
          <span className="rail__logo">{t('appName')}</span>
          <LangSwitch />
        </div>
        <button type="button" className="rail__search" onClick={openSearch}>
          <Icon name="search" size={14} />
          <span>{t('searchPlaceholder')}</span>
        </button>
      </div>

      <nav className="rail__nav">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`rail__item${view === item.id ? ' is-active' : ''}`}
            onClick={() => setView(item.id)}
          >
            <span className="rail__icon" aria-hidden>
              {item.icon}
            </span>
            <span className="rail__label">{t(item.key)}</span>
            {item.count ? <span className="rail__count mono">{item.count}</span> : null}
          </button>
        ))}
      </nav>

      <div className="rail__recent">
        <span className="label">{t('navRecent')}</span>
        <div className="rail__recentlist scroll-y">
          {recents.length === 0 ? (
            <span className="rail__hint">—</span>
          ) : (
            recents.slice(0, 6).map((track) => (
              <button
                key={track.id}
                type="button"
                className="rail__track"
                onClick={() => void playTrack(track)}
              >
                <div className="art rail__trackart" />
                <div className="rail__trackmeta">
                  <span className="rail__tracktitle">{track.title}</span>
                  <span className="rail__trackartist">{track.artist}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <button
        type="button"
        className="btn rail__layout"
        onClick={() => setSetting('layout', layout === 'studio' ? 'stage' : 'studio')}
      >
        ▦ {t('layoutStage')}
      </button>
    </aside>
  );
}

import { useEffect } from 'react';
import { MOBILE_QUERY, useMediaQuery } from './hooks';
import { ClipComposer } from './components/ClipComposer';
import { Landing } from './components/Landing';
import { MobileShell } from './components/MobileShell';
import { OceanBackground } from './components/OceanBackground';
import { Visualizer } from './components/Visualizer';
import { FieldLinesBackground } from './components/FieldLinesBackground';
import { RefractionBackground } from './components/RefractionBackground';
import { FractureBackground } from './components/FractureBackground';
import { NeuralBackground } from './components/NeuralBackground';
import { SearchOverlay } from './components/SearchOverlay';
import { StageLayout } from './components/StageLayout';
import { StudioLayout } from './components/StudioLayout';
import { Toasts } from './components/Toasts';
import { useLibrary } from './state/library';
import { usePlayer } from './state/player';
import { useSettings } from './state/settings';
import { useUi } from './state/ui';

function useGlobalKeys(): void {
  const toggle = usePlayer((s) => s.toggle);
  const seek = usePlayer((s) => s.seek);
  const openSearch = useUi((s) => s.openSearch);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.isContentEditable)) return;

      if (event.code === 'Space') {
        event.preventDefault();
        toggle();
      }
      if (event.key === '/') {
        event.preventDefault();
        openSearch();
      }
      if (event.key === 'ArrowLeft') seek(Math.max(0, usePlayer.getState().position - 5));
      if (event.key === 'ArrowRight') seek(usePlayer.getState().position + 5);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, seek, openSearch]);
}

export function App(): JSX.Element {
  const layout = useSettings((s) => s.layout);
  const bgMode = useSettings((s) => s.bgMode);
  const track = usePlayer((s) => s.track);
  const searchOpen = useUi((s) => s.searchOpen);
  const clipOpen = useUi((s) => s.clipComposerOpen);
  const view = useUi((s) => s.view);
  const loadLibrary = useLibrary((s) => s.load);
  const isMobile = useMediaQuery(MOBILE_QUERY);

  useGlobalKeys();

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  const showLanding = !track && view === 'now' && !isMobile;

  return (
    <div className="app">
      {bgMode === 'visualizer' ? (
        <Visualizer />
      ) : bgMode === 'fieldlines' ? (
        <FieldLinesBackground />
      ) : bgMode === 'refraction' ? (
        <RefractionBackground />
      ) : bgMode === 'fracture' ? (
        <FractureBackground />
      ) : bgMode === 'neural' ? (
        <NeuralBackground />
      ) : (
        <OceanBackground />
      )}

      <div className="app__content">
        {isMobile ? (
          <MobileShell />
        ) : showLanding ? (
          <Landing />
        ) : layout === 'studio' ? (
          <StudioLayout />
        ) : (
          <StageLayout />
        )}
      </div>

      {searchOpen ? <SearchOverlay /> : null}
      {clipOpen ? <ClipComposer /> : null}
      <Toasts />
    </div>
  );
}

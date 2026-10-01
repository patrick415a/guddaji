import { useEffect, useRef, useState } from "react";
import "./assets/sass/index.scss";
import "./assets/sass/panels.scss";
import "./assets/sass/theme.scss";
import { THEME_CONFIG, readSavedTheme } from "./config/themeConfig.js";
import { WorldExperience } from "./world/WorldExperience.js";
import { VIEWPORT_CONFIG } from "./config/worldConfig.js";
import { TouchControls } from "./TouchControls.jsx";
import { TopBar } from "./TopBar.jsx";
import { SOUND_CONFIG } from './config/soundConfig.js';
import { useBackgroundMusic } from './useBackgroundMusic.js';

function App() {
  const canvasRef = useRef(null);
  const [theme, setTheme] = useState(readSavedTheme);
  const initialTheme = useRef(theme);
  const worldRef = useRef(null);
  const hintRef = useRef(null);
  const startRef = useRef(false);
  const [started, setStarted] = useState(false);
  const music = useBackgroundMusic();
  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState("");
  const [interactionHint, setInteractionHint] = useState(null);
  const [panel, setPanel] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState(SOUND_CONFIG.volume);
  const [graphicsAuto, setGraphicsAuto] = useState(true);
  const [graphicsPreset, setGraphicsPreset] = useState('medium');
  const [graphicsLevel, setGraphicsLevel] = useState(0);
  const [worldSession, setWorldSession] = useState(0);
  const graphicsMode = graphicsAuto ? 'auto' : graphicsPreset;
  const graphicsModeRef = useRef(graphicsMode);
  graphicsModeRef.current = graphicsMode;

  useEffect(() => {
    worldRef.current?.setTheme(theme);
    try { localStorage.setItem(THEME_CONFIG.storageKey, theme); } catch { /* 저장 불가 시에도 전환은 동작합니다. */ }
  }, [theme]);

  useEffect(() => {
    worldRef.current?.sound.setSettings(soundEnabled, soundVolume);
  }, [soundEnabled, soundVolume]);

  useEffect(() => {
    worldRef.current?.setGraphicsMode(graphicsMode);
  }, [graphicsMode]);

  useEffect(() => {
    worldRef.current?.input.setEnabled(started && !panel && !isLoading && !error);
  }, [started, panel, isLoading, error]);

  useEffect(() => {
    // 일부 인앱 브라우저가 새로고침 시 문서를 BFCache에서 복원하는 경우에도
    // 플레이 상태를 유지하지 않고 시작 화면으로 돌아갑니다.
    const resetRestoredPage = (event) => {
      if (!event.persisted) return;
      startRef.current = false;
      setStarted(false);
      setPanel(null);
      setInteractionHint(null);
      setLoadProgress(0);
      setIsLoading(true);
      setWorldSession(value => value + 1);
    };
    window.addEventListener('pageshow', resetRestoredPage);
    return () => window.removeEventListener('pageshow', resetRestoredPage);
  }, []);

  useEffect(() => {
    let readyTimer;
    const world = new WorldExperience(canvasRef.current, {
      theme: initialTheme.current,
      graphicsMode: graphicsModeRef.current,
      onQualityChange: ({ level }) => setGraphicsLevel(level),
      onLoadProgress: setLoadProgress,
      onReady: () => {
        // 로딩 완료 후 시작 버튼을 표시합니다.
        readyTimer = window.setTimeout(() => setIsLoading(false), 400);
      },
      onError: (loadError) => {
        setError(loadError.message || "월드를 불러오지 못했습니다.");
        setIsLoading(false);
        console.error(loadError);
      },
      onInteractionChange: setInteractionHint,
      // 3D 오브젝트 좌표를 따라 이동하며 React 전체를 매 프레임 갱신하지 않습니다.
      onInteractionPosition: (position) => {
        const hint = hintRef.current;
        if (!hint) return;
        hint.style.visibility = position ? 'visible' : 'hidden';
        if (position) {
          hint.style.left = `${position.x}px`;
          hint.style.top = `${position.y}px`;
        }
      },
      onOpenPanel: setPanel,
    });

    worldRef.current = world;
    world.input.setEnabled(false);
    world.init();

    return () => {
      window.clearTimeout(readyTimer);
      worldRef.current = null;
      world.dispose();
    };
  }, [worldSession]);

  function startJourney(withSound) {
    if (isLoading || error || startRef.current) return;
    startRef.current = true;
    setSoundEnabled(withSound);
    worldRef.current?.sound.setSettings(withSound, soundVolume);
    if (withSound) {
      // 클릭 처리 안에서 즉시 재생 요청해야 모바일에서도 허용됩니다.
      music.toggle();
      worldRef.current?.sound.unlock();
    }
    setStarted(true);
    canvasRef.current?.focus({ preventScroll: true });
  }

  function restartJourney() {
    if (music.playing || music.pending) music.toggle();
    startRef.current = false;
    setStarted(false);
    setPanel(null);
    setInteractionHint(null);
    setError("");
    setLoadProgress(0);
    setIsLoading(true);
    setWorldSession(value => value + 1);
  }

  return (
    <main className="experience" data-theme={theme} style={{ "--world-max-width": `${VIEWPORT_CONFIG.maxWidth}px` }}>
      <div className="world-frame">
      <canvas ref={canvasRef} className="experience__canvas" tabIndex={-1} />
      </div>
      {started && !isLoading && !error && (
        <>
        <TopBar theme={theme} onThemeChange={() => setTheme(value => value === "dark" ? "light" : "dark")} music={music} panel={panel} onPanelChange={setPanel} onRestart={restartJourney} graphicsAuto={graphicsAuto} onGraphicsAutoChange={setGraphicsAuto} graphicsPreset={graphicsPreset} onGraphicsPresetChange={setGraphicsPreset} graphicsLevel={graphicsLevel} soundEnabled={soundEnabled} onSoundChange={setSoundEnabled} soundVolume={soundVolume} onSoundVolumeChange={setSoundVolume} />
        {!panel && <TouchControls
          onMove={(x, y) => worldRef.current?.input.setTouchAxes(x, y)}
          onRun={(active) => worldRef.current?.input.setTouchRunning(active)}
          onJump={() => worldRef.current?.input.queueJump()}
          onInteract={() => worldRef.current?.input.queueInteraction()}
          interactionHint={interactionHint}
        />}
        </>
      )}

      {!started && !error && <div className="loading-screen">
        <img
          className="loading-screen__background"
          src={`/images/opening/${theme}-opening-background.png`}
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          decoding="async"
        />
        <div className="loading-screen__content">
        <img
          className="loading-screen__logo"
          src={`/images/opening/${theme}-opening-logo.png`}
          alt="구따지 A LITTLE JOURNEY"
          decoding="async"
        />
        {/* 완료 후에는 진행 표시를 숨기고 시작 버튼만 표시합니다. */}
        {isLoading && loadProgress < 100 && <>
        <p>여행을 준비하고 있어요</p>
        <div className="loading-screen__progress" role="progressbar" aria-label="여행지 로딩" aria-valuemin={0} aria-valuemax={100} aria-valuenow={loadProgress}>
          <span style={{ width: `${loadProgress}%` }} />
        </div>
        <span className="loading-screen__percent">{loadProgress}<small>%</small></span>
        </>}
        {!isLoading && <div className="journey-start">
          <button className="journey-start__primary" onClick={() => startJourney(true)}>여행 시작하기</button>
          <button className="journey-start__silent" onClick={() => startJourney(false)}>소리 없이 시작하기</button>
        </div>}
        </div>
      </div>}

      {started && music.error && !panel && <p className="error-message" role="status">{music.error}</p>}

      {error && <p className="error-message">{error}</p>}

      {started && interactionHint && !panel && (
        <div ref={hintRef} className="object-hint" role="status" aria-live="polite" style={{ visibility: 'hidden' }}>
          <kbd>E</kbd>
          <span>{interactionHint.label}</span>
        </div>
      )}
    </main>
  );
}

export default App;

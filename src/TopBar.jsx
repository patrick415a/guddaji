import { useEffect, useRef } from "react";
import { JourneyTitle } from "./JourneyTitle.jsx";
import { Guidebook } from './Guidebook.jsx';
import { Mailbox } from './Mailbox.jsx';
import { SettingsButton, SettingsPanel } from './MusicButton.jsx';

const sections = {
  guidebook: { title: 'Guidebook', description: '구따지의 여행 안내서를 준비하고 있어요.' },
  contact: { title: 'Contact', description: '구따지에게 소식을 전할 공간을 준비하고 있어요.' },
  help: { title: '조작 안내' },
  settings: { title: '설정' },
};

export function TopBar({ theme, onThemeChange, music, panel, onPanelChange, onRestart, graphicsAuto, onGraphicsAutoChange, graphicsPreset, onGraphicsPresetChange, graphicsLevel, soundEnabled, onSoundChange, soundVolume, onSoundVolumeChange }) {
  const menuButton = useRef(null);
  const dialog = useRef(null);
  useEffect(() => {
    if (!panel) return;
    const previous = document.activeElement;
    dialog.current?.focus();
    const escape = (event) => {
      if (event.key === 'Escape') onPanelChange(null);
      if (event.key !== 'Tab') return;
      const items = [...dialog.current.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), textarea:not(:disabled)')].filter(item => item.getClientRects().length > 0);
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) {
        event.preventDefault(); first?.focus();
      }
    };
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('keydown', escape); previous?.focus(); };
  }, [panel, onPanelChange]);

  return <>
    <JourneyTitle variant="hud" />
    <header className="topbar">
      <button ref={menuButton} className="topbar__icon" aria-label="메뉴 열기" aria-expanded={panel === 'menu'}
        aria-controls="travel-menu" onClick={() => onPanelChange(panel ? null : 'menu')}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h10M5 17h14" /></svg>
      </button>
      <SettingsButton open={panel === 'settings'} onClick={() => onPanelChange(panel === 'settings' ? null : 'settings')} />
      <button type="button" className="topbar__icon topbar__theme" aria-label={theme === 'dark' ? '낮으로 전환' : '밤으로 전환'} title={theme === 'dark' ? '낮으로 전환' : '밤으로 전환'} onClick={onThemeChange}>
        {theme === 'dark' ? <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z" /></svg>}
      </button>
    </header>
    <button className="game-help" aria-label="조작 안내 열기" onClick={() => onPanelChange(panel === 'help' ? null : 'help')}>?</button>
    {panel && <div className={`menu-backdrop${panel === 'help' ? ' menu-backdrop--help' : ''}${['guidebook', 'contact'].includes(panel) ? ' menu-backdrop--feature' : ''}`} onClick={() => onPanelChange(null)}>
      <section id="travel-menu" className={`travel-menu${['guidebook', 'contact'].includes(panel) ? ` feature-panel feature-panel--${panel}` : ''}`} ref={dialog} tabIndex={-1} role="dialog" aria-modal="true"
        aria-labelledby="travel-menu-title" onClick={(event) => event.stopPropagation()}>
        <button className="travel-menu__close" aria-label="메뉴 닫기" onClick={() => onPanelChange(null)}>×</button>
        {['guidebook', 'contact'].includes(panel) ? (
          <div key={panel} className="feature-panel__scroll">
            {panel === 'guidebook' ? <Guidebook /> : <Mailbox />}
          </div>
        ) : <>
        {panel === 'menu' ? <JourneyTitle variant="menu" /> : <p className="travel-menu__eyebrow">TAKE A LITTLE BREAK</p>}
        <h2 id="travel-menu-title">{sections[panel]?.title ?? '메뉴'}</h2>
        {panel === 'menu' ? <nav aria-label="메인 메뉴">
          <button onClick={onRestart}><span>01</span>Home<small>시작 화면으로 돌아가기 ↗</small></button>
          <button onClick={() => onPanelChange('guidebook')}><span>02</span>Guidebook<small>여행 안내서 ↗</small></button>
          <button onClick={() => onPanelChange('contact')}><span>03</span>Contact<small>편지 쓰기 ↗</small></button>
        </nav> : panel === 'settings' ? <SettingsPanel music={music} graphicsAuto={graphicsAuto} onGraphicsAutoChange={onGraphicsAutoChange} graphicsPreset={graphicsPreset} onGraphicsPresetChange={onGraphicsPresetChange} graphicsLevel={graphicsLevel} soundEnabled={soundEnabled} onSoundChange={onSoundChange} soundVolume={soundVolume} onSoundVolumeChange={onSoundVolumeChange} /> : panel === 'help' ? <div className="game-help__keys">
          <p><kbd>WASD / 방향키</kbd><span>이동</span></p>
          <p><kbd>Shift + 이동</kbd><span>달리기</span></p>
          <p><kbd>Space</kbd><span>점프</span></p>
          <p><kbd>E</kbd><span>살펴보기 · 앉기 · 일어나기</span></p>
          <small>모바일에서는 조이스틱으로 이동해요. 달리기를 한 번 누르면 ON, 다시 누르면 OFF로 바뀌어요.</small>
        </div> : <>
          {/* 실제 Guidebook / Contact 내용은 이 영역에서 작성합니다. */}
          <p className="travel-menu__description">{sections[panel]?.description}</p>
          {/* <button className="travel-menu__back" onClick={() => onPanelChange('menu')}>← 메뉴로 돌아가기</button> */}
        </>}
        </>}
      </section>
    </div>}
  </>;
}

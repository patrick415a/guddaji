
export function SettingsButton({ open, onClick }) {
  return (
    <button className="topbar__icon topbar__settings"
      type="button" aria-label="설정 열기" aria-expanded={open} aria-controls="travel-menu"
      title="그래픽 · 소리 설정" onClick={onClick}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 4.1 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2V9.6h.4A1.7 1.7 0 0 0 4.1 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06L6.56 3.7l.06.06A1.7 1.7 0 0 0 8.5 4.1a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V2h4.04v.4A1.7 1.7 0 0 0 15 4.1a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 19.4 8.5a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4h.1v4.04h-.1A1.7 1.7 0 0 0 19.4 15Z" />
      </svg>
    </button>
  );
}

export function SettingsPanel({ music, graphicsAuto, onGraphicsAutoChange, graphicsPreset, onGraphicsPresetChange, graphicsLevel, soundEnabled, onSoundChange, soundVolume, onSoundVolumeChange }) {
  return <div className="sound-settings">
    <p className="sound-settings__intro">화면 품질과 소리를 조절해요.</p>
    <div className="sound-settings__group">
      <div className="sound-settings__heading">
        <span className="sound-settings__label">그래픽 설정</span>
        <label className="sound-settings__auto">
          <input type="checkbox" checked={graphicsAuto} onChange={event => onGraphicsAutoChange(event.target.checked)} />
          <span>자동 설정</span>
        </label>
      </div>
      <div className="sound-settings__presets" role="group" aria-label="그래픽 품질">
        {[['high', '상'], ['medium', '중'], ['low', '하']].map(([value, label], index) => (
          <button key={value} type="button" disabled={graphicsAuto} aria-pressed={graphicsAuto ? graphicsLevel === index : graphicsPreset === value} onClick={() => onGraphicsPresetChange(value)}>{label}</button>
        ))}
      </div>
      <small className="sound-settings__hint">자동 설정은 기기 성능에 맞춰 화질을 조절해요.</small>
    </div>
    <div className="sound-settings__group">
      <div className="sound-settings__heading"><label htmlFor="music-volume">배경음악</label>
        <button type="button" className="sound-settings__toggle" aria-label="배경음악" aria-pressed={music.playing || music.pending} onClick={music.toggle}>
          {music.pending ? '불러오는 중 · 취소' : music.playing ? '켜짐' : '꺼짐'}
        </button>
      </div>
      <div className="sound-settings__slider"><input id="music-volume" type="range" min="0" max="100" step="1" style={{ '--volume-fill': `${Math.round(music.volume * 100)}%` }} value={Math.round(music.volume * 100)} onChange={event => music.changeVolume(Number(event.target.value) / 100)} /><output htmlFor="music-volume">{Math.round(music.volume * 100)}%</output></div>
    </div>
    <div className="sound-settings__group">
      <div className="sound-settings__heading"><label htmlFor="effects-volume">효과음</label>
        <button type="button" className="sound-settings__toggle" aria-label="효과음" aria-pressed={soundEnabled} onClick={() => onSoundChange(!soundEnabled)}>{soundEnabled ? '켜짐' : '꺼짐'}</button>
      </div>
      <div className="sound-settings__slider"><input id="effects-volume" type="range" min="0" max="100" step="1" style={{ '--volume-fill': `${Math.round(soundVolume * 100)}%` }} value={Math.round(soundVolume * 100)} onChange={event => onSoundVolumeChange(Number(event.target.value) / 100)} /><output htmlFor="effects-volume">{Math.round(soundVolume * 100)}%</output></div>
    </div>
    {music.error && <p role="status">{music.error}</p>}
    <small>소리를 꺼도 설정한 음량은 유지돼요.</small>
  </div>;
}

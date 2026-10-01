import { useEffect, useRef, useState } from 'react';
import { AUDIO_CONFIG } from './config/audioConfig.js';

export function useBackgroundMusic() {
  const audio = useRef(null);
  const requested = useRef(false);
  const attempt = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [volume, setVolume] = useState(AUDIO_CONFIG.volume);

  useEffect(() => {
    const player = new Audio(AUDIO_CONFIG.src);
    player.loop = true;
    player.preload = 'none';
    audio.current = player;
    player.volume = AUDIO_CONFIG.volume;
    // 다른 탭으로 이동하면 음악을 멈춥니다. 다시 듣기는 버튼으로 선택합니다.
    const stop = () => {
      requested.current = false; attempt.current += 1;
      player.pause(); setPending(false); setPlaying(false);
    };
    const visibility = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      requested.current = false; attempt.current += 1; player.pause();
    };
  }, []);

  function changeVolume(value) {
    setVolume(value);
    if (audio.current) audio.current.volume = value;
  }

  async function toggle() {
    const player = audio.current;
    const id = ++attempt.current;
    if (requested.current) {
      requested.current = false; player.pause(); setPlaying(false); setPending(false); return;
    }
    requested.current = true; setPending(true); setError('');
    try {
      // 사용자 클릭 안에서 재생하여 모바일 자동재생 제한에 대응합니다.
      await player.play();
      if (id === attempt.current) { setPlaying(true); setPending(false); }
    } catch {
      if (id !== attempt.current) return;
      requested.current = false; setPending(false); setPlaying(false);
      setError('음악을 재생하지 못했어요. 배경음악 켜기를 다시 눌러주세요.');
    }
  }

  return { playing, pending, error, volume, changeVolume, toggle };
}

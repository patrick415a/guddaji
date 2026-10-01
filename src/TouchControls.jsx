import { useEffect, useRef, useState } from "react";

export function TouchControls({ onMove, onRun, onJump, onInteract, interactionHint }) {
  const pointer = useRef(null);
  const callbacks = useRef({ onMove, onRun });
  callbacks.current = { onMove, onRun };
  const [running, setRunning] = useState(false);
  const [stick, setStick] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // 화면 전환/터치 UI 숨김 때 눌린 입력이 남지 않도록 정리합니다.
    const reset = () => {
      pointer.current = null;
      setRunning(false);
      setStick({ x: 0, y: 0 });
      callbacks.current.onMove(0, 0);
      callbacks.current.onRun(false);
    };
    const media = window.matchMedia('(pointer: coarse), (max-width: 700px)');
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', reset);
    media.addEventListener('change', reset);
    return () => {
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', reset);
      media.removeEventListener('change', reset);
      callbacks.current.onMove(0, 0);
      callbacks.current.onRun(false);
    };
  }, []);

  function setRun(active) {
    setRunning(active);
    onRun(active);
  }

  function move(event) {
    if (pointer.current !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const radius = rect.width * 0.3;
    let x = (event.clientX - rect.left - rect.width / 2) / radius;
    let y = (event.clientY - rect.top - rect.height / 2) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    setStick({ x: x * radius, y: y * radius });
    // 중앙 부근의 작은 손떨림은 이동 입력으로 처리하지 않습니다.
    onMove(length < 0.18 ? 0 : x, length < 0.18 ? 0 : -y);
  }

  function release(event) {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    setStick({ x: 0, y: 0 });
    onMove(0, 0);
  }

  return (
    <div className="touch-controls" aria-label="터치 조작">
      <div className="touch-stick" aria-label="드래그하여 이동"
        onPointerDown={(event) => {
          if (pointer.current !== null) return;
          pointer.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          move(event);
        }}
        onPointerMove={move} onPointerUp={release}
        onPointerCancel={release} onLostPointerCapture={release}
        onContextMenu={(event) => event.preventDefault()}>
        <span className="touch-stick__knob" style={{ transform: `translate(${stick.x}px, ${stick.y}px)` }} />
      </div>
      <div className="touch-actions">
      <button className="touch-jump" type="button" onClick={onJump}
        onContextMenu={(event) => event.preventDefault()}>
        <span>점프</span>
      </button>
      <button className={`touch-run${running ? ' is-held' : ''}`} type="button"
        aria-label="달리기" aria-pressed={running}
        // 점프 버튼을 눌러도 달리기 선택은 유지합니다.
        onClick={() => setRun(!running)}
        onContextMenu={(event) => event.preventDefault()}>
        <span>달리기 <small>{running ? 'ON' : 'OFF'}</small></span>
      </button>
      <button className="touch-interact" type="button" disabled={!interactionHint}
        onClick={onInteract}>
        <span>{interactionHint?.label ?? "살펴보기"}</span>
      </button>
      </div>
    </div>
  );
}

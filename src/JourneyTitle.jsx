export function JourneyTitle({ variant }) {
  if (variant === "hud") {
    return <div className="journey-title journey-title--hud">
      <img src="/images/logo.png" alt="구따지 A LITTLE JOURNEY" />
    </div>;
  }

  return <div className={`journey-title journey-title--${variant}`}>
    <span>구름 따라 지구 한 바퀴</span>
    <small>A LITTLE JOURNEY</small>
  </div>;
}

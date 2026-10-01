// UI 전용 일러스트. 월드의 3D 캐릭터와 애니메이션은 유지합니다.
const portraits = {
  walk: { src: '/images/guddaji-human-walk-v1.png', alt: '웃으며 산책하는 인간형 구따지' },
  letter: { src: '/images/guddaji-human-letter-v1.png', alt: '하늘색 하트 편지를 든 인간형 구따지' },
  turnaround: { src: '/images/guddaji-human-turnaround-v1.png', alt: '인간형 구따지의 정면, 옆면, 뒷면' },
};
export function CharacterPortrait({ turnaround = false, variant = 'walk' }) {
  const portrait = portraits[turnaround ? 'turnaround' : variant];
  return <img className="character-portrait" src={portrait.src} alt={portrait.alt} decoding="async" draggable={false} />;
}

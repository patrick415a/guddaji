import { CharacterPortrait } from './CharacterPortrait.jsx';

const palette = ['#F8FAFC', '#DCEEFF', '#9FD4FF', '#6E8BFF', '#D6DEE8', '#BFC9D4'];
// 소개 문구와 컬러는 여기에서 자유롭게 수정하세요.
export function Guidebook() {
  return <div className="guidebook">
    <header className="guidebook__intro">
      <p className="panel-kicker">CHARACTER GUIDEBOOK</p>
      <h2 id="travel-menu-title">구따지<small>GUDDAJI</small></h2>
      <p>구름 따라 지구 한 바퀴.<br />구름 여행자, 구따지예요.</p>
      <CharacterPortrait />
    </header>
    <section className="guide-card guidebook__profile"><h3>프로필 <small>PROFILE</small></h3>
      <dl>{[['이름', '구따지 (Guddaji)'], ['별명', '구름 여행자'], ['성격', '호기심이 많고 친구에게 다정해요.'], ['좋아하는 것', '산책, 따뜻한 햇살, 새로운 풍경'], ['특징', '폭신한 구름 몸과 하늘색 운동화']].map(([title, text]) => <div key={title}><dt>{title}</dt><dd>{text}</dd></div>)}</dl>
    </section>
    <section className="guide-card guidebook__turn"><h3>앞·옆·뒷모습 <small>TURNAROUND</small></h3>
      <div className="turn-labels"><span>FRONT</span><span>SIDE</span><span>BACK</span></div><CharacterPortrait turnaround />
    </section>
    <section className="guide-card"><h3>컬러 팔레트 <small>COLOR PALETTE</small></h3><div className="guide-palette">{palette.map(color => <div key={color}><i style={{ background: color }} /><small>{color}</small></div>)}</div></section>
    <section className="guide-card"><h3>구따지의 특징 <small>DETAILS</small></h3><ul><li>솜처럼 둥글고 폭신한 실루엣</li><li>반짝이는 눈과 작은 미소</li><li>어디든 함께 가는 하늘빛 운동화</li></ul></section>
    <section className="guide-card"><h3>여행 키워드 <small>KEYWORDS</small></h3><div className="guide-tags">{['구름', '여행', '산책', '호기심', '다정함', '설렘'].map(tag => <span key={tag}>{tag}</span>)}</div></section>
    <section className="guide-card guidebook__story"><h3>작은 세계로의 여행 <small>OUR LITTLE WORLD</small></h3><blockquote>“오늘은 어디까지 걸어볼까?”</blockquote><p>다리를 건너 작은 섬을 둘러보고, 벤치에 앉아 쉬어보세요. 구따지와 함께 천천히 산책해요.</p></section>
    <section className="guide-card"><h3>함께 여행하는 방법 <small>PLAY GUIDE</small></h3><p>표지판에서 가이드북을 열고, 우체통에서 편지를 쓸 수 있어요. 가까이 다가가 상호작용해보세요.</p></section>
  </div>;
}

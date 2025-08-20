export function getCenter(el) {
  if (!el) return { x: 0, y: 0 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
export function centers(selector) {
  return Array.from(document.querySelectorAll(selector)).map(getCenter);
}
export function buildFieldSlots() {
  const p1 = document.getElementById('fieldAreaP1');
  const p2 = document.getElementById('fieldAreaP2');
  if (p1) p1.innerHTML='';
  if (p2) p2.innerHTML='';
  for (let i=0;i<10;i++){
    const s1=document.createElement('div');
    s1.className='field-slot'; s1.dataset.player='1'; s1.dataset.slot=String(i);
    p1 && p1.appendChild(s1);
    const s2=document.createElement('div');
    s2.className='field-slot'; s2.dataset.player='2'; s2.dataset.slot=String(i);
    p2 && p2.appendChild(s2);
  }
}
export function computeLayout() {
  const deckTopP2El = document.getElementById('deckTopP2') || document.querySelector('.deck-stack.player2 .deck-card-top');
  return {
    p1: {
      hand: getCenter(document.getElementById('handAreaP1')),
      fieldSlots: centers('#fieldAreaP1 .field-slot'),
      rightSlots: centers('#rightColumnP1 .right-slot'),
      deckTop: getCenter(document.getElementById('deckTopP1')),
    },
    p2: {
      hand: getCenter(document.getElementById('handAreaP2')),
      fieldSlots: centers('#fieldAreaP2 .field-slot'),
      rightSlots: centers('#rightColumnP2 .right-slot'),
      deckTop: getCenter(deckTopP2El),
    }
  };
}
export function waitForLayoutReady() {
  return new Promise(resolve=>{
    const ok=()=>document.getElementById('deckTopP1') &&
      document.getElementById('handAreaP1') &&
      document.querySelectorAll('#fieldAreaP1 .field-slot').length===10 &&
      document.querySelectorAll('#fieldAreaP2 .field-slot').length===10;
    const tick=()=> ok()?resolve():setTimeout(tick,50);
    tick();
  });
}
export function uiMessage(msg){
  const log=document.getElementById('messageLog'); if(!log) return;
  log.textContent=msg; log.style.opacity='0';
  setTimeout(()=>{ log.style.transition='opacity .25s ease'; log.style.opacity='1'; },30);
}
export function hideTurnIndicatorLater(){
  setTimeout(()=>{ const el=document.getElementById('turnIndicator'); if(el) el.style.display='none'; },1800);
}
export function updateDeckDisplays(players){
  const p1El=document.getElementById('deckCountP1');
  const p2El=document.getElementById('deckCountP2');
  p1El && (p1El.textContent=`P1: ${players[1].deck.length}枚`);
  p2El && (p2El.textContent=`CPU: ${players[2].deck.length}枚`);
  if(players[1].deck.length===0){
    const ds1=document.getElementById('deckStackP1'); const dt1=document.getElementById('deckTopP1');
    if(ds1) ds1.style.opacity='.3'; if(dt1) dt1.style.pointerEvents='none';
  }
  if(players[2].deck.length===0){
    const ds2=document.getElementById('deckStackP2'); const dt2=document.getElementById('deckTopP2');
    if(ds2) ds2.style.opacity='.3'; if(dt2) dt2.style.pointerEvents='none';
  }
}

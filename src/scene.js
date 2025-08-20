import { CARD_BACK_URL, CARD_FRONT_URL, SNAP_RANGE_DEFAULT, HAND_OVERLAP_P1, HAND_OVERLAP_P2, CARD_W, CARD_H } from './constants.js';
import { buildFieldSlots, computeLayout, waitForLayoutReady, getCenter, uiMessage, hideTurnIndicatorLater, updateDeckDisplays } from './dom.js';

export class CardGameScene extends Phaser.Scene {
  constructor(){ super('CardGame'); }
  preload(){ this.load.image('cardBack',CARD_BACK_URL); this.load.image('cardFront',CARD_FRONT_URL); }
  async create(){
    buildFieldSlots(); await waitForLayoutReady(); this.layout=computeLayout();
    this.snapRange=SNAP_RANGE_DEFAULT; this.currentPlayer=1;
    this.players={
      1:{ deck:this.shuffle([1,2,3,4,5,6,7,8,9,10]), hand:[], field:Array(10).fill(null), right:[[],[]] },
      2:{ deck:this.shuffle([1,2,3,4,5,6,7,8,9,10]), hand:[], field:Array(10).fill(null), right:[[],[]] }
    };
    this.cardsLayer=this.add.layer();
    const deckTopP1=document.getElementById('deckTopP1'); deckTopP1 && deckTopP1.addEventListener('click',()=>this.drawCard(1));
    document.getElementById('endTurnBtn').addEventListener('click',()=>this.endTurn());
    this.input.on('dragstart',(p,obj)=>{ if(obj.getData&&(obj.getData('locked')||obj.getData('owner')!==1)) return; this.children.bringToTop(obj); });
    this.input.on('drag',(p,obj,dx,dy)=>{ if(obj.getData&&obj.getData('locked')) return; obj.x=dx; obj.y=dy; this.highlightNear(obj); });
    this.input.on('dragend',(p,obj)=>{ if(obj.getData&&obj.getData('locked')){ this.clearHighlights(); return; } this.onDrop(obj); });
    updateDeckDisplays(this.players);
    this.message('ゲーム開始！あなたのターンです。山札をクリックしてカードを引いてください'); hideTurnIndicatorLater();
    window.addEventListener('resize',()=>{ this.layout=computeLayout(); this.layoutHands(); this.layoutBoard(); });
    this.layoutHands(); this.layoutBoard();
    document.addEventListener('keydown',(e)=>{ if(this.currentPlayer!==1) return; if(e.code==='Space'){ e.preventDefault(); this.drawCard(1);} if(e.code==='Enter'){ e.preventDefault(); this.endTurn(); } });
  }
  shuffle(a){ const b=[...a]; for(let i=b.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [b[i],b[j]]=[b[j],b[i]];} return b; }
  createCard(number,owner){
    const deckPos = owner===1 ? (this.layout?.p1.deckTop||{x:0,y:0}) : (this.layout?.p2.deckTop||{x:0,y:0});
    const cont=this.add.container(deckPos.x,deckPos.y); cont.setSize(CARD_W,CARD_H);
    if(owner===1){
      const img=this.add.image(0,0,'cardFront').setDisplaySize(CARD_W,CARD_H);
      const txt=this.add.text(0,0,String(number),{fontFamily:'Segoe UI, sans-serif',fontSize:'28px',color:'#ffffff',fontStyle:'bold'}).setOrigin(0.5);
      cont.add([img,txt]); cont.setInteractive(new Phaser.Geom.Rectangle(0,0,CARD_W,CARD_H),Phaser.Geom.Rectangle.Contains); this.input.setDraggable(cont);
    }else{
      const img=this.add.image(0,0,'cardBack').setDisplaySize(CARD_W,CARD_H); cont.add([img]);
    }
    cont.setData({ number, owner, source:'hand', index:null, locked:false }); this.cardsLayer.add(cont); return cont;
  }
  drawCard(player){
    if(player!==this.currentPlayer && player===1){ this.message('あなたのターンではありません'); return; }
    const p=this.players[player]; if(!p||p.deck.length===0){ this.message('山札にカードがありません'); return; }
    const num=p.deck.shift(); const card=this.createCard(num,player); p.hand.push(card);
    const center=(player===1?this.layout?.p1.hand:this.layout?.p2.hand)||{x:200,y:500};
    const idx=p.hand.length-1; const overlap=(player===1?HAND_OVERLAP_P1:HAND_OVERLAP_P2);
    const tx=center.x+(idx-(p.hand.length-1)/2)*overlap; const ty=center.y;
    this.tweens.add({targets:card,x:tx,y:ty,duration:400,ease:'Power2'});
    updateDeckDisplays(this.players);
    if(player===1){ this.message(`カード ${num} を手札に加えました`);} else { this.message('CPUがカードを引きました'); }
  }
  onDrop(obj){
    const owner=obj.getData('owner'); if(owner!==1){ this.clearHighlights(); return; }
    const source=obj.getData('source'); const pt={x:obj.x,y:obj.y};
    if(source==='field'){
      const moveRight=this.trySnapRight(obj,pt); if(moveRight){ this.clearHighlights(); return; }
      const movedField=this.trySnapFieldFromField(obj,pt); if(movedField){ this.clearHighlights(); return; }
      this.returnToField(obj); this.clearHighlights(); return;
    }
    if(source==='hand'){
      const moved=this.trySnapFieldFromHand(obj,pt); if(!moved) this.returnToHand(obj); this.clearHighlights(); return;
    }
  }
  trySnapFieldFromHand(obj,pt){
    const slots=Array.from(document.querySelectorAll('#fieldAreaP1 .field-slot')); let best={idx:-1,dist:Infinity,c:null};
    slots.forEach((slot,idx)=>{
      const c=getCenter(slot); const d=Phaser.Math.Distance.Between(pt.x,pt.y,c.x,c.y);
      const occupied=!!this.cardsLayer.getChildren().find(o=>o.name===`p1_field_${idx}`);
      if(d<=this.snapRange && !occupied && d<best.dist) best={idx,dist:d,c};
    });
    if(best.idx!==-1){
      this.players[1].hand=this.players[1].hand.filter(s=>s!==obj);
      this.players[1].field[best.idx]=obj.getData('number');
      obj.setName(`p1_field_${best.idx}`); obj.setData('source','field'); obj.setData('index',best.idx);
      this.tweens.add({targets:obj,x:best.c.x,y:best.c.y,duration:220,ease:'Power2'});
      document.querySelectorAll('#fieldAreaP1 .field-slot')[best.idx]?.classList.add('occupied');
      this.layoutHands(); this.message(`カード ${obj.getData('number')} を場へ配置`); return true;
    }
    return false;
  }
  trySnapFieldFromField(obj,pt){
    const oldIdx=obj.getData('index');
    const slots=Array.from(document.querySelectorAll('#fieldAreaP1 .field-slot')); let best={idx:-1,dist:Infinity,c:null};
    slots.forEach((slot,idx)=>{
      if(idx===oldIdx) return; const c=getCenter(slot); const d=Phaser.Math.Distance.Between(pt.x,pt.y,c.x,c.y);
      const occupied=!!this.cardsLayer.getChildren().find(o=>o.name===`p1_field_${idx}`);
      if(d<=this.snapRange && !occupied && d<best.dist) best={idx,dist:d,c};
    });
    if(best.idx!==-1){
      this.players[1].field[oldIdx]=null; document.querySelectorAll('#fieldAreaP1 .field-slot')[oldIdx]?.classList.remove('occupied');
      this.players[1].field[best.idx]=obj.getData('number'); obj.setName(`p1_field_${best.idx}`); obj.setData('index',best.idx);
      this.tweens.add({targets:obj,x:best.c.x,y:best.c.y,duration:220,ease:'Power2'});
      document.querySelectorAll('#fieldAreaP1 .field-slot')[best.idx]?.classList.add('occupied');
      this.message(`カード ${obj.getData('number')} を場スロット ${oldIdx} → ${best.idx} に移動`); return true;
    }
    return false;
  }
  trySnapRight(obj,pt){
    const rslots=Array.from(document.querySelectorAll('#rightColumnP1 .right-slot')); let best={idx:-1,dist:Infinity,c:null};
    rslots.forEach((slot,idx)=>{ const c=getCenter(slot); const d=Phaser.Math.Distance.Between(pt.x,pt.y,c.x,c.y); if(d<=this.snapRange && d<best.dist) best={idx,dist:d,c}; });
    if(best.idx!==-1){
      const old=obj.getData('index'); this.players[1].field[old]=null; document.querySelectorAll('#fieldAreaP1 .field-slot')[old]?.classList.remove('occupied');
      const stack=this.players[1].right[best.idx]; stack.push(obj); obj.setName(''); obj.setData('source','right'); obj.setData('locked',true);
      const offset=stack.length-1; this.tweens.add({targets:obj,x:best.c.x+offset*5,y:best.c.y+offset*20,duration:220,ease:'Power2'});
      this.message(`カード ${obj.getData('number')} を右列へ移動（ロック）`); return true;
    }
    return false;
  }
  returnToHand(obj){
    const arr=this.players[1].hand; const center=this.layout?.p1.hand||{x:200,y:500};
    const idx=arr.indexOf(obj); const tx=center.x+(idx-(arr.length-1)/2)*HAND_OVERLAP_P1; const ty=center.y;
    this.tweens.add({targets:obj,x:tx,y:ty,duration:220,ease:'Power2'}); this.message('カードを手札に戻しました');
  }
  returnToField(obj){
    const idx=obj.getData('index'); const c=this.layout?.p1.fieldSlots[idx];
    if(c) this.tweens.add({targets:obj,x:c.x,y:c.y,duration:220,ease:'Power2'}); this.message('カードを元の場スロットに戻しました');
  }
  highlightNear(obj){
    this.clearHighlights(); const pt={x:obj.x,y:obj.y}; const source=obj.getData('source');
    if(source==='hand'){
      document.querySelectorAll('#fieldAreaP1 .field-slot').forEach((slot,idx)=>{
        const c=getCenter(slot); const d=Phaser.Math.Distance.Between(pt.x,pt.y,c.x,c.y);
        const occupied=!!this.cardsLayer.getChildren().find(o=>o.name===`p1_field_${idx}`);
        if(d<=this.snapRange && !occupied) slot.classList.add('highlight');
      });
    }else if(source==='field'){
      document.querySelectorAll('#rightColumnP1 .right-slot').forEach(slot=>{
        const c=getCenter(slot); const d=Phaser.Math.Distance.Between(pt.x,pt.y,c.x,c.y); if(d<=this.snapRange) slot.classList.add('highlight');
      });
      document.querySelectorAll('#fieldAreaP1 .field-slot').forEach((slot,idx)=>{
        const c=getCenter(slot); const d=Phaser.Math.Distance.Between(pt.x,pt.y,c.x,c.y);
        const occupied=!!this.cardsLayer.getChildren().find(o=>o.name===`p1_field_${idx}`);
        if(d<=this.snapRange && !occupied && idx!==obj.getData('index')) slot.classList.add('highlight');
      });
    }
  }
  clearHighlights(){ document.querySelectorAll('.field-slot.highlight,.right-slot.highlight').forEach(el=>el.classList.remove('highlight')); }
  layoutHands(){
    const center=this.layout?.p1.hand; if(!center) return;
    const arr=this.players[1].hand; const overlap=HAND_OVERLAP_P1;
    arr.forEach((card,i)=>{ const tx=center.x+(i-(arr.length-1)/2)*overlap; const ty=center.y; this.tweens.add({targets:card,x:tx,y:ty,duration:180,ease:'Power2'}); });
    const cpuCenter=this.layout?.p2.hand;
    this.players[2].hand.forEach((card,i)=>{ const tx=cpuCenter.x+(i-(this.players[2].hand.length-1)/2)*HAND_OVERLAP_P2; const ty=cpuCenter.y; this.tweens.add({targets:card,x:tx,y:ty,duration:180,ease:'Power2'}); });
  }
  layoutBoard(){
    const p1Slots=this.layout?.p1.fieldSlots||[];
    this.players[1].field.forEach((num,idx)=>{ const c=this.cardsLayer.getChildren().find(o=>o.name===`p1_field_${idx}`); if(c&&p1Slots[idx]) this.tweens.add({targets:c,x:p1Slots[idx].x,y:p1Slots[idx].y,duration:180,ease:'Power2'}); });
    const p2Slots=this.layout?.p2.fieldSlots||[];
    this.players[2].field.forEach((num,idx)=>{ const c=this.cardsLayer.getChildren().find(o=>o.name===`p2_field_${idx}`); if(c&&p2Slots[idx]) this.tweens.add({targets:c,x:p2Slots[idx].x,y:p2Slots[idx].y,duration:180,ease:'Power2'}); });
    this.players[1].right.forEach((stack,sIdx)=>{ const base=this.layout?.p1.rightSlots[sIdx]; stack.forEach((card,i)=>{ this.tweens.add({targets:card,x:base.x+i*5,y:base.y+i*20,duration:180,ease:'Power2'}); }); });
    this.players[2].right.forEach((stack,sIdx)=>{ const base=this.layout?.p2.rightSlots[sIdx]; stack.forEach((card,i)=>{ this.tweens.add({targets:card,x:base.x+i*5,y:base.y+i*20,duration:180,ease:'Power2'}); }); });
  }
  endTurn(){
    this.currentPlayer=this.currentPlayer===1?2:1;
    const ind=document.getElementById('turnIndicator'); const btn=document.getElementById('endTurnBtn');
    if(this.currentPlayer===1){ ind.textContent='あなたのターン'; ind.style.background='linear-gradient(145deg, rgba(34,197,94,.9), rgba(22,163,74,.9))'; btn.disabled=false; this.message('あなたのターンです'); }
    else{ ind.textContent='CPUのターン'; ind.style.background='linear-gradient(145deg, rgba(239,68,68,.9), rgba(220,38,38,.9))'; btn.disabled=true; this.message('CPUのターンです'); this.cpuTurn(); }
    ind.style.display='block'; hideTurnIndicatorLater();
  }
  cpuTurn(){
    this.time.delayedCall(800,()=>{ if(this.players[2].deck.length>0) this.drawCard(2); });
    this.time.delayedCall(1600,()=>{ this.cpuPlayCard(); });
    this.time.delayedCall(2400,()=>{ this.endTurn(); });
  }
  cpuPlayCard(){
    const cpu=this.players[2];
    if(cpu.hand.length===0) return;
    const empty=cpu.field.map((v,i)=>v===null?i:-1).filter(i=>i!==-1);
    if(empty.length===0) return;
    const idxCard=Math.floor(Math.random()*cpu.hand.length);
    const idxSlot=empty[Math.floor(Math.random()*empty.length)];
    const card=cpu.hand.splice(idxCard,1)[0];
    cpu.field[idxSlot]=card.getData('number'); card.setName(`p2_field_${idxSlot}`); card.setData('owner',2); card.setData('source','field'); card.setData('index',idxSlot);
    card.removeAll(true); const img=this.add.image(0,0,'cardFront').setDisplaySize(CARD_W,CARD_H);
    const txt=this.add.text(0,0,String(card.getData('number')),{fontFamily:'Segoe UI, sans-serif',fontSize:'28px',color:'#ffffff',fontStyle:'bold'}).setOrigin(0.5);
    card.add([img,txt]);
    const c=this.layout?.p2.fieldSlots[idxSlot]; if(c) this.tweens.add({targets:card,x:c.x,y:c.y,duration:220,ease:'Power2'});
    document.querySelector(`#fieldAreaP2 .field-slot[data-slot="${idxSlot}"]`)?.classList.add('occupied');
    this.message(`CPUがカード ${card.getData('number')} を場に配置しました`);
  }
  message(msg){ uiMessage(msg); }
}

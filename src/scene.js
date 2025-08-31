import { CARD_BACK_URL, CARD_FRONT_URL, SNAP_RANGE_DEFAULT, HAND_OVERLAP_P1, HAND_OVERLAP_P2, CARD_W, CARD_H, ZONE_STACK_OFFSET_X, ZONE_STACK_OFFSET_Y, CARD_TYPE, DEFAULT_CARD, TEX, FONT, ASSETS, ASSET_VERSION, SPELL_KIND, SPELL_NAME, rollSpellKind, LABEL_Y } from './constants.js';
import { buildFieldSlots, computeLayout, waitForLayoutReady, getCenter, uiMessage, hideTurnIndicatorLater, updateDeckDisplays } from './dom.js';

export class CardGameScene extends Phaser.Scene {
  constructor(){ super('CardGame'); }
  preload(){
    // Prefer local type-specific assets with cache-busting query
    this.load.image(TEX.BACK,  `${ASSETS.BACK}?${ASSET_VERSION}`);
    this.load.image(TEX.SHIKI, `${ASSETS.SHIKI}?${ASSET_VERSION}`);
    this.load.image(TEX.JYUTSU,`${ASSETS.JYUTSU}?${ASSET_VERSION}`);
    this.load.image(TEX.POWER, `${ASSETS.POWER}?${ASSET_VERSION}`);
    // Back-compat keys in case some code still references old names
    this.load.image('cardBack', `${ASSETS.BACK}?${ASSET_VERSION}`);
    this.load.image('cardFront', `${ASSETS.SHIKI}?${ASSET_VERSION}`);
  }
  async create(){
    buildFieldSlots(); await waitForLayoutReady(); this.layout=computeLayout();
    this.snapRange=SNAP_RANGE_DEFAULT; this.currentPlayer=1;
    this.players={
      1:{ deck:this.buildDeck(), hand:[], field:Array(10).fill(null), right:[[],[]], zones:{ void:[], exile:[] } },
      2:{ deck:this.buildDeck(), hand:[], field:Array(10).fill(null), right:[[],[]], zones:{ void:[], exile:[] } }
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
  frameKeyByType(t){ return t===CARD_TYPE.SHIKI ? TEX.SHIKI : (t===CARD_TYPE.JYUTSU ? TEX.JYUTSU : TEX.POWER); }
  normalizeCardData(raw){
    const c={ ...DEFAULT_CARD, ...raw };
    if(!c.type) c.type=CARD_TYPE.SHIKI;
    if(c.type===CARD_TYPE.POWER){ c.power=500; }
    // Fallback for legacy jyutsu cards missing spellKind/name
    if(c.type===CARD_TYPE.JYUTSU){
      if(!c.spellKind){ c.spellKind = rollSpellKind(); }
      if(!c.name){ c.name = SPELL_NAME[c.spellKind] || c.name; }
    }
    return c;
  }
  renderCardFront(container){
    const card = container.getData('card');
    container.removeAll(true);
    const frame = this.add.image(0,0,this.frameKeyByType(card.type)).setOrigin(0.5).setDisplaySize(CARD_W,CARD_H);
    const nameText  = this.add.text(0, LABEL_Y.NAME_TOP,  '', FONT.NAME ).setOrigin(0.5);
    const valueText = this.add.text(0, LABEL_Y.VALUE_BOT, '', FONT.POWER).setOrigin(0.5);
    container.add([frame,nameText,valueText]);
    container.setData('labelName', nameText);
    container.setData('labelPower', valueText);
    container.setSize(CARD_W,CARD_H);
    this.configureLabelsByType(container);
    return container;
  }
  renderCardBack(container){
    container.removeAll(true);
    const back=this.add.image(0,0,TEX.BACK).setOrigin(0.5).setDisplaySize(CARD_W,CARD_H);
    container.add([back]);
    container.setSize(CARD_W,CARD_H);
    return container;
  }
  createCard(cardRaw,owner){
    const card = this.normalizeCardData(cardRaw);
    const deckPos = owner===1 ? (this.layout?.p1.deckTop||{x:0,y:0}) : (this.layout?.p2.deckTop||{x:0,y:0});
    const cont=this.add.container(deckPos.x,deckPos.y);
    cont.setData('card', card);
    cont.setData('number', card.id ?? card.number ?? 0);
    cont.setData('owner', owner);
    cont.setData('source','hand');
    cont.setData('index', null);
    cont.setData('locked', false);
    if(owner===1) this.renderCardFront(cont); else this.renderCardBack(cont);
    cont.setInteractive(new Phaser.Geom.Rectangle(0,0,CARD_W,CARD_H),Phaser.Geom.Rectangle.Contains);
    this.input.setDraggable(cont);
    this.cardsLayer.add(cont);
    return cont;
  }
  // タイプ別にテキスト可視状態・文言・Y座標を整える
  configureLabelsByType(container){
    const d = container.getData('card') || {};
    const name = container.getData('labelName');
    const val  = container.getData('labelPower');
    if(!name || !val) return;
    name.setVisible(false).setText('');
    val.setVisible(false).setText('');
    switch(d.type){
      case CARD_TYPE.SHIKI:{
        val.setY(LABEL_Y.VALUE_BOT);
        val.setText(d.power != null ? String(d.power) : '');
        val.setVisible(true);
        break;
      }
      case CARD_TYPE.JYUTSU:{
        val.setY(LABEL_Y.JYUTSU_BOT);
        const kindText = d.spellKind && (SPELL_NAME?.[d.spellKind] || '');
        val.setText(kindText || '');
        val.setVisible(true);
        break;
      }
      case CARD_TYPE.POWER:{
        // All labels hidden; image shows value/label
        break;
      }
      default:{
        break;
      }
    }
  }
  drawCard(player){
    if(player!==this.currentPlayer && player===1){ this.message('あなたのターンではありません'); return; }
    const p=this.players[player]; if(!p||p.deck.length===0){ this.message('山札にカードがありません'); return; }
    const cardData=p.deck.shift(); const card=this.createCard(cardData,player); p.hand.push(card);
    const center=(player===1?this.layout?.p1.hand:this.layout?.p2.hand)||{x:200,y:500};
    const idx=p.hand.length-1; const overlap=(player===1?HAND_OVERLAP_P1:HAND_OVERLAP_P2);
    const tx=center.x+(idx-(p.hand.length-1)/2)*overlap; const ty=center.y;
    this.tweens.add({targets:card,x:tx,y:ty,duration:400,ease:'Power2'});
    updateDeckDisplays(this.players);
    if(player===1){ this.message(`カード ${card.getData('number')} を手札に加えました`);} else { this.message('CPUがカードを引きました'); }
  }
  buildDeck(){
    const base=[1,2,3,4,5,6,7,8,9,10];
    const cards=base.map((id,i)=>{
      const t = i%3===0 ? CARD_TYPE.SHIKI : (i%3===1 ? CARD_TYPE.JYUTSU : CARD_TYPE.POWER);
      if(t===CARD_TYPE.JYUTSU){
        const kind = rollSpellKind();
        return this.normalizeCardData({ id: `J${id}`, type: CARD_TYPE.JYUTSU, spellKind: kind, name: SPELL_NAME[kind] });
      }
      // SHIKI / POWER default naming stays as before
      return this.normalizeCardData({ id, type:t, name:`カード${id}`, power: 500 + (id%3)*100 });
    });
    const arr=[...cards]; for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
    return arr;
  }

  // Placeholder for future jyutsu activation routing
  activateSetJyutsu({ jyutsuCard, casterShiki, targetShiki }){
    const kind = jyutsuCard?._data?.spellKind || jyutsuCard?.getData?.('card')?.spellKind;
    switch(kind){
      case 'barrier':
        return this.activateBarrier({ casterShiki });
      case 'purify':
        return this.activatePurify({ casterShiki, targetShiki });
      case 'seal':
        return this.activateSeal({ casterShiki, targetShiki });
      case 'dispel':
        return this.activateDispel({ casterShiki, targetShiki });
      default:
        return;
    }
  }
  activateBarrier(){ /* TODO: implement effect */ }
  activatePurify(){ /* TODO: implement effect */ }
  activateSeal(){ /* TODO: implement effect */ }
  activateDispel(){ /* TODO: implement effect */ }
  onDrop(obj){
    const owner=obj.getData('owner'); if(owner!==1){ this.clearHighlights(); return; }
    const source=obj.getData('source'); const pt={x:obj.x,y:obj.y};
    if(source==='field'){
      const movedZone=this.trySnapZone(obj,pt); if(movedZone){ this.clearHighlights(); return; }
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
      const slotEl = rslots[best.idx];
      const zoneType = slotEl?.dataset?.zone || (slotEl?.id?.includes('Void') ? 'void' : slotEl?.id?.includes('Exile') ? 'exile' : null);
      if(zoneType){
        const z=this.players[1].zones[zoneType]; z.push(obj); obj.setName(''); obj.setData('source','zone'); obj.setData('locked',true);
        const offset=z.length-1; this.tweens.add({targets:obj,x:best.c.x+offset*ZONE_STACK_OFFSET_X,y:best.c.y+offset*ZONE_STACK_OFFSET_Y,duration:220,ease:'Power2'});
        this.message(`カード ${obj.getData('number')} を${zoneType==='void'?'虚数空間':'結界外'}ゾーンへ移動（ロック）`); return true;
      } else {
        const stack=this.players[1].right[best.idx]; stack.push(obj); obj.setName(''); obj.setData('source','right'); obj.setData('locked',true);
        const offset=stack.length-1; this.tweens.add({targets:obj,x:best.c.x+offset*5,y:best.c.y+offset*20,duration:220,ease:'Power2'});
        this.message(`カード ${obj.getData('number')} を右列へ移動（ロック）`); return true;
      }
    }
    return false;
  }
  trySnapZone(obj,pt){
    const L=this.layout?.p1?.zones; if(!L) return false;
    const dVoid=Phaser.Math.Distance.Between(pt.x,pt.y,L.void.x,L.void.y);
    const dExile=Phaser.Math.Distance.Between(pt.x,pt.y,L.exile.x,L.exile.y);
    if(dVoid<=this.snapRange){
      const old=obj.getData('index'); if(old!=null){ this.players[1].field[old]=null; document.querySelectorAll('#fieldAreaP1 .field-slot')[old]?.classList.remove('occupied'); }
      const z=this.players[1].zones.void; z.push(obj); obj.setName(''); obj.setData('source','zone'); obj.setData('locked',true);
      const offset=z.length-1; this.tweens.add({targets:obj,x:L.void.x+offset*ZONE_STACK_OFFSET_X,y:L.void.y+offset*ZONE_STACK_OFFSET_Y,duration:220,ease:'Power2'});
      this.message(`カード ${obj.getData('number')} を虚数空間ゾーンへ移動（ロック）`); return true;
    }
    if(dExile<=this.snapRange){
      const old=obj.getData('index'); if(old!=null){ this.players[1].field[old]=null; document.querySelectorAll('#fieldAreaP1 .field-slot')[old]?.classList.remove('occupied'); }
      const z=this.players[1].zones.exile; z.push(obj); obj.setName(''); obj.setData('source','zone'); obj.setData('locked',true);
      const offset=z.length-1; this.tweens.add({targets:obj,x:L.exile.x+offset*ZONE_STACK_OFFSET_X,y:L.exile.y+offset*ZONE_STACK_OFFSET_Y,duration:220,ease:'Power2'});
      this.message(`カード ${obj.getData('number')} を結界外ゾーンへ移動（ロック）`); return true;
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
      // zone elements highlight
      ['zoneVoidP1','zoneExileP1'].forEach(id=>{ const el=document.getElementById(id); if(!el) return; const c=getCenter(el); const d=Phaser.Math.Distance.Between(pt.x,pt.y,c.x,c.y); if(d<=this.snapRange) el.classList.add('highlight'); });
      document.querySelectorAll('#fieldAreaP1 .field-slot').forEach((slot,idx)=>{
        const c=getCenter(slot); const d=Phaser.Math.Distance.Between(pt.x,pt.y,c.x,c.y);
        const occupied=!!this.cardsLayer.getChildren().find(o=>o.name===`p1_field_${idx}`);
        if(d<=this.snapRange && !occupied && idx!==obj.getData('index')) slot.classList.add('highlight');
      });
    }
  }
  clearHighlights(){ document.querySelectorAll('.field-slot.highlight,.right-slot.highlight,.zone.highlight').forEach(el=>el.classList.remove('highlight')); }
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
    // zones re-layout
    const Z1=this.layout?.p1?.zones; if(Z1){
      this.players[1].zones.void.forEach((card,i)=>{ this.tweens.add({targets:card,x:Z1.void.x+i*ZONE_STACK_OFFSET_X,y:Z1.void.y+i*ZONE_STACK_OFFSET_Y,duration:180,ease:'Power2'}); });
      this.players[1].zones.exile.forEach((card,i)=>{ this.tweens.add({targets:card,x:Z1.exile.x+i*ZONE_STACK_OFFSET_X,y:Z1.exile.y+i*ZONE_STACK_OFFSET_Y,duration:180,ease:'Power2'}); });
    }
    const Z2=this.layout?.p2?.zones; if(Z2){
      this.players[2].zones.void.forEach((card,i)=>{ this.tweens.add({targets:card,x:Z2.void.x+i*ZONE_STACK_OFFSET_X,y:Z2.void.y+i*ZONE_STACK_OFFSET_Y,duration:180,ease:'Power2'}); });
      this.players[2].zones.exile.forEach((card,i)=>{ this.tweens.add({targets:card,x:Z2.exile.x+i*ZONE_STACK_OFFSET_X,y:Z2.exile.y+i*ZONE_STACK_OFFSET_Y,duration:180,ease:'Power2'}); });
    }
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
    // Reveal CPU card when placed on field
    this.renderCardFront(card);
    const c=this.layout?.p2.fieldSlots[idxSlot]; if(c) this.tweens.add({targets:card,x:c.x,y:c.y,duration:220,ease:'Power2'});
    document.querySelector(`#fieldAreaP2 .field-slot[data-slot="${idxSlot}"]`)?.classList.add('occupied');
    this.message(`CPUがカード ${card.getData('number')} を場に配置しました`);
  }
  message(msg){ uiMessage(msg); }
}

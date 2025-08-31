import { CARD_BACK_URL, CARD_FRONT_URL, SNAP_RANGE_DEFAULT, HAND_OVERLAP_P1, HAND_OVERLAP_P2, CARD_W, CARD_H, ZONE_STACK_OFFSET_X, ZONE_STACK_OFFSET_Y, CARD_TYPE, DEFAULT_CARD, TEX, FONT, ASSETS, ASSET_VERSION, SPELL_KIND, SPELL_NAME, rollSpellKind, LABEL_Y, normalizeRequiredPower, requiredToCostCount } from './constants.js';
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
      1:{ deck:this.buildDeck(), hand:[], field:Array(10).fill(null), right:[[],[]], zones:{ void:[], exile:[] }, barrier:{ active:false, hasBonus:false, casterId:null, required:0 }, perTurn:{ didHandAction:false, didActivate:false }, flags:{ banishUsedByShikigami:{} } },
      2:{ deck:this.buildDeck(), hand:[], field:Array(10).fill(null), right:[[],[]], zones:{ void:[], exile:[] }, barrier:{ active:false, hasBonus:false, casterId:null, required:0 }, perTurn:{ didHandAction:false, didActivate:false }, flags:{ banishUsedByShikigami:{} } }
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
    // Click on a field shikigami to activate its set jyutsu (or auto-attach barrier from hand)
    this.input.on('gameobjectdown',(pointer, obj)=>{
      if(this.currentPlayer!==1) return;
      if(!obj?.getData) return;
      if(obj.getData('source')!=='field') return;
      if(obj.getData('owner')!==1) return;
      const cd = obj.getData('card');
      if(cd?.type!==CARD_TYPE.SHIKI) return;
      if(obj.getData('sealed')){ this.message('封印された式神は行動できません'); return; }
      // one activation per turn (summon+activateは可)
      const p=this.players[1];
      if(p.perTurn.didActivate){ this.message('このターンは既に発動を行いました'); return; }
      const attached = obj.getData('attachedJyutsu');
      if(attached){
        const kind = attached.getData('card')?.spellKind;
        if(kind===SPELL_KIND.BARRIER) return this.activateBarrier({ casterShiki: obj, jyutsuCard: attached });
        if(kind===SPELL_KIND.PURIFY)  return this.activatePurify({ casterShiki: obj, jyutsuCard: attached });
        if(kind===SPELL_KIND.SEAL)    return this.activateSeal({ casterShiki: obj, jyutsuCard: attached });
        if(kind===SPELL_KIND.DISPEL)  return this.activateDispel({ casterShiki: obj, jyutsuCard: attached });
        return;
      }
      // fallback: auto-attach barrier from hand if any (pay set cost)
      const j = this.findBarrierCardInHand(1);
      if(j){
        const req = normalizeRequiredPower(obj.getData('card')?.power||500);
        const need = requiredToCostCount(req);
        const have = this.countPowerInHand(1);
        if(have<need){ this.message('力量カードが不足しており術式をセットできません'); return; }
        this.players[1].hand=this.players[1].hand.filter(c=>c!==j);
        j.setData('source','attached'); j.setData('locked',true); j.setData('attachedTo', obj.getData('number'));
        j.setData('attachedPowers', []);
        obj.setData('attachedJyutsu', j);
        this.tweens.add({targets:j,x:obj.x,y:obj.y-CARD_H*0.15,duration:180,ease:'Power2'});
        this.attachPowerFromHandToJyutsu(1, need, j, obj);
        this.players[1].perTurn.didHandAction = true;
        this.activateBarrier({ casterShiki: obj, jyutsuCard: j });
      }
      else this.message('術式がセットされていません');
    });
  }
  shuffle(a){ const b=[...a]; for(let i=b.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [b[i],b[j]]=[b[j],b[i]];} return b; }
  frameKeyByType(t){ return t===CARD_TYPE.SHIKI ? TEX.SHIKI : (t===CARD_TYPE.JYUTSU ? TEX.JYUTSU : TEX.POWER); }
  normalizeCardData(raw){
    const c={ ...DEFAULT_CARD, ...raw };
    if(!c.type) c.type=CARD_TYPE.SHIKI;
    if(c.type===CARD_TYPE.POWER){ c.power=500; }
    if(c.type===CARD_TYPE.SHIKI){ c.power = normalizeRequiredPower(c.power); }
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
    cont.setData('sealed', false);
    cont.setData('attachedTo', null);
    cont.setData('attachedJyutsu', null);
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
    // Build a 30-card deck: 16 power, 7 shiki (500/1000/1500), 7 jyutsu (random kinds)
    const cards=[];
    // Add Power(16)
    for(let i=1;i<=16;i++) cards.push(this.normalizeCardData({ id:`P${i}`, type:CARD_TYPE.POWER, name:`力量${i}`, power:500 }));
    // Add Shikigami(7)
    const shikiRequired = [500,1000,1500,500,1000,1500,1000];
    shikiRequired.forEach((req,i)=>{ cards.push(this.normalizeCardData({ id:`S${i+1}`, type:CARD_TYPE.SHIKI, name:`式神${i+1}`, power:req })); });
    // Add Jyutsu(7)
    for(let i=1;i<=7;i++){ const kind=rollSpellKind(); cards.push(this.normalizeCardData({ id:`J${i}`, type:CARD_TYPE.JYUTSU, spellKind:kind, name:SPELL_NAME[kind] })); }
    const arr=[...cards]; for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
    return arr;
  }

  // Jyutsu activation implementations
  activateBarrier({ casterShiki, jyutsuCard }){
    const playerId = casterShiki.getData('owner'); const p=this.players[playerId];
    if(p.barrier.active){ this.message('既に結界が張られています'); return; }
    const attached = casterShiki.getData('attachedJyutsu');
    if(!attached || attached!==jyutsuCard || attached.getData('card')?.spellKind!==SPELL_KIND.BARRIER){ this.message('結界の術式がセットされていません'); return; }
    const req = normalizeRequiredPower(casterShiki.getData('card')?.power||500);
    p.barrier={ active:true, hasBonus:true, casterId: casterShiki.getData('number'), required: req };
    p.perTurn.didActivate=true;
    this.message(`結界を構築（${req}）。相手は${req}超のみ召喚可`);
  }
  activatePurify({ casterShiki, jyutsuCard }){
    const playerId = casterShiki.getData('owner'); const p=this.players[playerId]; const oppId=playerId===1?2:1; const opp=this.players[oppId];
    if(!p.barrier.active){ this.message('祓いには自軍の結界が必要です'); return; }
    const attached = casterShiki.getData('attachedJyutsu'); if(!attached || attached!==jyutsuCard || attached.getData('card')?.spellKind!==SPELL_KIND.PURIFY){ this.message('祓いの術式がセットされていません'); return; }
    const req=normalizeRequiredPower(casterShiki.getData('card')?.power||500);
    const myPower = req + (p.barrier.active && p.barrier.hasBonus ? 500 : 0);
    const candidates = this.getFieldShikigamiContainers(oppId).filter(t=>!t.getData('sealed')).filter(t=> myPower >= normalizeRequiredPower(t.getData('card')?.power||500));
    if(candidates.length===0){ this.message('祓える対象がいません'); return; }
    const casterId = casterShiki.getData('number'); if(p.flags.banishUsedByShikigami[casterId]){ this.message('この式神は今ターンの祓いを使いました'); return; }
    const target=candidates[0]; this.moveShikigamiToExile(target);
    p.flags.banishUsedByShikigami[casterId]=true; p.perTurn.didActivate=true;
    this.message(`祓い成功：相手式神 ${target.getData('number')} を結界外へ`);
  }
  activateSeal({ casterShiki, jyutsuCard }){
    const playerId = casterShiki.getData('owner'); const oppId=playerId===1?2:1; const p=this.players[playerId]; const opp=this.players[oppId];
    const attached=casterShiki.getData('attachedJyutsu'); if(!attached || attached!==jyutsuCard || attached.getData('card')?.spellKind!==SPELL_KIND.SEAL){ this.message('封印の術式がセットされていません'); return; }
    const req=normalizeRequiredPower(casterShiki.getData('card')?.power||500);
    const myPower=req;
    const candidates=this.getFieldShikigamiContainers(oppId).filter(t=>!t.getData('sealed')).filter(t=> myPower>normalizeRequiredPower(t.getData('card')?.power||500));
    if(candidates.length===0){ this.message('封印できる対象がいません'); return; }
    const target=candidates[0]; target.setData('sealed', true); target.setData('locked', true);
    if(opp.barrier.active && opp.barrier.casterId===target.getData('number')){ opp.barrier.hasBonus=false; }
    p.perTurn.didActivate=true; this.message(`封印成功：相手式神 ${target.getData('number')} を行動不能に`);
  }
  activateDispel({ casterShiki, jyutsuCard }){
    const playerId = casterShiki.getData('owner'); const oppId=playerId===1?2:1; const p=this.players[playerId]; const opp=this.players[oppId];
    const attached=casterShiki.getData('attachedJyutsu'); if(!attached || attached!==jyutsuCard || attached.getData('card')?.spellKind!==SPELL_KIND.DISPEL){ this.message('解呪の術式がセットされていません'); return; }
    const req=normalizeRequiredPower(casterShiki.getData('card')?.power||500);
    const myPower=req;
    const candidates=this.getFieldShikigamiContainers(oppId).filter(t=>{
      const aj=t.getData('attachedJyutsu'); const kind=aj?.getData('card')?.spellKind;
      if(!aj) return false; if(kind===SPELL_KIND.DISPEL) return false;
      const tp=normalizeRequiredPower(t.getData('card')?.power||500); return myPower>=tp;
    });
    if(candidates.length===0){ this.message('解呪できる対象がいません'); return; }
    const target=candidates[0]; const aj=target.getData('attachedJyutsu');
    const wasBarrier = aj?.getData('card')?.spellKind===SPELL_KIND.BARRIER;
    this.detachJyutsuToVoid(target);
    if(wasBarrier && opp.barrier.active){ opp.barrier.active=false; opp.barrier.hasBonus=false; opp.barrier.casterId=null; opp.barrier.required=0; this.returnAllExileToHand(oppId); }
    p.perTurn.didActivate=true; this.message(`解呪成功：相手式神 ${target.getData('number')} の術式を除外`);
  }
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
      const moved = this.tryAttachJyutsuFromHand(obj, pt) || this.trySnapFieldFromHand(obj,pt);
      if(!moved) this.returnToHand(obj); this.clearHighlights(); return;
    }
  }
  tryAttachJyutsuFromHand(obj, pt){
    const cardData = obj.getData('card') || {};
    if(cardData.type!==CARD_TYPE.JYUTSU) return false;
    const shikis = this.cardsLayer.getChildren().filter(o=>o?.getData && o.getData('source')==='field' && o.getData('owner')===1 && (o.getData('card')?.type===CARD_TYPE.SHIKI) && !o.getData('sealed'));
    let best={shiki:null,dist:Infinity};
    shikis.forEach(s=>{ const d=Phaser.Math.Distance.Between(pt.x,pt.y,s.x,s.y); if(d<=this.snapRange && d<best.dist) best={shiki:s,dist:d}; });
    if(!best.shiki){ return false; }
    if(best.shiki.getData('attachedJyutsu')){ this.message('この式神には既に術式がセットされています'); return false; }
    // require power cards at set time equal to shikigami's required power
    const req = normalizeRequiredPower(best.shiki.getData('card')?.power||500);
    const need = requiredToCostCount(req);
    const have = this.countPowerInHand(1);
    if(have < need){ this.message(`力量カードが不足しており術式をセットできません（必要:${need}枚/所持:${have}枚）`); return false; }
    // attach power cards under the jyutsu (do not discard)
    // attach: mark hand removal and attach to shiki with slight offset
    this.players[1].hand=this.players[1].hand.filter(c=>c!==obj);
    obj.setData('source','attached'); obj.setData('locked', true); obj.setData('attachedTo', best.shiki.getData('number'));
    obj.setData('attachedPowers', []);
    best.shiki.setData('attachedJyutsu', obj);
    this.tweens.add({targets:obj,x:best.shiki.x,y:best.shiki.y-CARD_H*0.15,duration:180,ease:'Power2'});
    this.attachPowerFromHandToJyutsu(1, need, obj, best.shiki);
    this.players[1].perTurn.didHandAction = true; this.layoutHands();
    const kindText = SPELL_NAME[cardData.spellKind] || '術式';
    this.message(`術式「${kindText}」を式神 ${best.shiki.getData('number')} にセット（力量カードを重ねて配置:${need}枚）`);
    return true;
  }
  trySnapFieldFromHand(obj,pt){
    // Only allow summoning SHIKI from hand into empty field, with cost and barrier restriction
    const cardData = obj.getData('card') || {};
    if(cardData.type!==CARD_TYPE.SHIKI){
      this.message('場に出せるのは式神カードのみです');
      return false;
    }
    const slots=Array.from(document.querySelectorAll('#fieldAreaP1 .field-slot')); let best={idx:-1,dist:Infinity,c:null};
    slots.forEach((slot,idx)=>{
      const c=getCenter(slot); const d=Phaser.Math.Distance.Between(pt.x,pt.y,c.x,c.y);
      const occupied=!!this.cardsLayer.getChildren().find(o=>o.name===`p1_field_${idx}`);
      if(d<=this.snapRange && !occupied && d<best.dist) best={idx,dist:d,c};
    });
    if(best.idx!==-1){
      // Enforce opponent barrier restriction
      const shikiRequired = normalizeRequiredPower(cardData.power||500);
      if(!this.canSummon(1, shikiRequired)){
        this.message('相手の結界により、この式神は召喚できません');
        return false;
      }
      // Place to field
      this.players[1].hand=this.players[1].hand.filter(s=>s!==obj);
      this.players[1].field[best.idx]=obj.getData('number');
      obj.setName(`p1_field_${best.idx}`); obj.setData('source','field'); obj.setData('index',best.idx);
      // mark summon as this-turn hand action
      this.players[1].perTurn.didHandAction = true;
      this.tweens.add({targets:obj,x:best.c.x,y:best.c.y,duration:220,ease:'Power2'});
      document.querySelectorAll('#fieldAreaP1 .field-slot')[best.idx]?.classList.add('occupied');
      this.layoutHands(); this.message(`式神 ${obj.getData('number')}（${shikiRequired}）を召喚`); return true;
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
    // reposition attached jyutsu relative to their shikigami
    this.layoutAttachments();
  }
  endTurn(){
    this.currentPlayer=this.currentPlayer===1?2:1;
    // reset per-turn flags
    const p=this.players[this.currentPlayer]; if(p){ p.perTurn={ didHandAction:false, didActivate:false }; p.flags.banishUsedByShikigami={}; }
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
    // Try to play a SHIKI that satisfies barrier (no summon cost required)
    let playableIndex = -1; let chosenRequired=0;
    for(let i=0;i<cpu.hand.length;i++){
      const cd = cpu.hand[i].getData('card');
      if(cd?.type!==CARD_TYPE.SHIKI) continue;
      const req = normalizeRequiredPower(cd.power||500);
      if(!this.canSummon(2, req)) continue;
      playableIndex=i; chosenRequired=req; break;
    }
    if(playableIndex===-1) return; // CPU skips
    const idxSlot=empty[Math.floor(Math.random()*empty.length)];
    const card=cpu.hand.splice(playableIndex,1)[0];
    cpu.field[idxSlot]=card.getData('number'); card.setName(`p2_field_${idxSlot}`); card.setData('owner',2); card.setData('source','field'); card.setData('index',idxSlot);
    // Reveal CPU card when placed on field
    this.renderCardFront(card);
    const c=this.layout?.p2.fieldSlots[idxSlot]; if(c) this.tweens.add({targets:card,x:c.x,y:c.y,duration:220,ease:'Power2'});
    document.querySelector(`#fieldAreaP2 .field-slot[data-slot="${idxSlot}"]`)?.classList.add('occupied');
    this.message(`CPUが式神 ${card.getData('number')}（${chosenRequired}）を召喚`);
  }
  message(msg){ uiMessage(msg); }

  // ==== Rule helpers ====
  layoutAttachments(){
    [1,2].forEach(pid=>{
      this.cardsLayer.getChildren().forEach(s=>{
        if(!s?.getData) return; if(s.getData('source')!=='field') return; if(s.getData('owner')!==pid) return;
        const d=s.getData('card'); if(d?.type!==CARD_TYPE.SHIKI) return;
        const j=s.getData('attachedJyutsu');
        if(j){
          this.tweens.add({targets:j,x:s.x,y:s.y-CARD_H*0.15,duration:120,ease:'Power1'});
          const powers = j.getData('attachedPowers')||[];
          powers.forEach((pwr,i)=>{
            const offsetY = -CARD_H*0.15 + 18 + i*8; // stack below the jyutsu
            this.tweens.add({targets:pwr,x:s.x,y:s.y+offsetY,duration:120,ease:'Power1'});
          });
        }
      });
    });
  }
  attachPowerFromHandToJyutsu(playerId, count, jyutsuCont, shikiCont){
    const p=this.players[playerId]; const arr=p.hand; const attached=[]; let n=count;
    for(let i=arr.length-1;i>=0 && n>0;i--){
      const c=arr[i]; const d=c.getData('card');
      if(d?.type!==CARD_TYPE.POWER) continue;
      arr.splice(i,1);
      c.setData('source','attached'); c.setData('locked',true); c.setData('attachedTo', jyutsuCont.getData('number'));
      attached.push(c);
    }
    const prev = jyutsuCont.getData('attachedPowers')||[];
    jyutsuCont.setData('attachedPowers', prev.concat(attached));
    // place them visually
    const baseY = shikiCont.y - CARD_H*0.15 + 18;
    attached.forEach((c,i)=>{ this.tweens.add({targets:c,x:shikiCont.x,y:baseY + (prev.length+i)*8,duration:160,ease:'Power2'}); });
    this.layoutHands();
  }
  getFieldShikigamiContainers(playerId){
    return this.cardsLayer.getChildren().filter(o=>o?.getData && o.getData('source')==='field' && o.getData('owner')===playerId && (o.getData('card')?.type===CARD_TYPE.SHIKI));
  }
  attachJyutsuToShikigami(playerId, jyutsuCont, shikiCont){
    jyutsuCont.setData('source','attached'); jyutsuCont.setData('locked',true);
    jyutsuCont.setData('attachedTo', shikiCont.getData('number'));
    shikiCont.setData('attachedJyutsu', jyutsuCont);
    this.tweens.add({targets:jyutsuCont,x:shikiCont.x,y:shikiCont.y-CARD_H*0.15,duration:180,ease:'Power2'});
  }
  moveShikigamiToExile(target){
    const owner=target.getData('owner'); const p=this.players[owner]; const L=this.layout?.[owner===1?'p1':'p2']?.zones;
    const idx=target.getData('index'); if(idx!=null){ p.field[idx]=null; const sel=document.querySelector(`#fieldAreaP${owner} .field-slot[data-slot="${idx}"]`); sel?.classList.remove('occupied'); }
    // move attached jyutsu and attached powers to void (spent)
    const aj=target.getData('attachedJyutsu'); if(aj){ this.detachJyutsuToVoid(target); }
    p.zones.exile.push(target); target.setName(''); target.setData('source','zone'); target.setData('locked',true);
    const offset=p.zones.exile.length-1; const zx=L?.exile?.x||target.x, zy=L?.exile?.y||target.y;
    this.tweens.add({targets:target,x:zx+offset*ZONE_STACK_OFFSET_X,y:zy+offset*ZONE_STACK_OFFSET_Y,duration:220,ease:'Power2'});
  }
  detachJyutsuToVoid(shikiCont){
    const owner=shikiCont.getData('owner');
    const j=shikiCont.getData('attachedJyutsu'); if(!j) return;
    shikiCont.setData('attachedJyutsu', null); j.setData('attachedTo', null);
    // also move any attached power cards to void
    const pwr = j.getData('attachedPowers')||[]; j.setData('attachedPowers', []);
    pwr.forEach((c)=>{ this.moveCardToZoneVoid(c, owner); });
    this.moveCardToZoneVoid(j, owner);
  }
  moveCardToZoneVoid(card, owner){
    const p=this.players[owner]; const L=this.layout?.[owner===1?'p1':'p2']?.zones;
    p.zones.void.push(card); card.setData('source','zone'); card.setData('locked',true); card.setName('');
    const offset=p.zones.void.length-1; const zx=L?.void?.x||card.x, zy=L?.void?.y||card.y;
    this.tweens.add({targets:card,x:zx+offset*ZONE_STACK_OFFSET_X,y:zy+offset*ZONE_STACK_OFFSET_Y,duration:200,ease:'Power2'});
  }
  returnAllExileToHand(playerId){
    const p=this.players[playerId];
    while(p.zones.exile.length>0){
      const card=p.zones.exile.shift();
      p.hand.push(card); card.setData('source','hand'); card.setData('locked',false); card.setData('sealed', false);
    }
    this.layoutHands();
    this.message(`結界消失：結界外の式神を手札に戻しました`);
  }
  canSummon(playerId, required){
    // Opponent barrier restriction: must be strictly greater than opponent barrier caster's required
    const opp = playerId===1?2:1;
    const ob = this.players[opp]?.barrier;
    if(ob && ob.active){
      if(!(required>ob.required)) return false;
    }
    return true;
  }
  countPowerInHand(playerId){
    const arr=this.players[playerId].hand||[];
    return arr.filter(c=>c.getData('card')?.type===CARD_TYPE.POWER).length;
  }
  consumePowerFromHandToVoid(playerId, count){
    const p=this.players[playerId]; const L = this.layout?.[playerId===1?'p1':'p2']?.zones;
    let n=count;
    for(let i=p.hand.length-1;i>=0 && n>0;i--){
      const card=p.hand[i]; const d=card.getData('card');
      if(d?.type!==CARD_TYPE.POWER) continue;
      // move to void zone stack and lock
      p.hand.splice(i,1);
      p.zones.void.push(card);
      card.setName(''); card.setData('source','zone'); card.setData('locked',true);
      const stackOffset=p.zones.void.length-1;
      const zx=L?.void?.x||card.x, zy=L?.void?.y||card.y;
      this.tweens.add({targets:card,x:zx+stackOffset*ZONE_STACK_OFFSET_X,y:zy+stackOffset*ZONE_STACK_OFFSET_Y,duration:220,ease:'Power2'});
      n--;
    }
    this.layoutHands(); updateDeckDisplays(this.players);
  }

  // Try to find a barrier jyutsu card in hand
  findBarrierCardInHand(playerId){
    const arr=this.players[playerId].hand||[];
    return arr.find(c=>{
      const d=c.getData('card');
      return d?.type===CARD_TYPE.JYUTSU && d?.spellKind===SPELL_KIND.BARRIER;
    }) || null;
  }

  // (activateBarrier is defined above with attached-jyutsu flow)
}

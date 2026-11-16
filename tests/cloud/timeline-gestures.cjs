'use strict';
const {test}=require('node:test');
const A=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const C=require('../../src/lite/core.js');
const SOURCE=path.resolve(__dirname,'../../src/lite/gestures.js');

// Native event dispatch exercises the controller. Only browser pointer capture
// is supplied at the DOM boundary; no gesture decisions are mocked.
function setup(){
 A.ok(fs.existsSync(SOURCE),'the gesture controller must be available');
 const G=require(SOURCE),doc=new EventTarget(),win=new EventTarget(),element=new EventTarget();
 const captures=new Set();let captureCalls=0,releaseCalls=0;
 doc.defaultView=win;element.ownerDocument=doc;
 element.setPointerCapture=id=>{captureCalls++;captures.add(id);};
 element.hasPointerCapture=id=>captures.has(id);
 element.releasePointerCapture=id=>{releaseCalls++;captures.delete(id);emit(doc,'lostpointercapture',{pointerId:id,target:element});};
 const gestures=G.bind(element);
 return {gestures,doc,win,element,captures,get captureCalls(){return captureCalls;},get releaseCalls(){return releaseCalls;},
  down:(extra={})=>pointer('pointerdown',{target:element,...extra}),
  emit:(type,extra={})=>emit(doc,type,extra)};
}
function pointer(type,extra={}){
 const event=new Event(type,{bubbles:true,cancelable:type!=='pointercancel'});
 const values={pointerId:7,pointerType:'touch',isPrimary:true,button:0,clientX:40,clientY:100,...extra};
 for(const [key,value]of Object.entries(values))Object.defineProperty(event,key,{value,configurable:true});
 return event;
}
function emit(target,type,extra={}){const event=pointer(type,extra);target.dispatchEvent(event);return event;}
function plan(x,options={}){
 const base={id:'task-a',start:600,end:660},original={start:600,end:660};
 let preview={...original},taps=0,moves=0;const writes=[],cancels=[],ends=[];
 const down=x.down({pointerType:'mouse',...options.pointer});
 const accepted=x.gestures.start(down,{allowPan:false,...options,
  onTap:()=>{taps++;},
  onMove:point=>{moves++;preview=C.timelineMove(original.start,original.end,point.dy/48*60);},
  onCommit:()=>writes.push({base,range:{...preview}}),
  onCancel:point=>{cancels.push(point.reason);preview={...original};},
  onEnd:point=>ends.push({reason:point.reason,active:x.gestures.active})
 });
 return {base,original,down,accepted,writes,cancels,ends,get preview(){return preview;},get taps(){return taps;},get moves(){return moves;}};
}

test('a touch tap selects once without taking scrolling or becoming a plan edit',()=>{
 const x=setup();let selected=0,writes=0,previews=0;
 const down=x.down();
 A.equal(x.gestures.start(down,{allowPan:true,onTap:()=>selected++,onMove:()=>previews++,onCommit:()=>writes++}),true);
 A.equal(x.gestures.active,true);A.equal(x.gestures.dragging,false);A.equal(down.defaultPrevented,false);
 const move=x.emit('pointermove',{clientX:43,clientY:104});A.equal(move.defaultPrevented,false);
 const up=x.emit('pointerup',{clientX:43,clientY:104});A.equal(up.defaultPrevented,false);
 x.emit('pointerup');
 A.equal(selected,1);A.equal(writes,0);A.equal(previews,0);A.equal(x.captureCalls,0);A.equal(x.gestures.active,false);
});

test('vertical touch swipes on empty time never open creation or write a plan',()=>{
 const x=setup();let created=0,writes=0;const canceled=[];
 const down=x.down();x.gestures.start(down,{allowPan:true,onTap:()=>created++,onCommit:()=>writes++,onCancel:point=>canceled.push(point.reason)});
 const move=x.emit('pointermove',{clientY:152});x.emit('pointercancel',{clientY:152});x.emit('pointerup',{clientY:152});
 A.equal(down.defaultPrevented,false);A.equal(move.defaultPrevented,false);A.equal(x.captureCalls,0);
 A.equal(created,0);A.equal(writes,0);A.deepEqual(canceled,['pan']);A.equal(x.gestures.active,false);
});

test('a touch that travels out and back cannot turn back into a tap',()=>{
 const x=setup();let taps=0;x.gestures.start(x.down(),{allowPan:true,onTap:()=>taps++});
 x.emit('pointermove',{clientX:55});x.emit('pointermove',{clientX:40});x.emit('pointerup');
 A.equal(taps,0);A.equal(x.gestures.active,false);
});

test('a distant touch release is not a tap even when no move event was delivered',()=>{
 const x=setup();let taps=0;x.gestures.start(x.down(),{allowPan:true,onTap:()=>taps++});
 x.emit('pointerup',{clientY:140});A.equal(taps,0);A.equal(x.captureCalls,0);A.equal(x.gestures.active,false);
});

test('mouse editing starts past the threshold and commits the final snapped preview once',()=>{
 const x=setup(),p=plan(x);
 A.equal(p.accepted,true);A.equal(p.down.defaultPrevented,true);A.equal(x.captureCalls,0);
 x.emit('pointermove',{pointerType:'mouse',clientY:102});A.equal(p.moves,0);A.equal(x.gestures.dragging,false);
 x.emit('pointermove',{pointerType:'mouse',clientY:124});A.equal(x.gestures.dragging,true);A.equal(x.captureCalls,1);
 A.deepEqual(p.preview,{start:630,end:690});A.equal(p.writes.length,0);
 x.emit('pointerup',{pointerType:'mouse',clientY:160});x.emit('pointerup',{pointerType:'mouse',clientY:170});
 A.equal(p.writes.length,1);A.strictEqual(p.writes[0].base,p.base);A.deepEqual(p.writes[0].range,{start:680,end:740});
 A.equal(p.taps,0);A.deepEqual(p.cancels,[]);A.deepEqual(p.ends,[{reason:'commit',active:false}]);
 A.equal(x.gestures.active,false);A.equal(x.releaseCalls,1);A.equal(x.captures.size,0);
});

test('explicit touch handles use the same deliberate drag path',()=>{
 const x=setup(),p=plan(x,{pointer:{pointerType:'touch'}});
 x.emit('pointermove',{clientY:148});x.emit('pointerup',{clientY:148});
 A.equal(p.down.defaultPrevented,true);A.equal(x.captureCalls,1);A.equal(p.writes.length,1);
 A.deepEqual(p.writes[0].range,{start:660,end:720});A.equal(p.taps,0);
});

test('secondary buttons and secondary pointers cannot start an interaction',()=>{
 const x=setup();let calls=0;
 for(const extra of [{pointerType:'mouse',button:2},{isPrimary:false,pointerId:9}]){
  const down=x.down(extra);A.equal(x.gestures.start(down,{onTap:()=>calls++,onCommit:()=>calls++}),false);A.equal(down.defaultPrevented,false);
 }
 x.emit('pointerup');A.equal(calls,0);A.equal(x.gestures.active,false);
});

test('events from another pointer neither move nor finish the active gesture',()=>{
 const x=setup(),p=plan(x);
 A.equal(x.gestures.start(x.down({pointerId:8}),{}),false);
 for(const type of ['pointermove','pointerup','pointercancel','lostpointercapture'])x.emit(type,{pointerId:8,clientY:200,target:x.element});
 A.equal(x.gestures.active,true);A.equal(p.moves,0);A.equal(p.writes.length,0);A.deepEqual(p.cancels,[]);
 x.emit('pointerup');A.equal(p.taps,1);A.equal(p.writes.length,0);
});

test('each cancellation restores a drag preview and prevents any later commit',async t=>{
 const routes={
  pointercancel:x=>x.emit('pointercancel',{clientY:148}),
  lostpointercapture:x=>{x.captures.delete(7);x.emit('lostpointercapture',{target:x.element});},
  blur:x=>emit(x.win,'blur'),
  escape:x=>{const e=emit(x.win,'keydown',{key:'Escape'});A.equal(e.defaultPrevented,true);},
  explicit:x=>A.equal(x.gestures.cancel('repaint'),true),
  destroy:x=>x.gestures.destroy()
 };
 for(const [name,stop]of Object.entries(routes))await t.test(name,()=>{
  const x=setup(),p=plan(x);x.emit('pointermove',{clientY:148});A.notDeepEqual(p.preview,p.original);
  stop(x);x.emit('pointermove',{clientY:196});x.emit('pointerup',{clientY:196});
  A.deepEqual(p.preview,p.original);A.equal(p.writes.length,0);A.equal(p.taps,0);
  A.equal(p.cancels.length,1);A.equal(p.ends.length,1);A.equal(p.ends[0].active,false);A.equal(x.gestures.active,false);
  A.equal(x.gestures.cancel(),false);A.equal(x.captures.size,0);
  const accepted=x.gestures.start(x.down(),{allowPan:true});A.equal(accepted,name!=='destroy');x.gestures.destroy();
 });
});

test('losing implicit capture during handoff to the explicit capture target is harmless',()=>{
 const x=setup(),initial=new EventTarget(),p=plan(x,{pointer:{pointerType:'touch',target:initial}});
 x.emit('pointermove',{clientY:148});x.emit('lostpointercapture',{target:initial});
 A.equal(x.gestures.active,true);A.deepEqual(p.cancels,[]);
 x.emit('pointerup',{clientY:148});A.equal(p.writes.length,1);
});

test('cancellation before movement cannot fall through to selection',()=>{
 const x=setup(),p=plan(x,{allowPan:true});x.emit('pointercancel');x.emit('pointerup');
 A.equal(p.taps,0);A.equal(p.writes.length,0);A.equal(p.cancels.length,1);A.equal(x.captureCalls,0);
});

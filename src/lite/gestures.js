/* Pointer lifetime for timeline taps and deliberate drag/resize handles. */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;else root.OneDayLiteGestures=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
 'use strict';

 // Call start() from a delegated pointerdown handler. CSS must already allow
 // native pan on tap surfaces and use touch-action:none on explicit touch grips.
 function bind(element){
  const doc=element.ownerDocument||root.document,win=doc?.defaultView||root;
  let current=null,destroyed=false;

  function point(s,event,reason){
   return {event:event||s.event,pointerId:s.pointerId,x:s.x,y:s.y,
    dx:s.x-s.startX,dy:s.y-s.startY,dragging:s.dragging,reason};
  }
  function finish(s,kind,event,reason=kind){
   if(current!==s)return false;
   const result=point(s,event,reason);current=null;
   for(const [target,type,listener]of s.listeners)target.removeEventListener(type,listener,true);
   if(s.captured){
    try{if(!s.captureTarget.hasPointerCapture||s.captureTarget.hasPointerCapture(s.pointerId))s.captureTarget.releasePointerCapture?.(s.pointerId);}catch(_){/* The browser may already have released capture. */}
   }
   // Clear the lifetime before callbacks so selection, conflict UI and teardown
   // may repaint without a stale pointerup committing the old preview again.
   try{if(kind==='tap')s.options.onTap?.(result);else if(kind==='commit')s.options.onCommit?.(result);else s.options.onCancel?.(result);}
   finally{s.options.onEnd?.(result);}
   return true;
  }
  function cancel(reason='cancel'){return current?finish(current,'cancel',null,reason):false;}

  function start(event,options={}){
   if(destroyed||current||event.isPrimary===false||(event.button!==undefined&&event.button!==0))return false;
   const allowPan=options.allowPan===true;
   const s={options,allowPan,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,
    x:event.clientX,y:event.clientY,event,dragging:false,captured:false,listeners:[],
    captureTarget:options.captureTarget||element,
    threshold:Number.isFinite(options.threshold)?Math.max(0,options.threshold):(allowPan?8:4)};
   current=s;
   const matches=ev=>current===s&&ev.pointerId===s.pointerId;
   function listen(target,type,listener){target.addEventListener(type,listener,{capture:true,passive:allowPan&&type!=='keydown'});s.listeners.push([target,type,listener]);}
   function update(ev,ending=false){
    if(!matches(ev))return;
    s.event=ev;s.x=ev.clientX;s.y=ev.clientY;
    const moved=Math.hypot(s.x-s.startX,s.y-s.startY)>s.threshold;
    if(allowPan){if(moved)finish(s,'cancel',ev,'pan');return;}
    if(!s.dragging&&moved){
     s.dragging=true;
     if(!ending&&s.captureTarget.setPointerCapture){
      try{s.captureTarget.setPointerCapture(s.pointerId);s.captured=true;}catch(_){/* Document listeners still track an available pointer. */}
     }
    }
    if(!s.dragging)return;
    if(ev.cancelable)ev.preventDefault();
    try{s.options.onMove?.(point(s,ev));}
    catch(error){finish(s,'cancel',ev,'error');throw error;}
   }
   function move(ev){update(ev);}
   function up(ev){if(!matches(ev))return;update(ev,true);if(current===s)finish(s,s.dragging?'commit':'tap',ev);}
   function aborted(ev){if(matches(ev))finish(s,'cancel',ev,'pointercancel');}
   function lost(ev){
    // A touch begins with implicit capture. Moving capture to our stable host
    // first releases that initial target; only losing our own capture ends edit.
    if(matches(ev)&&(!s.captured||ev.target===s.captureTarget))finish(s,'cancel',ev,'lostpointercapture');
   }
   function blur(ev){if(current===s)finish(s,'cancel',ev,'blur');}
   function key(ev){if(current!==s||ev.key!=='Escape'||ev.isComposing)return;ev.preventDefault();ev.stopImmediatePropagation();finish(s,'cancel',ev,'escape');}
   listen(doc,'pointermove',move);listen(doc,'pointerup',up);listen(doc,'pointercancel',aborted);listen(doc,'lostpointercapture',lost);
   listen(win,'blur',blur);listen(win,'keydown',key);
   if(!allowPan&&event.cancelable)event.preventDefault();
   return true;
  }
  return {start,cancel,destroy(){destroyed=true;cancel('destroy');},get active(){return current!==null;},get dragging(){return !!current?.dragging;}};
 }
 return {bind};
});

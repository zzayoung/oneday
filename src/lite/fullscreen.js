/* The same control works in the page and every modal, including mobile browsers. */
(function(){'use strict';const L=window.OneDayLite;let expanded=false,pending=null;
 const active=()=>!!document.fullscreenElement||expanded;
 L.fullscreenButton=()=>'<button type="button" class="icon-button fullscreen-toggle" data-act="fullscreen" aria-label="'+(active()?'退出全屏':'全屏')+'" aria-pressed="'+active()+'">'+L.icon(active()?'fullscreenExit':'fullscreen',18)+'</button>';
 L.paintFullscreen=function(root=document){
  const on=active(),label=on?(expanded&&!document.fullscreenElement?'退出展开视图':'退出全屏'):'全屏';
  document.documentElement.classList.toggle('app-expanded',on);
  root.querySelectorAll('[data-act="fullscreen"]').forEach(button=>{button.innerHTML=L.icon(on?'fullscreenExit':'fullscreen',18);button.setAttribute('aria-label',label);button.setAttribute('title',label);button.setAttribute('aria-pressed',String(on));});
 };
 L.toggleFullscreen=function(){
  if(pending)return pending;
  if(expanded){expanded=false;L.paintFullscreen();return Promise.resolve();}
  pending=(async()=>{
   if(document.fullscreenElement){await document.exitFullscreen();}
   else if(document.documentElement.requestFullscreen){try{await document.documentElement.requestFullscreen({navigationUI:'hide'});}catch{expanded=true;}}
   else expanded=true;
  })().finally(()=>{pending=null;L.paintFullscreen();});return pending;
 };
 document.addEventListener('fullscreenchange',()=>{expanded=false;L.paintFullscreen();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&expanded&&!event.defaultPrevented&&!event.isComposing){expanded=false;event.preventDefault();L.paintFullscreen();}});
 L.paintFullscreen();
})();

/* Pointer-driven Kanban reorder with live placeholder + FLIP displacement. */
(function(root){'use strict';
const M=root.matchMedia?.('(prefers-reduced-motion: reduce)');
function ids(list,skip=''){return [...list.querySelectorAll(':scope > [data-board-task-id]')].map(n=>n.dataset.boardTaskId).filter(id=>id&&id!==skip);}
function rects(root){const m=new Map();root.querySelectorAll('[data-board-task-id]:not(.board-drag-source)').forEach(el=>m.set(el.dataset.boardTaskId,el.getBoundingClientRect()));return m;}
function flip(root,before){if(M?.matches)return;root.querySelectorAll('[data-board-task-id]:not(.board-drag-source)').forEach(el=>{const a=before.get(el.dataset.boardTaskId),b=el.getBoundingClientRect();if(!a||!b)return;const dx=a.left-b.left,dy=a.top-b.top;if(Math.abs(dx)<1&&Math.abs(dy)<1)return;el.classList.add('board-flip-moving');const anim=el.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}],{duration:190,easing:'cubic-bezier(.2,.75,.25,1)'});anim.finished.catch(()=>{}).finally(()=>el.classList.remove('board-flip-moving'));});}
function mount(root,L){if(!root)return {destroy(){}};let state=null,pending=null,destroyed=false;
 function detach(){document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',cancel,true);document.removeEventListener('keydown',key,true);}
 function listen(){document.addEventListener('pointermove',move,true);document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',cancel,true);document.addEventListener('keydown',key,true);}
 function clearVisual(success=false){if(!state)return;const {card,placeholder,ghost,sourceList,targetList}=state;if(success&&placeholder?.isConnected){placeholder.replaceWith(card);}else placeholder?.remove();card.classList.remove('board-drag-source');card.style.removeProperty('visibility');ghost?.remove();root.classList.remove('is-sorting');root.querySelectorAll('.board-drop-target').forEach(n=>n.classList.remove('board-drop-target'));if(sourceList)sourceList.classList.remove('board-list-source');if(targetList)targetList.classList.remove('board-list-target');}
 function cleanup(){detach();pending=null;state=null;}
 function start(e){const p=pending;if(!p||state)return;const card=p.card,r=card.getBoundingClientRect(),sourceList=card.closest('.board-list'),sourceCol=card.closest('.board-col'),task=L.find(card.dataset.boardTaskId);if(!sourceList||!sourceCol||!task)return cancel();
  const placeholder=document.createElement('div');placeholder.className='board-drop-placeholder';placeholder.style.height=Math.max(36,r.height)+'px';sourceList.insertBefore(placeholder,card);card.classList.add('board-drag-source');card.style.visibility='hidden';
  const ghost=card.cloneNode(true);ghost.className=card.className.replace('board-drag-source','')+' board-drag-ghost';ghost.removeAttribute('data-board-task-id');ghost.style.visibility='visible';Object.assign(ghost.style,{position:'fixed',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',margin:'0',zIndex:'160',pointerEvents:'none'});document.body.append(ghost);
  state={id:card.dataset.boardTaskId,card,placeholder,ghost,sourceList,targetList:sourceList,sourceStatus:task['任务状态']||L.C.STATUS[0],offsetX:e.clientX-r.left,offsetY:e.clientY-r.top,lastX:e.clientX,lastY:e.clientY};root.classList.add('is-sorting');sourceList.classList.add('board-list-source','board-list-target');
 }
 function listAt(x,y){const el=document.elementFromPoint(x,y);const list=el?.closest?.('.board-list');if(list&&root.contains(list))return list;const col=el?.closest?.('.board-col');return col&&root.contains(col)?col.querySelector('.board-list'):null;}
 function movePlaceholder(list,y){if(!state||!list)return;const before=rects(root),cards=[...list.querySelectorAll(':scope > [data-board-task-id]:not(.board-drag-source)')];let ref=null;for(const c of cards){const r=c.getBoundingClientRect();if(y<r.top+r.height/2){ref=c;break;}}
  if(ref)list.insertBefore(state.placeholder,ref);else list.append(state.placeholder);if(state.targetList!==list){state.targetList?.classList.remove('board-list-target');state.targetList=list;list.classList.add('board-list-target');root.querySelectorAll('.board-drop-target').forEach(n=>n.classList.remove('board-drop-target'));list.closest('.board-col')?.classList.add('board-drop-target');}
  flip(root,before);
 }
 function autoScroll(x,y){if(!state)return;const list=state.targetList,lr=list?.getBoundingClientRect();if(lr){if(y<lr.top+38)list.scrollTop-=18;else if(y>lr.bottom-38)list.scrollTop+=18;}const rr=root.getBoundingClientRect();if(x<rr.left+42)root.scrollLeft-=18;else if(x>rr.right-42)root.scrollLeft+=18;}
 function move(e){if(pending&&!state){if(Math.hypot(e.clientX-pending.x,e.clientY-pending.y)<7)return;start(e);}if(!state)return;e.preventDefault();state.lastX=e.clientX;state.lastY=e.clientY;state.ghost.style.left=(e.clientX-state.offsetX)+'px';state.ghost.style.top=(e.clientY-state.offsetY)+'px';const list=listAt(e.clientX,e.clientY);if(list)movePlaceholder(list,e.clientY);autoScroll(e.clientX,e.clientY);}
 function desired(list,id,placeholder){const out=[];for(const n of list.children){if(n===placeholder){out.push(id);continue;}if(n.matches?.('[data-board-task-id]')&&!n.classList.contains('board-drag-source'))out.push(n.dataset.boardTaskId);}return out;}
 async function persist(snapshot){const {id,sourceStatus,targetStatus,sourceIds,targetIds,same}=snapshot;const before=L.find(id);if(!before)return;if(targetStatus!==sourceStatus){await L.changeStatus(id,targetStatus);const changed=L.find(id);if(!changed||changed['任务状态']!==targetStatus)return;}
  const groups=same?[targetIds]:[sourceIds,targetIds];for(const group of groups){for(let i=0;i<group.length;i++){const tid=group[i],task=L.find(tid);if(!task||Number(task['排序序号'])===i)continue;await L.store.patch('tasks',tid,{'排序序号':{number:i}},task);}}
 }
 function up(e){if(pending&&!state){detach();pending=null;return;}if(!state)return;const s=state,targetList=s.targetList||s.sourceList,targetCol=targetList.closest('.board-col'),targetStatus=targetCol?.dataset.dropStatus||s.sourceStatus,same=targetList===s.sourceList,sourceIds=same?[]:ids(s.sourceList,s.id),targetIds=desired(targetList,s.id,s.placeholder);const snap={id:s.id,sourceStatus:s.sourceStatus,targetStatus,sourceIds,targetIds,same};clearVisual(true);cleanup();L.run(()=>persist(snap));}
 function cancel(){if(!pending&&!state)return;if(state)clearVisual(false);cleanup();}
 function key(e){if(e.key==='Escape'&&(pending||state)){e.preventDefault();e.stopPropagation();cancel();}}
 function down(e){if(destroyed||e.button!==0||pending||state)return;const card=e.target.closest?.('[data-board-task-id]');if(!card||!root.contains(card))return;if(e.target.closest('button,a,input,textarea,select,[contenteditable=true]'))return;pending={card,x:e.clientX,y:e.clientY,pointerId:e.pointerId};listen();}
 root.addEventListener('pointerdown',down);
 return {destroy(){destroyed=true;root.removeEventListener('pointerdown',down);if(state)clearVisual(false);cleanup();}};
}
root.OneDayLiteBoard={mount};
})(window);

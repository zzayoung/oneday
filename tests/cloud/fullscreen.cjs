'use strict';
const {test}=require('node:test'),A=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(native=true){
 const listeners=new Map(),classes=new Set(),buttons=[{attrs:{},setAttribute(k,v){this.attrs[k]=String(v);}}],doc={fullscreenElement:null,documentElement:{classList:{toggle(k,on){on?classes.add(k):classes.delete(k);}}},querySelectorAll:()=>buttons,addEventListener:(name,fn)=>listeners.set(name,fn)};
 const fire=name=>listeners.get(name)?.({key:'Escape',defaultPrevented:false,isComposing:false,preventDefault(){this.defaultPrevented=true;}});
 if(native){doc.documentElement.requestFullscreen=async()=>{doc.fullscreenElement=doc.documentElement;fire('fullscreenchange');};doc.exitFullscreen=async()=>{doc.fullscreenElement=null;fire('fullscreenchange');};}
 const L={icon:name=>name},context={window:{OneDayLite:L},document:doc};vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../../src/lite/fullscreen.js'),'utf8'),context);
 return {L,doc,buttons,classes,fire};
}
test('fullscreen button enters native fullscreen and exits using the same control',async()=>{
 const x=setup();await x.L.toggleFullscreen();A.equal(x.doc.fullscreenElement,x.doc.documentElement);A.equal(x.buttons[0].attrs['aria-pressed'],'true');A.equal(x.buttons[0].attrs['aria-label'],'退出全屏');
 await x.L.toggleFullscreen();A.equal(x.doc.fullscreenElement,null);A.equal(x.buttons[0].attrs['aria-pressed'],'false');
});
test('native fullscreen exit synchronizes every icon and expanded layout',async()=>{
 const x=setup();await x.L.toggleFullscreen();x.doc.fullscreenElement=null;x.fire('fullscreenchange');A.equal(x.classes.has('app-expanded'),false);A.equal(x.buttons[0].innerHTML,'fullscreen');
});
test('unsupported or refused native fullscreen falls back to a reversible expanded layout',async()=>{
 for(const reject of [false,true]){const x=setup(reject);if(reject)x.doc.documentElement.requestFullscreen=async()=>{throw Error('not supported');};await x.L.toggleFullscreen();A.equal(x.classes.has('app-expanded'),true);A.equal(x.buttons[0].attrs['aria-label'],'退出展开视图');await x.L.toggleFullscreen();A.equal(x.classes.has('app-expanded'),false);}
});
test('Escape cancels expanded fallback without closing the dialog beneath it',async()=>{
 const x=setup(false);await x.L.toggleFullscreen();x.fire('keydown');A.equal(x.classes.has('app-expanded'),false);A.equal(x.buttons[0].attrs['aria-pressed'],'false');
});

/* OneDay Lite 1.3 visual themes + occasional calendar reflection. */
(function(root){'use strict';
const THEMES={
 'glass-day':{name:'晨光玻璃',color:'#eef5f2',reflection:true},
 paper:{name:'原纸',color:'#f5efe5',reflection:false},
 night:{name:'夜色',color:'#111916',reflection:true},
 'color-block':{name:'彩块',color:'#f7f3ea',reflection:true},
 minimal:{name:'极简',color:'#f7f8f5',reflection:false},
 'warm-paper':{name:'暖纸',color:'#f4efe6',reflection:false,description:'奶油纸面 · 焦糖笔触',palette:['#f4efe6','#fffdf7','#86603d']},
 'mist-blue':{name:'雾蓝',color:'#edf2fa',reflection:false,description:'清透蓝灰 · 从容留白',palette:['#edf2fa','#ffffff','#4365a4']},
 pine:{name:'松间',color:'#edf3ee',reflection:false,description:'柔和叶绿 · 自然呼吸',palette:['#edf3ee','#fbfdf9','#356b57']},
 'deep-sea':{name:'深海',color:'#101b2d',reflection:false,description:'深蓝夜色 · 冰蓝微光',palette:['#101b2d','#1b2b43','#8ac7ec']}
};
const IDS=Object.keys(THEMES);let timer=0,seq=0;
function normalize(id){if(IDS.includes(id))return id;if(id==='dark')return 'night';if(id==='light')return 'glass-day';if(id==='system')return root.matchMedia?.('(prefers-color-scheme:dark)').matches?'night':'glass-day';return 'glass-day';}
function apply(id){id=normalize(id);document.documentElement.dataset.theme=id;const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=THEMES[id].color;return id;}
function reduced(){return !!root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;}
function triggerReflection(node=document.querySelector('.calendar-main')){const id=normalize(document.documentElement.dataset.theme);if(!node||reduced()||!THEMES[id].reflection)return false;node.classList.remove('reflection-sweep');void node.offsetWidth;node.classList.add('reflection-sweep');root.setTimeout(()=>node.classList.remove('reflection-sweep'),1450);return true;}
function scheduleReflection(node){clearTimeout(timer);if(!node||reduced()||!THEMES[normalize(document.documentElement.dataset.theme)].reflection)return;const delay=18000+((seq++*7919)%17001);timer=root.setTimeout(()=>{if(node.isConnected)triggerReflection(node);scheduleReflection(node.isConnected?node:document.querySelector('.calendar-main'));},delay);}
root.OneDayLiteThemes={themes:THEMES,ids:IDS,normalize,apply,triggerReflection,scheduleReflection};
})(window);

/* OneDay Lite attachment gateway. Formal builds never pretend a WorkBuddy upload succeeded. */
(function(root,factory){root.OneDayLiteAttachments=factory(root.OneDayLiteCore);})(typeof window!=='undefined'?window:this,function(C){
'use strict';
function pickUrl(result){
 if(typeof result==='string')return result;
 if(!result||typeof result!=='object')return '';
 for(const key of ['url','fileUrl','downloadUrl','src','link'])if(typeof result[key]==='string')return result[key];
 const nested=result.file||result.data||result.result;
 return nested&&nested!==result?pickUrl(nested):'';
}
function normalize(result){
 const raw=String(pickUrl(result)||'').trim();if(!raw)throw Error('附件上传没有返回可用地址');
 let u;try{u=new URL(raw,location.href);}catch(_){throw Error('附件地址无效');}
 const protocol=u.protocol.toLowerCase();
 if(protocol!=='https:'&&protocol!=='http:')throw Error('附件地址协议不安全');
 if(protocol==='http:'&&!root.__ONEDAY_LOCAL__)throw Error('正式环境附件必须使用 HTTPS 地址');
 return {url:u.href,name:(result&&result.name)||'',previewOnly:!!(result&&result.previewOnly)};
}
function create(store){
 const api={
  canUploadImage:()=>!!store&&typeof store.uploadImage==='function',
  canUploadFile:()=>!!store&&typeof store.uploadFile==='function'&&(!store.canUploadFile||store.canUploadFile()),
  async uploadImage(file,owner){if(!api.canUploadImage())throw Error('当前 WorkBuddy 环境尚未开放图片上传');return normalize(await store.uploadImage({file,owner,folder:'TODO工作台-附件'}));},
  async uploadFile(file,owner){if(!api.canUploadFile())throw Error('当前 WorkBuddy 环境尚未开放文档附件上传');return normalize(await store.uploadFile({file,owner,folder:'TODO工作台-附件'}));}
 };return api;
}
return {create,normalize};
});

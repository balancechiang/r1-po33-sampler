/* Independent recovery UI: never turns a failed restore into an empty writable project. */
(function(root){'use strict';
 let timer;
 function show(message){
  clearTimeout(timer);if(document.getElementById('startupRecovery'))return;
  const box=document.createElement('section');box.id='startupRecovery';box.setAttribute('role','alert');box.style.cssText='position:fixed;inset:0;z-index:9999;background:#111;color:white;padding:16px;box-sizing:border-box;overflow:auto;font:14px/1.5 Arial';
  const text=document.createElement('p');text.textContent=message||'Startup did not finish. / 启动未完成。';
  const hint=document.createElement('p');hint.textContent='请退出 Creation，再重新打开使更新生效。浏览器可点击下方重新载入。用户数据保留，尚未恢复的工程不会被覆盖。';
  const retry=document.createElement('button');retry.textContent='Reload / 重新载入';retry.onclick=()=>location.replace('./creation.html?refresh='+Date.now());retry.style.cssText='padding:10px;font:inherit';
  box.append(text,hint,retry);document.body.append(box);document.getElementById('instrument')?.setAttribute('inert','');
 }
 root.PO33Startup={fail:show,ready(){clearTimeout(timer);document.getElementById('startupRecovery')?.remove();}};
 timer=setTimeout(()=>{if(document.body?.dataset.loading!=='false')show('Update requires reopening / 更新后需要重新打开');},30000);
})(window);

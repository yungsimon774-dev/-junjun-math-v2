export function initOffline(){
  if(!('serviceWorker' in navigator))return;
  const status=document.querySelector('#offlineStatus');
  const notice=document.querySelector('#updateNotice');
  const update=document.querySelector('#applyUpdate');
  let reloading=false;
  const show=text=>{status.textContent=text;status.classList.remove('hidden')};
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)location.reload()});
  navigator.serviceWorker.addEventListener('message',event=>{
    if(event.data?.type==='OFFLINE_READY'&&event.data.release==='120170')show('当前版本的离线文件已完整校验并保存。学习记录仍保存在本机，请定期导出。');
  });
  navigator.serviceWorker.register('./sw.js?v=120170').then(registration=>{
    const waiting=()=>{
      if(!registration.waiting)return;
      notice.classList.remove('hidden');
      update.onclick=()=>{
        reloading=true;update.disabled=true;update.textContent='正在更新…';
        const worker=registration.waiting;
        worker?.addEventListener('statechange',()=>{if(worker.state==='activated')location.reload()});
        worker?.postMessage({type:'ACTIVATE'});
      };
    };
    waiting();
    registration.addEventListener('updatefound',()=>{
      const worker=registration.installing;
      worker?.addEventListener('statechange',()=>{
        if(worker.state==='installed'){
          waiting();if(!navigator.serviceWorker.controller)show('当前版本的离线文件已完整校验并保存。');
        }else if(worker.state==='redundant')show('离线更新未完成，当前页面可联网使用。请联网刷新后再试。');
      });
    });
  }).catch(()=>show('当前浏览器未建立离线包；请保持联网使用。学习记录请定期导出。'));
}

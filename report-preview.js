const tabs=[...document.querySelectorAll('[role="tab"]')];
function selectTab(tab,updateLocation=false){
  tabs.forEach(item=>{const active=item===tab;item.setAttribute('aria-selected',String(active));item.tabIndex=active?0:-1;document.getElementById(item.getAttribute('aria-controls')).hidden=!active;});
  if(updateLocation)history.replaceState(null,'','#'+tab.getAttribute('aria-controls'));
}
function restoreSection(){
  const id=location.hash.slice(1), target=document.getElementById(id);
  const panel=target?.closest('[role="tabpanel"]');
  if(!panel)return;
  selectTab(tabs.find(tab=>tab.getAttribute('aria-controls')===panel.id));
  requestAnimationFrame(()=>target.scrollIntoView({block:'start'}));
}
tabs.forEach((tab,index)=>{
  tab.addEventListener('click',()=>selectTab(tab,true));
  tab.addEventListener('keydown',event=>{
    let next;
    if(event.key==='ArrowRight')next=tabs[(index+1)%tabs.length];
    if(event.key==='ArrowLeft')next=tabs[(index+tabs.length-1)%tabs.length];
    if(event.key==='Home')next=tabs[0];
    if(event.key==='End')next=tabs[tabs.length-1];
    if(next){event.preventDefault();selectTab(next,true);next.focus();}
  });
});
window.addEventListener('hashchange',restoreSection);
restoreSection();

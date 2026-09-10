const artwork=document.querySelector('#art');
const plane=document.querySelector('.photo-plane');
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
if(window.matchMedia('(pointer: fine)').matches){
 artwork.addEventListener('pointermove',event=>{
  if(reduced.matches)return;
  const box=artwork.getBoundingClientRect();
  const x=(event.clientX-box.left)/box.width,y=(event.clientY-box.top)/box.height;
  plane.style.setProperty('--ry',((x-.5)*3)+'deg');
  plane.style.setProperty('--rx',((.5-y)*2)+'deg');
  plane.style.setProperty('--lx',(x*100)+'%');plane.style.setProperty('--ly',(y*100)+'%');
 });
 artwork.addEventListener('pointerleave',()=>{plane.style.setProperty('--ry','0deg');plane.style.setProperty('--rx','0deg');});
}
document.querySelector('#practice-toggle').addEventListener('click',event=>{
 const button=event.currentTarget,field=document.querySelector('#practice');
 const open=button.getAttribute('aria-expanded')!=='true';
 button.setAttribute('aria-expanded',String(open));field.hidden=!open;
 button.replaceChildren(document.createTextNode(open?'收起小箋 ':'寫給自己 '));
 const symbol=document.createElement('span');symbol.textContent=open?'−':'＋';button.append(symbol);
 if(open)document.querySelector('#reflection').focus();
});
const reportTabs=[...document.querySelectorAll('.report-tabs [role="tab"]')];
function selectReport(tab){
 reportTabs.forEach(item=>{
  const active=item===tab;
  item.setAttribute('aria-selected',String(active));item.tabIndex=active?0:-1;
  document.getElementById(item.getAttribute('aria-controls')).hidden=!active;
 });
}
reportTabs.forEach((tab,index)=>{
 tab.addEventListener('click',()=>selectReport(tab));
 tab.addEventListener('keydown',event=>{
  let next;
  if(event.key==='ArrowRight'||event.key==='ArrowLeft')next=reportTabs[(index+1)%reportTabs.length];
  if(event.key==='Home')next=reportTabs[0];
  if(event.key==='End')next=reportTabs[reportTabs.length-1];
  if(next){event.preventDefault();selectReport(next);next.focus();}
 });
});
const responses={
 relationship:'回想一次說不出口的拒絕：當時，妳最怕失去什麼？',
 change:'知道與做到之間，可能還隔著一個難以鬆手的習慣。先選一件很小的事，看看改變卡在哪一步。',
 direction:'先把「應該」放旁邊。回想最近一次讓妳覺得有精神的時刻，那裡也許藏著值得追問的線索。'
};
document.querySelectorAll('[data-question]').forEach(button=>button.addEventListener('click',()=>{
 document.querySelectorAll('[data-question]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
 document.querySelector('#question-response').textContent=responses[button.dataset.question];
 button.after(document.querySelector('.entry-response'));
}));
const preview=document.querySelector('#report-preview');
document.querySelector('#open-preview').addEventListener('click',()=>preview.showModal());
document.querySelector('#close-preview').addEventListener('click',()=>preview.close());

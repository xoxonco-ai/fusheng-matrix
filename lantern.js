/* 浮生羅盤 · shared behaviour for content pages (nav, menu, reveal, reading progress) */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const body = document.body, nav = $('#nav'), burger = $('#burger'), bar = $('#progress');

  const onScroll = () => {
    if (nav) nav.classList.toggle('is-stuck', scrollY > 40);
    if (bar) {
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
    }
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  if (burger) {
    const setMenu = open => {
      body.classList.toggle('menu-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? '關閉選單' : '開啟選單');
      document.documentElement.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', () => setMenu(!body.classList.contains('menu-open')));
    $$('#menu a').forEach(a => a.addEventListener('click', () => setMenu(false)));
    addEventListener('keydown', e => e.key === 'Escape' && setMenu(false));
    addEventListener('resize', () => innerWidth > 900 && setMenu(false));
  }

  const rv = $$('.rv');
  if (reduce || !('IntersectionObserver' in window)) rv.forEach(n => n.classList.add('in'));
  else {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .08, rootMargin: '0px 0px -5% 0px' });
    rv.forEach(n => io.observe(n));
    setTimeout(() => rv.forEach(n => { const r = n.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) n.classList.add('in'); }), 1200);
  }

  // one FAQ answer open at a time feels calmer; keep native <details> semantics
  const qs = $$('.faq details');
  qs.forEach(d => d.addEventListener('toggle', () => { if (d.open) qs.forEach(o => o !== d && (o.open = false)); }));
})();

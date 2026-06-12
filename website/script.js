/* FitAvo – fitavo.eu · Interaktionen & Scroll-Animationen (Vanilla JS, 0 Abh.) */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Header verdichten + Scroll-Fortschritt ---- */
  var header = document.querySelector('.header');
  var bar = document.querySelector('.progress-bar');
  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop;
    if (header) header.classList.toggle('scrolled', y > 24);
    if (bar) {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? (y / h) * 100 : 0) + '%';
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- Scroll-Reveal mit automatischem Stagger ---- */
  var reveals = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  // Geschwister gestaffelt einblenden (Karten-Raster kaskadieren)
  var groups = {};
  reveals.forEach(function (el) {
    var p = el.parentNode;
    var key = (p && p.dataset && p.dataset.stagger !== undefined) ? '' : null;
    if (key === null) return;
    if (!groups[p.__gid]) { p.__gid = Math.random().toString(36); groups[p.__gid] = 0; }
  });
  reveals.forEach(function (el) {
    var p = el.parentNode;
    if (p && p.dataset && p.dataset.stagger !== undefined) {
      var i = Array.prototype.indexOf.call(p.children, el);
      el.style.transitionDelay = Math.min(i, 6) * 85 + 'ms';
    }
  });

  if (reduce || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ---- Mobile-Menü ---- */
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
    });
  }

  /* ---- Sanftes Scrollen mit Header-Versatz + Menü schließen ---- */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (ev) {
      var id = a.getAttribute('href');
      if (id === '#' || id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      ev.preventDefault();
      if (links && links.classList.contains('open')) {
        links.classList.remove('open'); if (toggle) toggle.classList.remove('open'); document.body.style.overflow = '';
      }
      var top = target.getBoundingClientRect().top + window.scrollY - 78;
      window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
    });
  });

  /* ---- FAQ-Akkordeon ---- */
  document.querySelectorAll('.faq-item').forEach(function (item) {
    var q = item.querySelector('.faq-q');
    var a = item.querySelector('.faq-a');
    if (!q || !a) return;
    q.addEventListener('click', function () {
      var open = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(function (o) {
        if (o !== item) { o.classList.remove('open'); var oa = o.querySelector('.faq-a'); if (oa) oa.style.maxHeight = null; var oq = o.querySelector('.faq-q'); if (oq) oq.setAttribute('aria-expanded', 'false'); }
      });
      item.classList.toggle('open', !open);
      q.setAttribute('aria-expanded', !open ? 'true' : 'false');
      a.style.maxHeight = !open ? a.scrollHeight + 'px' : null;
    });
  });

  /* ---- Zahlen hochzählen ---- */
  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-count')) || 0;
    var suffix = el.getAttribute('data-suffix') || '';
    var dur = 1500, start = null;
    function step(ts) {
      if (!start) start = ts;
      var prog = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - prog, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (prog < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var counters = document.querySelectorAll('[data-count]');
  if (reduce || !('IntersectionObserver' in window)) {
    counters.forEach(function (el) { el.textContent = el.getAttribute('data-count') + (el.getAttribute('data-suffix') || ''); });
  } else {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { countUp(e.target); cio.unobserve(e.target); } });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { cio.observe(el); });
  }

  /* ---- App-Mockup beleben (Kalorienring + Makro-Balken) ---- */
  function animateMockup() {
    var ring = document.querySelector('.ring');
    if (ring) ring.style.setProperty('--p', (ring.getAttribute('data-deg') || '245') + 'deg');
    document.querySelectorAll('.macro .bar i').forEach(function (i) {
      i.style.width = (i.getAttribute('data-w') || '60') + '%';
    });
  }
  setTimeout(animateMockup, reduce ? 0 : 450);

  /* ---- Jahr im Footer ---- */
  var yr = document.getElementById('year');
  if (yr) yr.textContent = new Date().getFullYear();
})();

/* ==========================================================================
   Jenny 98 — window manager, taskbar, Start menu, boot, sounds & sparkles.
   Plain JS, no dependencies. All content lives in index.html; this file only
   turns it into a desktop. Without JS (or in "plain view") it's a normal page.
   ========================================================================== */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const html = document.documentElement;
  const desktop = $('#desktop');
  const winLayer = $('#windows');
  const tasks = $('#tasks');
  const mqMobile = matchMedia('(max-width: 640px)');
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const isPlain = () => html.classList.contains('plain');

  // ------------------------------------------------------------------------
  // Storage (every access guarded: private mode / blocked storage just means
  // nothing is remembered)
  // ------------------------------------------------------------------------
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (_) { return fallback; }
    },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* ignore */ } },
  };

  // ------------------------------------------------------------------------
  // Display settings
  // ------------------------------------------------------------------------
  const WALLS = [
    { id: 'rose', name: 'Rose', color: '#bc4c86', label: '#ffffff' },
    { id: 'bubblegum', name: 'Bubblegum', color: '#f4a6c6', label: '#000000' },
    { id: 'blush', name: 'Blush', color: '#e8bccd', label: '#000000' },
    { id: 'hotpink', name: 'Hot Pink', color: '#d6247a', label: '#ffffff' },
    { id: 'mauve', name: 'Mauve', color: '#94587a', label: '#ffffff' },
    { id: 'lilac', name: 'Lilac', color: '#c3a3d9', label: '#000000' },
    { id: 'teal', name: 'Classic Teal', color: '#008080', label: '#ffffff' },
  ];
  const PATTERNS = [
    { id: 'none', name: '(None)' },
    { id: 'hearts', name: 'Hearts' },
    { id: 'sparkles', name: 'Sparkles' },
    { id: 'checks', name: 'Checks' },
    { id: 'dither', name: 'Dither' },
  ];
  const DEFAULTS = { wall: 'rose', pattern: 'none', sparkles: true, glitter: true, sound: true, bootEvery: false };
  let settings = { ...DEFAULTS, ...store.get('j98.settings', {}) };

  const wallFor = id => WALLS.find(w => w.id === id) || WALLS[0];

  function applySettings(s) {
    const wall = wallFor(s.wall);
    html.style.setProperty('--desktop', wall.color);
    html.style.setProperty('--icon-label', wall.label);
    if (s.pattern && s.pattern !== 'none') html.dataset.pattern = s.pattern;
    else delete html.dataset.pattern;
    html.classList.toggle('no-glitter', !s.glitter);
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = wall.color;
    updateVolume();
  }

  function saveSettings() {
    const wall = wallFor(settings.wall);
    // desktop/label are duplicated so the inline <head> script can paint them before CSS loads
    store.set('j98.settings', { ...settings, desktop: wall.color, label: wall.label });
  }

  // ------------------------------------------------------------------------
  // Sound — everything is synthesized with Web Audio (no audio files).
  // Browsers only allow audio after a user gesture, so the context is created
  // on the first click/keypress.
  // ------------------------------------------------------------------------
  let audio = null;
  let bus = null;

  function unlockAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audio) {
      audio = new AC();
      const master = audio.createGain();
      master.gain.value = 0.5;
      const delay = audio.createDelay();
      delay.delayTime.value = 0.23;
      const feedback = audio.createGain();
      feedback.gain.value = 0.28;
      delay.connect(feedback).connect(delay);
      bus = audio.createGain();
      bus.connect(master);
      bus.connect(delay);
      delay.connect(master);
      master.connect(audio.destination);
    }
    if (audio.state === 'suspended') audio.resume();
  }
  addEventListener('pointerdown', unlockAudio, { passive: true });
  addEventListener('keydown', unlockAudio);

  const canPlay = () => settings.sound && audio && audio.state === 'running';

  function tone(freq, at, dur, type = 'sine', peak = 0.1, attack = 0.02) {
    const osc = audio.createOscillator();
    const env = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(peak, at + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(env).connect(bus);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  // The "Jenny 98" startup chime: an original rising A♭maj9 arpeggio over a soft pad.
  function chime() {
    if (!canPlay()) return;
    const t = audio.currentTime + 0.05;
    tone(103.83, t, 3.4, 'triangle', 0.05, 0.5);
    tone(207.65, t, 3.2, 'triangle', 0.04, 0.6);
    tone(311.13, t + 0.1, 3.0, 'sine', 0.05, 0.6);
    [415.3, 523.25, 622.25, 783.99, 932.33].forEach((f, i) => tone(f, t + i * 0.17, 1.8, 'sine', 0.08, 0.015));
    tone(1046.5, t + 0.95, 2.3, 'triangle', 0.035, 0.05);
    tone(1244.51, t + 1.05, 2.2, 'sine', 0.03, 0.05);
    tone(1567.98, t + 1.15, 2.0, 'sine', 0.02, 0.05);
  }

  function ding() {
    if (!canPlay()) return;
    const t = audio.currentTime;
    tone(1318.5, t, 0.45, 'sine', 0.07);
    tone(1975.5, t + 0.05, 0.4, 'sine', 0.035);
  }

  // ------------------------------------------------------------------------
  // Window manager
  // ------------------------------------------------------------------------
  const SIZES = {
    profile: [900, 0], resume: [580, 540], writing: [780, 500], talks: [860, 520], book: [660, 440],
    apps: [720, 560], contact: [540, 480], computer: [460, 480], recycle: [600, 300], help: [520, 470],
    find: [620, 440], run: [380, 196], settings: [430, 500],
  };
  const DIALOG_LIKE = new Set(['computer', 'settings', 'run']);
  const open = new Map(); // id -> { el, task, minimized, opener }
  let zTop = 10;
  let cascade = 0;
  let activeId = null;

  const deskSize = () => ({ w: desktop.clientWidth, h: desktop.clientHeight });
  const winEl = id => {
    const el = document.getElementById(id);
    return el && el.classList.contains('window') ? el : null;
  };

  function place(id, el) {
    const { w: dw, h: dh } = deskSize();
    let [w, h] = SIZES[id] || [560, 420];
    w = Math.min(w, dw - 12);
    h = h ? Math.min(h, dh - 12) : dh - 20;
    let x;
    let y;
    if (id === 'profile') {
      x = Math.round((dw - w) / 2);
      x = Math.max(Math.min(x, dw - w - 8), Math.min(100, dw - w - 4), 4);
      y = 8;
    } else if (id === 'run') {
      x = 6;
      y = dh - h - 6;
    } else if (DIALOG_LIKE.has(id)) {
      x = Math.round((dw - w) / 2);
      y = Math.max(8, Math.round((dh - h) / 3));
    } else {
      const step = cascade++ % 7;
      x = 120 + step * 26;
      y = 18 + step * 24;
      if (x + w > dw - 4) x = Math.max(4, dw - w - 4);
      if (y + h > dh - 4) y = Math.max(4, dh - h - 4);
    }
    Object.assign(el.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
  }

  function makeTask(id, el) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'task-btn';
    btn.dataset.task = id;
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = `<svg class="ico" aria-hidden="true"><use href="#${el.dataset.icon}"/></svg><span></span>`;
    btn.querySelector('span').textContent = el.dataset.task || id;
    btn.title = el.dataset.task || id;
    btn.addEventListener('click', () => {
      const st = open.get(id);
      if (st && activeId === id && !st.minimized) minimize(id);
      else openWin(id, { opener: btn });
    });
    tasks.append(btn);
    return btn;
  }

  function topmost() {
    let best = null;
    let bestZ = -1;
    for (const [id, st] of open) {
      const z = +st.el.style.zIndex || 0;
      if (!st.minimized && z > bestZ) { best = id; bestZ = z; }
    }
    return best;
  }

  function focusWin(id, moveFocus = true) {
    const st = open.get(id);
    if (!st) return;
    st.el.style.zIndex = ++zTop;
    activeId = id;
    for (const [k, s] of open) {
      const on = k === id;
      s.el.classList.toggle('active', on);
      s.task.setAttribute('aria-pressed', String(on && !s.minimized));
    }
    if (moveFocus) {
      const target = $('[data-autofocus]', st.el) || $('.title-text', st.el);
      target.focus({ preventScroll: true });
    }
  }

  function setHash(id) {
    const url = id ? `#${id}` : location.pathname + location.search;
    if (location.hash !== (id ? `#${id}` : '')) history.replaceState(null, '', url);
  }

  const onOpen = {}; // per-app hooks, filled in below

  function openWin(id, opts = {}) {
    const el = winEl(id);
    if (!el) return;
    closeStart();
    if (isPlain()) {
      el.scrollIntoView({ behavior: mqReduce.matches ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    let st = open.get(id);
    const isNew = !st;
    if (isNew) {
      if (!el.dataset.placed) { place(id, el); el.dataset.placed = '1'; }
      st = { el, minimized: false, opener: opts.opener || document.activeElement };
      st.task = makeTask(id, el);
      open.set(id, st);
      if (window.plausible && opts.track !== false) window.plausible('pageview', { u: `${location.origin}${location.pathname}#${id}` });
    }
    st.minimized = false;
    el.hidden = false;
    focusWin(id, opts.focus !== false);
    setHash(id);
    if (onOpen[id]) onOpen[id](el, opts, isNew);
  }

  function closeWin(id) {
    const st = open.get(id);
    if (!st) return;
    st.el.hidden = true;
    st.el.classList.remove('active', 'maximized');
    st.task.remove();
    open.delete(id);
    const next = topmost();
    if (next) focusWin(next, false);
    else activeId = null;
    setHash(next);
    const opener = st.opener;
    if (opener && document.contains(opener) && opener.offsetParent !== null) opener.focus({ preventScroll: true });
    else if (next) $('.title-text', open.get(next).el).focus({ preventScroll: true });
    else $('#startBtn').focus();
  }

  function minimize(id) {
    const st = open.get(id);
    if (!st) return;
    st.minimized = true;
    st.el.hidden = true;
    st.task.setAttribute('aria-pressed', 'false');
    const next = topmost();
    if (next) focusWin(next, false);
    else activeId = null;
    setHash(next);
    st.task.focus();
  }

  function toggleMax(id) {
    const st = open.get(id);
    if (!st || mqMobile.matches) return;
    const on = st.el.classList.toggle('maximized');
    const btn = $('.t-max', st.el);
    if (btn) btn.setAttribute('aria-label', on ? 'Restore' : 'Maximize');
  }

  // Title-bar buttons and [data-close]
  winLayer.addEventListener('click', e => {
    const win = e.target.closest('.window');
    if (!win || win.classList.contains('dialog')) return;
    const id = win.dataset.app;
    if (e.target.closest('.t-min')) minimize(id);
    else if (e.target.closest('.t-max')) toggleMax(id);
    else if (e.target.closest('.t-close, [data-close]')) closeWin(id);
  });

  winLayer.addEventListener('dblclick', e => {
    const bar = e.target.closest('.title-bar');
    if (bar && !e.target.closest('button')) toggleMax(bar.closest('.window').dataset.app);
  });

  // Focus on press, drag by title bar, resize from the grip
  winLayer.addEventListener('pointerdown', e => {
    const win = e.target.closest('.window');
    if (!win || isPlain()) return;
    const id = win.dataset.app;
    if (open.has(id) && activeId !== id) focusWin(id, false);
    if (e.button !== 0 || mqMobile.matches) return;
    if (e.target.closest('.resize-grip')) startResize(e, win);
    else if (e.target.closest('.title-bar') && !e.target.closest('button') && !win.classList.contains('maximized')) startDrag(e, win);
  });

  function track(e, onMove) {
    e.preventDefault();
    const stop = () => {
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerup', stop);
      removeEventListener('pointercancel', stop);
      document.body.style.userSelect = '';
    };
    document.body.style.userSelect = 'none';
    addEventListener('pointermove', onMove);
    addEventListener('pointerup', stop);
    addEventListener('pointercancel', stop);
  }

  function startDrag(e, win) {
    const sx = e.clientX;
    const sy = e.clientY;
    const ox = win.offsetLeft;
    const oy = win.offsetTop;
    const { w: dw, h: dh } = deskSize();
    track(e, ev => {
      const x = Math.min(Math.max(ox + ev.clientX - sx, 64 - win.offsetWidth), dw - 64);
      const y = Math.min(Math.max(oy + ev.clientY - sy, 0), dh - 22);
      win.style.left = `${x}px`;
      win.style.top = `${y}px`;
    });
  }

  function startResize(e, win) {
    const sx = e.clientX;
    const sy = e.clientY;
    const ow = win.offsetWidth;
    const oh = win.offsetHeight;
    const { w: dw, h: dh } = deskSize();
    track(e, ev => {
      win.style.width = `${Math.min(Math.max(ow + ev.clientX - sx, 260), dw - win.offsetLeft)}px`;
      win.style.height = `${Math.min(Math.max(oh + ev.clientY - sy, 140), dh - win.offsetTop)}px`;
    });
  }

  // Keep windows reachable when the viewport shrinks
  addEventListener('resize', () => {
    const { w: dw, h: dh } = deskSize();
    for (const { el } of open.values()) {
      if (el.offsetWidth > dw) el.style.width = `${dw - 8}px`;
      if (el.offsetHeight > dh) el.style.height = `${dh - 8}px`;
      if (el.offsetLeft > dw - 64) el.style.left = `${Math.max(0, dw - el.offsetWidth - 4)}px`;
      if (el.offsetTop > dh - 22) el.style.top = `${Math.max(0, dh - el.offsetHeight - 4)}px`;
    }
  });

  // In-page anchors could scroll the overflow:hidden desktop; pin it.
  desktop.addEventListener('scroll', () => {
    if (!isPlain()) { desktop.scrollTop = 0; desktop.scrollLeft = 0; }
  });

  // ------------------------------------------------------------------------
  // Message boxes
  // ------------------------------------------------------------------------
  let dialogSeq = 0;

  function msgBox({ title = 'Jenny 98', text = '', icon = 'info', buttons = ['OK'], body = null } = {}) {
    return new Promise(resolve => {
      const id = `dialog-${++dialogSeq}`;
      const el = document.createElement('section');
      el.className = 'window dialog active';
      el.dataset.app = id;
      el.setAttribute('role', 'alertdialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-labelledby', `${id}-t`);
      el.setAttribute('aria-describedby', `${id}-d`);
      el.innerHTML = `
        <header class="title-bar"><h2 class="title-text" id="${id}-t"></h2>
          <div class="title-controls"><button class="t-close" type="button" aria-label="Close"></button></div></header>
        <div class="dialog-body"><svg class="ico" aria-hidden="true"><use href="#i-${icon}"/></svg>
          <div><p class="dialog-text" id="${id}-d"></p></div></div>
        <div class="dialog-buttons"></div>`;
      $('.title-text', el).textContent = title;
      $('.dialog-text', el).textContent = text;
      if (body) $('.dialog-text', el).after(body);
      const row = $('.dialog-buttons', el);
      buttons.forEach((label, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = i === 0 ? 'btn btn-default' : 'btn';
        b.textContent = label;
        b.addEventListener('click', () => done(label));
        row.append(b);
      });
      const shield = document.createElement('div');
      shield.className = 'modal-shield';
      const returnTo = document.activeElement;

      function done(value) {
        document.removeEventListener('keydown', onKey, true);
        el.remove();
        shield.remove();
        if (returnTo && document.contains(returnTo)) returnTo.focus({ preventScroll: true });
        resolve(value);
      }
      function onKey(e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          done(buttons.length > 1 ? buttons[buttons.length - 1] : buttons[0]);
        } else if (e.key === 'Tab') {
          const items = $$('button, input', el);
          const i = items.indexOf(document.activeElement);
          const next = items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length];
          e.preventDefault();
          next.focus();
        }
      }
      $('.t-close', el).addEventListener('click', () => done(null));
      desktop.append(shield);
      winLayer.append(el);
      shield.style.zIndex = 99990;
      el.style.zIndex = 99991;
      const { w: dw, h: dh } = deskSize();
      el.style.left = `${Math.max(8, Math.round((dw - el.offsetWidth) / 2))}px`;
      el.style.top = `${Math.max(8, Math.round((dh - el.offsetHeight) / 2.6))}px`;
      document.addEventListener('keydown', onKey, true);
      row.firstElementChild.focus();
      ding();
    });
  }

  // ------------------------------------------------------------------------
  // Desktop icons: click selects, double-click opens; keyboard Enter and
  // touch taps open straight away.
  // ------------------------------------------------------------------------
  let lastPointer = 'mouse';
  addEventListener('pointerdown', e => { lastPointer = e.pointerType || 'mouse'; }, { capture: true, passive: true });

  const icons = $$('.desktop-icons .icon');
  const selectIcon = icon => icons.forEach(i => i.classList.toggle('selected', i === icon));

  icons.forEach(icon => {
    icon.addEventListener('click', e => {
      e.preventDefault();
      if (isPlain() || e.detail === 0 || lastPointer !== 'mouse' || mqMobile.matches) openWin(icon.dataset.open, { opener: icon });
      else selectIcon(icon);
    });
    icon.addEventListener('dblclick', e => {
      e.preventDefault();
      openWin(icon.dataset.open, { opener: icon });
    });
    icon.addEventListener('focus', () => selectIcon(icon));
  });

  desktop.addEventListener('pointerdown', e => {
    if (!e.target.closest('.icon, .window')) selectIcon(null);
  });

  // Any other [data-open] link or button anywhere
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-open]');
    if (!t || t.classList.contains('icon')) return;
    e.preventDefault();
    openWin(t.dataset.open, { opener: t, subject: t.dataset.subject });
  });

  // ------------------------------------------------------------------------
  // Start menu
  // ------------------------------------------------------------------------
  const startBtn = $('#startBtn');
  const startMenu = $('#startMenu');
  const progItem = $('#programsItem');
  const progMenu = $('#programsMenu');

  function setPrograms(on) {
    progMenu.hidden = !on;
    progItem.setAttribute('aria-expanded', String(on));
  }
  function openStart() {
    startMenu.hidden = false;
    startBtn.setAttribute('aria-expanded', 'true');
    $('.menu-item', startMenu).focus();
  }
  function closeStart(returnFocus = false) {
    if (startMenu.hidden) return;
    startMenu.hidden = true;
    startBtn.setAttribute('aria-expanded', 'false');
    setPrograms(false);
    if (returnFocus) startBtn.focus();
  }

  startBtn.addEventListener('click', () => (startMenu.hidden ? openStart() : closeStart()));
  progItem.addEventListener('click', () => setPrograms(progMenu.hidden));
  progItem.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') setPrograms(true); });
  $$(':scope > li > .menu-item:not(.has-sub)', $('.menu', startMenu)).forEach(item => {
    item.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && !mqMobile.matches) setPrograms(false); });
  });

  startMenu.addEventListener('keydown', e => {
    const current = document.activeElement;
    const inSub = progMenu.contains(current);
    const list = $$('.menu-item', inSub ? progMenu : startMenu).filter(i => !progMenu.contains(i) || inSub);
    const i = list.indexOf(current);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length].focus();
    } else if (e.key === 'ArrowRight' && current === progItem) {
      e.preventDefault();
      setPrograms(true);
      $('.menu-item', progMenu).focus();
    } else if ((e.key === 'ArrowLeft' || e.key === 'Escape') && inSub) {
      e.preventDefault();
      e.stopPropagation();
      setPrograms(false);
      progItem.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeStart(true);
    } else if (e.key === 'Tab') {
      closeStart();
    }
  });

  document.addEventListener('pointerdown', e => {
    if (!startMenu.hidden && !startMenu.contains(e.target) && !startBtn.contains(e.target)) closeStart();
  });

  // ------------------------------------------------------------------------
  // [data-action] buttons
  // ------------------------------------------------------------------------
  const actions = {
    print() {
      openWin('resume', { focus: false });
      window.print();
    },
    async 'copy-resume'() {
      try {
        await navigator.clipboard.writeText($('#resumeText').innerText);
        msgBox({ title: 'Notepad', text: 'Copied all of resume.txt to the clipboard.', icon: 'info' });
      } catch (_) {
        msgBox({ title: 'Notepad', text: "Couldn't reach the clipboard. Select the text and copy it manually.", icon: 'warning' });
      }
    },
    'about-notepad'() {
      msgBox({ title: 'About Notepad', icon: 'notepad', text: 'Jenny 98 Notepad\nVersion 4.10.2026\n\nTip: File › Print… gives you a clean, printable résumé.' });
    },
    async share() {
      const data = { title: 'Jenny Speelman — Staff Engineer, Developer Relations', url: 'https://jennyspeelman.me/' };
      if (navigator.share) {
        try { await navigator.share(data); } catch (_) { /* cancelled */ }
        return;
      }
      try {
        await navigator.clipboard.writeText(data.url);
        msgBox({ title: 'Forward to Friend', text: 'Link copied! Paste it to a friend.', icon: 'info' });
      } catch (_) {
        msgBox({ title: 'Forward to Friend', text: `Share this link:\n${data.url}`, icon: 'info' });
      }
    },
    block() {
      msgBox({ title: 'Block User', icon: 'warning', text: "Jenny can't be blocked.\nShe's in your extended network now. 😇" });
    },
    'no-stop'() { ding(); },
    'refresh-apps'() {
      const page = $('#appsPage');
      page.scrollTop = 0;
      page.style.opacity = '0';
      setTimeout(() => { page.style.opacity = ''; }, 120);
    },
    async 'empty-bin'() {
      const answer = await msgBox({ title: 'Confirm Multiple File Delete', icon: 'warning', text: 'Are you sure you want to delete these 5 items?', buttons: ['Yes', 'No'] });
      if (answer === 'Yes') msgBox({ title: 'Recycle Bin', icon: 'info', text: "Actually, Jenny's keeping these for sentimental reasons." });
    },
    'plain-mode'() { setPlain(true); },
    'desktop-mode'() { setPlain(false); },
    shutdown() { shutdownDialog(); },
    'apply-settings'() { commitSettings(); },
  };

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-action]');
    if (!t || t.tagName === 'FORM') return;
    const fn = actions[t.dataset.action];
    if (!fn) return;
    e.preventDefault();
    closeStart();
    fn(t);
  });

  function setPlain(on) {
    store.set('j98.plain', on ? 1 : 0);
    location.reload();
  }

  function shutdownDialog() {
    const body = document.createElement('div');
    body.style.cssText = 'display:grid;gap:4px;margin-top:10px';
    body.innerHTML = `
      <label class="check"><input type="radio" name="sd" value="shutdown" checked /><span>Shut down</span></label>
      <label class="check"><input type="radio" name="sd" value="restart" /><span>Restart</span></label>
      <label class="check"><input type="radio" name="sd" value="plain" /><span>Restart in plain view</span></label>`;
    msgBox({ title: 'Shut Down Jenny 98', icon: 'shutdown', text: 'What do you want the computer to do?', buttons: ['OK', 'Cancel'], body })
      .then(answer => {
        if (answer !== 'OK') return;
        const choice = $('input[name="sd"]:checked', body).value;
        if (choice === 'plain') setPlain(true);
        else if (choice === 'restart') location.href = `${location.pathname}?boot`;
        else shutDown();
      });
  }

  function shutDown() {
    const screen = $('#shutdown');
    desktop.style.visibility = 'hidden';
    $('#taskbar').style.visibility = 'hidden';
    screen.hidden = false;
    screen.focus();
    const restart = () => { location.href = `${location.pathname}?boot`; };
    screen.addEventListener('click', restart, { once: true });
    screen.addEventListener('keydown', restart, { once: true });
  }

  // ------------------------------------------------------------------------
  // Tabs (System Properties, Display Properties)
  // ------------------------------------------------------------------------
  function selectTab(tab) {
    $$('[role="tab"]', tab.parentElement).forEach(t => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
  }
  document.addEventListener('click', e => {
    const tab = e.target.closest('[role="tab"]');
    if (tab) selectTab(tab);
  });
  document.addEventListener('keydown', e => {
    const tab = e.target.closest && e.target.closest('[role="tab"]');
    if (!tab || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    const all = $$('[role="tab"]', tab.parentElement);
    const next = all[(all.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length];
    selectTab(next);
    next.focus();
  });

  // ------------------------------------------------------------------------
  // Global keyboard shortcuts
  // ------------------------------------------------------------------------
  document.addEventListener('keydown', e => {
    if (html.classList.contains('booting')) return;
    const typing = e.target.closest && e.target.closest('input, textarea, select, [contenteditable]');
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey)) {
      if (isPlain()) return;
      e.preventDefault();
      openWin('find');
    } else if (e.key === 'Escape' && !isPlain()) {
      const win = e.target.closest && e.target.closest('.window');
      if (win && (win.id === 'run' || win.id === 'settings' || win.id === 'find')) closeWin(win.id);
    }
  });

  // ------------------------------------------------------------------------
  // Sortable list views (Writing + Talks)
  //   Default view: grouped by folder/year, in the order written in the HTML.
  //   Picking a sort (column header or the "Sort by" menu) shows one flat list
  //   sorted across every group; the folder/year filter still applies.
  // ------------------------------------------------------------------------
  function listView(table, { groupKey, select, onChange }) {
    const homes = $$('tbody', table);
    const original = new Map();
    const rows = [];
    homes.forEach(tb => {
      const own = [...tb.rows].filter(r => !r.classList.contains('group-row'));
      own.forEach(r => {
        r.dataset.group = tb.dataset[groupKey];
        r.dataset.groupLabel = tb.dataset.label || tb.dataset[groupKey];
      });
      original.set(tb, own);
      rows.push(...own);
    });
    const flat = document.createElement('tbody');
    flat.hidden = true;
    table.append(flat);

    const ths = $$('thead th', table);
    let filter = 'all';
    let sort = null; // { col, dir } or null for the grouped default

    ths.forEach((th, col) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sort-btn';
      btn.innerHTML = '<span></span><span class="sort-ind" aria-hidden="true"></span>';
      btn.firstChild.textContent = th.textContent;
      th.textContent = '';
      th.append(btn);
      btn.addEventListener('click', () => {
        const isDate = th.dataset.type === 'date';
        const current = sort && sort.col === col ? sort.dir : null;
        const first = isDate ? 'descending' : 'ascending';
        const dir = current ? (current === 'ascending' ? 'descending' : 'ascending') : first;
        setSort({ col, dir });
      });
    });

    const key = row => {
      const cell = row.cells[sort.col];
      // Ignore leading quotes/punctuation so '"AI at the Edge"…' files under A
      return (cell.dataset.sort ?? cell.textContent).trim().toLowerCase().replace(/^[^\p{L}\p{N}]+/u, '');
    };

    function apply() {
      if (!sort) {
        homes.forEach(tb => {
          original.get(tb).forEach(r => { r.hidden = false; tb.append(r); });
          tb.hidden = !(filter === 'all' || tb.dataset[groupKey] === filter);
        });
        flat.hidden = true;
      } else {
        const mul = sort.dir === 'ascending' ? 1 : -1;
        const sorted = [...rows].sort((a, b) => {
          const ka = key(a);
          const kb = key(b);
          if (!ka !== !kb) return ka ? -1 : 1; // blanks (unknown dates) always last
          return ka.localeCompare(kb, undefined, { numeric: true }) * mul;
        });
        sorted.forEach(r => {
          r.hidden = !(filter === 'all' || r.dataset.group === filter);
          flat.append(r);
        });
        homes.forEach(tb => { tb.hidden = true; });
        flat.hidden = false;
      }
      ths.forEach((th, i) => {
        if (sort && i === sort.col) th.setAttribute('aria-sort', sort.dir);
        else th.removeAttribute('aria-sort');
      });
      if (select) select.value = sort ? `${sort.col}:${sort.dir}` : 'group';
      onChange(visibleRows());
    }

    function visibleRows() {
      return $$('tbody:not([hidden]) > tr:not(.group-row):not([hidden])', table);
    }
    function setSort(next) { sort = next; apply(); }

    if (select) {
      select.addEventListener('change', () => {
        const [col, dir] = select.value.split(':');
        setSort(select.value === 'group' ? null : { col: +col, dir });
      });
    }
    return {
      setFilter(f) { filter = f; apply(); },
      visibleRows,
    };
  }

  // ------------------------------------------------------------------------
  // App: Writing (Explorer)
  // ------------------------------------------------------------------------
  (function explorer() {
    const win = $('#writing');
    const buttons = $$('.tree [data-folder]', win);
    const path = $('[data-path]', win);
    const status = $('[data-status]', win);
    const view = listView($('#writingTable'), {
      groupKey: 'folder',
      select: $('#writingSort'),
      onChange: rows => { status.textContent = `${rows.length} object(s)`; },
    });
    function show(folder) {
      const btn = buttons.find(b => b.dataset.folder === folder);
      buttons.forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      const label = folder === 'all' ? '' : $('span', btn).textContent;
      path.textContent = `C:\\My Documents\\Writing${label ? `\\${label}` : ''}`;
      view.setFilter(folder);
    }
    buttons.forEach(b => b.addEventListener('click', () => show(b.dataset.folder)));
    $('[data-folder-up]', win).addEventListener('click', () => show('all'));
  })();

  // ------------------------------------------------------------------------
  // App: Talks (Media Player)
  // ------------------------------------------------------------------------
  (function mediaPlayer() {
    const win = $('#talks');
    const buttons = $$('.tree [data-year]', win);
    const status = $('[data-status]', win);
    const npTitle = $('#npTitle');
    const npMeta = $('#npMeta');
    let current = null;
    let year = 'all';

    function nowPlaying(row) {
      if (!row) return;
      if (current) current.classList.remove('selected');
      current = row;
      row.classList.add('selected');
      const cells = row.cells;
      npTitle.textContent = $('a', row).textContent;
      npMeta.textContent = `${cells[1].textContent} · ${cells[3].textContent} · ${cells[2].textContent}`;
    }

    const view = listView($('#talksTable'), {
      groupKey: 'year',
      select: $('#talksSort'),
      onChange: rows => {
        status.textContent = `${rows.length} item${rows.length === 1 ? '' : 's'}${year === 'all' ? ' · 2020–2025' : ` · ${year}`}`;
        if (!current || !rows.includes(current)) nowPlaying(rows[0]);
      },
    });

    function show(y) {
      year = y;
      buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.year === y)));
      view.setFilter(y);
      nowPlaying(view.visibleRows()[0]);
    }

    buttons.forEach(b => b.addEventListener('click', () => show(b.dataset.year)));
    $('#talksTable').addEventListener('click', e => {
      const row = e.target.closest('tbody tr');
      if (row && !row.classList.contains('group-row')) nowPlaying(row);
    });
    $('#talksTable').addEventListener('focusin', e => {
      const row = e.target.closest('tbody tr');
      if (row && !row.classList.contains('group-row')) nowPlaying(row);
    });
    $('#player').addEventListener('click', e => {
      const b = e.target.closest('[data-player]');
      if (!b) return;
      const rows = view.visibleRows();
      const i = rows.indexOf(current);
      if (b.dataset.player === 'play' && current) window.open($('a', current).href, '_blank', 'noopener');
      else if (b.dataset.player === 'next') nowPlaying(rows[(i + 1) % rows.length]);
      else if (b.dataset.player === 'prev') nowPlaying(rows[(i - 1 + rows.length) % rows.length]);
      if (b.dataset.player !== 'play' && current) current.scrollIntoView({ block: 'nearest' });
    });
    show('all');
  })();

  // ------------------------------------------------------------------------
  // App: Mail
  // ------------------------------------------------------------------------
  onOpen.contact = (el, opts) => {
    if (opts.subject) $('#mailSubject').value = opts.subject;
  };
  $('#mailForm').addEventListener('submit', e => {
    e.preventDefault();
    const to = $('#mailTo').value;
    const subject = encodeURIComponent($('#mailSubject').value);
    const body = encodeURIComponent($('#mailBody').value);
    location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  });

  // ------------------------------------------------------------------------
  // App: Find
  // ------------------------------------------------------------------------
  let findIndex = null;
  function buildIndex() {
    const items = [];
    const add = (name, extra) => items.push({ name, hay: `${name} ${extra.folder} ${extra.type}`.toLowerCase(), ...extra });
    $$('#writingTable tbody tr[data-group]').forEach(r => {
      const a = $('a', r);
      add(a.textContent, { href: a.href, folder: `Writing\\${r.dataset.groupLabel}`, type: r.cells[1].textContent, scope: 'writing', icon: $('use', r).getAttribute('href') });
    });
    $$('#talksTable tbody tr[data-group]').forEach(r => {
      const a = $('a', r);
      add(a.textContent, { href: a.href, folder: `Talks\\${r.dataset.groupLabel}`, type: `${r.cells[2].textContent} · ${r.cells[1].textContent}`, scope: 'talks', icon: '#i-media' });
    });
    $$('#apps .app-list li').forEach(li => {
      const a = $('a', li);
      add(a.textContent, { href: a.href, folder: 'Internet\\jennyspeelman.dev', type: $('p', li).textContent, scope: 'all', icon: $('use', li).getAttribute('href') });
    });
    icons.forEach(icon => add($('.icon-label', icon).textContent, { open: icon.dataset.open, folder: 'Desktop', type: 'Shortcut', scope: 'all', icon: $('use', icon).getAttribute('href') }));
    return items;
  }

  function runFind() {
    findIndex = findIndex || buildIndex();
    const q = $('#findInput').value.trim().toLowerCase();
    const scope = $('#findScope').value;
    const out = $('#findResults');
    const status = $('#findStatus');
    out.textContent = '';
    if (!q) { status.textContent = 'Type something and press Find Now.'; return; }
    const terms = q.split(/\s+/);
    const hits = findIndex.filter(i => (scope === 'all' || i.scope === scope) && terms.every(t => i.hay.includes(t)));
    const frag = document.createDocumentFragment();
    hits.forEach(hit => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><span class="name"><svg class="ico" aria-hidden="true"><use href="${hit.icon}"/></svg><a></a></span></td><td class="muted"></td><td class="muted"></td>`;
      const a = $('a', tr);
      a.textContent = hit.name;
      if (hit.open) { a.href = `#${hit.open}`; a.dataset.open = hit.open; }
      else { a.href = hit.href; a.target = '_blank'; a.rel = 'noopener'; }
      tr.cells[1].textContent = hit.folder;
      tr.cells[2].textContent = hit.type;
      frag.append(tr);
    });
    out.append(frag);
    status.textContent = `${hits.length} file(s) found`;
  }

  let findTimer;
  $('#findForm').addEventListener('submit', e => { e.preventDefault(); runFind(); });
  $('#findForm').addEventListener('reset', () => setTimeout(runFind));
  $('#findInput').addEventListener('input', () => { clearTimeout(findTimer); findTimer = setTimeout(runFind, 150); });
  $('#findScope').addEventListener('change', runFind);
  onOpen.find = (el, opts) => {
    if (opts.query !== undefined) { $('#findInput').value = opts.query; runFind(); }
  };
  $('[data-action="ms-search"]').addEventListener('submit', e => {
    e.preventDefault();
    openWin('find', { query: $('#msSearch').value });
  });

  // ------------------------------------------------------------------------
  // App: Run
  // ------------------------------------------------------------------------
  const RUN = {
    profile: 'profile', 'jennyspeelman.me': 'profile', jennyspeelman: 'profile', myspace: 'profile', home: 'profile',
    resume: 'resume', 'resume.txt': 'resume', notepad: 'resume', cv: 'resume',
    writing: 'writing', blog: 'writing', blogs: 'writing', explorer: 'writing', docs: 'writing',
    talks: 'talks', videos: 'talks', media: 'talks', wmplayer: 'talks', mplayer: 'talks',
    book: 'book', 'ai at the edge': 'book', oreilly: 'book',
    apps: 'apps', iexplore: 'apps', internet: 'apps', web: 'apps',
    mail: 'contact', contact: 'contact', email: 'contact', outlook: 'contact',
    computer: 'computer', sysprops: 'computer', msinfo32: 'computer', 'my computer': 'computer',
    recycle: 'recycle', 'recycle bin': 'recycle', trash: 'recycle',
    help: 'help', winhelp: 'help', find: 'find', search: 'find',
    display: 'settings', control: 'settings', settings: 'settings', desk: 'settings', 'desk.cpl': 'settings',
  };
  $('#runForm').addEventListener('submit', e => {
    e.preventDefault();
    const raw = $('#runInput').value.trim();
    const cmd = raw.toLowerCase().replace(/\.exe$/, '');
    if (!cmd) return;
    if (RUN[cmd]) {
      closeWin('run');
      openWin(RUN[cmd]);
    } else if (cmd === 'cmd' || cmd === 'command') {
      msgBox({ title: 'Run', icon: 'error', text: 'MS-DOS Prompt has been quantized away to save space.\nTry "resume" or "talks" instead.' });
    } else {
      msgBox({ title: raw, icon: 'error', text: `Cannot find the file '${raw}' (or one of its components). Make sure the path and filename are correct and that all required libraries are available.` });
    }
  });

  // ------------------------------------------------------------------------
  // App: Display Properties
  // ------------------------------------------------------------------------
  let draft = { ...settings };
  const wallList = $('#wallList');
  const patternList = $('#patternList');
  const fxForm = $('#settingsForm');

  function fillListbox(list, items, key, swatch) {
    list.innerHTML = '';
    items.forEach(item => {
      const li = document.createElement('li');
      li.id = `${list.id}-${item.id}`;
      li.setAttribute('role', 'option');
      li.dataset.value = item.id;
      if (swatch) li.innerHTML = `<span class="swatch" style="background:${item.color}"></span>`;
      li.append(document.createTextNode(item.name));
      list.append(li);
    });
    list.addEventListener('click', e => {
      const li = e.target.closest('[role="option"]');
      if (li) choose(list, key, li.dataset.value);
    });
    list.addEventListener('keydown', e => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const opts = $$('[role="option"]', list);
      const i = opts.findIndex(o => o.dataset.value === draft[key]);
      const next = opts[Math.min(Math.max(i + (e.key === 'ArrowDown' ? 1 : -1), 0), opts.length - 1)];
      choose(list, key, next.dataset.value);
    });
  }

  function choose(list, key, value) {
    draft[key] = value;
    $$('[role="option"]', list).forEach(o => o.setAttribute('aria-selected', String(o.dataset.value === value)));
    list.setAttribute('aria-activedescendant', `${list.id}-${value}`);
    const sel = $(`#${list.id}-${value}`);
    if (sel) sel.scrollIntoView({ block: 'nearest' });
    preview();
  }

  function preview() {
    const screen = $('#previewScreen');
    screen.style.setProperty('--preview-desktop', wallFor(draft.wall).color);
    // Briefly flip the real attribute to resolve the draft's --pattern value, then put it back
    const prev = html.dataset.pattern;
    if (draft.pattern === 'none') screen.style.setProperty('--preview-pattern', 'none');
    else {
      html.dataset.pattern = draft.pattern;
      screen.style.setProperty('--preview-pattern', getComputedStyle(html).getPropertyValue('--pattern'));
      if (prev) html.dataset.pattern = prev; else delete html.dataset.pattern;
    }
  }

  fillListbox(wallList, WALLS, 'wall', true);
  fillListbox(patternList, PATTERNS, 'pattern', false);

  onOpen.settings = (el, opts, isNew) => {
    if (!isNew) return;
    draft = { ...settings };
    choose(wallList, 'wall', draft.wall);
    choose(patternList, 'pattern', draft.pattern);
    ['sparkles', 'glitter', 'sound', 'bootEvery'].forEach(k => { fxForm.elements[k].checked = !!draft[k]; });
  };

  function commitSettings() {
    ['sparkles', 'glitter', 'sound', 'bootEvery'].forEach(k => { draft[k] = fxForm.elements[k].checked; });
    settings = { ...draft };
    applySettings(settings);
    saveSettings();
  }
  fxForm.addEventListener('submit', e => {
    e.preventDefault();
    commitSettings();
    closeWin('settings');
  });

  // ------------------------------------------------------------------------
  // Tray: volume + clock
  // ------------------------------------------------------------------------
  function updateVolume() {
    const btn = $('#volumeBtn');
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(settings.sound));
    btn.setAttribute('aria-label', settings.sound ? 'Sounds on' : 'Sounds off');
    btn.title = settings.sound ? 'Sounds on (click to mute)' : 'Sounds off (click to unmute)';
    $('use', btn).setAttribute('href', settings.sound ? '#i-speaker' : '#i-speaker-off');
  }
  $('#volumeBtn').addEventListener('click', () => {
    settings.sound = !settings.sound;
    saveSettings();
    updateVolume();
    ding();
  });

  const clock = $('#clock');
  function tick() {
    const now = new Date();
    clock.textContent = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    clock.dateTime = now.toISOString();
    clock.title = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
  tick();
  setInterval(tick, 15000);

  // ------------------------------------------------------------------------
  // Profile bits: last-login date & a very honest hit counter
  // ------------------------------------------------------------------------
  $$('[data-today]').forEach(el => { el.textContent = new Date().toLocaleDateString('en-US'); });
  (function counter() {
    let visits = store.get('j98.visits', 0);
    let counted = false;
    try { counted = sessionStorage.getItem('j98.counted') === '1'; } catch (_) { /* ignore */ }
    if (!counted) {
      visits += 1;
      store.set('j98.visits', visits);
      try { sessionStorage.setItem('j98.counted', '1'); } catch (_) { /* ignore */ }
    }
    const digits = String(Math.max(visits, 1)).padStart(6, '0');
    $('#visitCounter').innerHTML = [...digits].map(d => `<span>${d}</span>`).join('');
    $('#visitCounterText').textContent = String(Math.max(visits, 1));
  })();

  // ------------------------------------------------------------------------
  // Sparkle cursor trail
  // ------------------------------------------------------------------------
  const SPARK_COLORS = ['#ff4fa0', '#ffffff', '#ffd400', '#ff8cc6', '#c2185b'];
  let lastSpark = 0;
  let sparks = 0;
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || !settings.sparkles || mqReduce.matches || isPlain()) return;
    const now = performance.now();
    if (now - lastSpark < 40 || sparks > 36) return;
    lastSpark = now;
    const s = document.createElement('span');
    s.className = 'sparkle';
    s.style.left = `${e.clientX + Math.random() * 12 - 6}px`;
    s.style.top = `${e.clientY + Math.random() * 12 - 6}px`;
    s.style.color = SPARK_COLORS[(Math.random() * SPARK_COLORS.length) | 0];
    s.style.setProperty('--dx', `${Math.random() * 24 - 12}px`);
    sparks += 1;
    s.addEventListener('animationend', () => { s.remove(); sparks -= 1; });
    document.body.append(s);
  }, { passive: true });

  // ------------------------------------------------------------------------
  // Boot sequence
  // ------------------------------------------------------------------------
  function boot() {
    if (!html.classList.contains('booting')) return Promise.resolve(false);
    if (/[?&]boot\b/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash);

    return new Promise(resolve => {
      const bootEl = $('#boot');
      const bios = $('#bios');
      const skip = $('#bootSkip');
      const talkCount = $$('#talksTable tbody tr:not(.group-row)').length;
      const lines = [
        '<span class="bios-logo"><svg viewBox="0 0 32 32"><use href="#i-chip"/></svg>EDGE AI<br>READY</span><span class="hl">PinkBIOS v4.20, Edge AI Edition</span>',
        'Copyright (C) 1998-2026, Jenny Speelman',
        '',
        'Main Processor : Staff Engineer, Developer Relations',
        'Memory Testing : <span class="hl">65536K</span> OK',
        '',
        'Detecting Drive 0 ... <span class="hl">AI_AT_THE_EDGE</span> (O\'Reilly)',
        `Detecting Drive 1 ... <span class="hl">TALKS.WMV</span> (${talkCount} files)`,
        'Detecting Drive 2 ... <span class="hl">EDGE_IMPULSE</span> / QUALCOMM',
        '',
        'Loading TinyML kernel ............ <span class="ok">OK</span>',
        'Quantizing personality to int8 ... <span class="ok">OK</span>',
        'Calibrating sparkles ............. <span class="ok">OK</span>',
        '',
        'Starting Jenny 98<span class="cursor-blink">_</span>',
      ];
      let done = false;
      const timers = [];
      const later = (fn, ms) => timers.push(setTimeout(fn, ms));

      function finish() {
        if (done) return;
        done = true;
        timers.forEach(clearTimeout);
        bootEl.removeEventListener('pointerdown', onInput);
        document.removeEventListener('keydown', onInput, true);
        html.classList.remove('booting');
        store.set('j98.booted', 1);
        resolve(true);
      }
      // Any key (bar Tab/modifiers) or click skips straight to the desktop
      function onInput(e) {
        if (e.type === 'keydown' && ['Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
        if (e.type === 'keydown') e.preventDefault();
        finish();
      }

      bootEl.addEventListener('pointerdown', onInput);
      document.addEventListener('keydown', onInput, true);
      skip.addEventListener('click', finish);

      let t = 150;
      lines.forEach(line => {
        later(() => bios.insertAdjacentHTML('beforeend', `${line}\n`), t);
        t += line ? 130 : 60;
      });
      later(finish, t + 900);
      skip.focus({ preventScroll: true });
    });
  }

  // ------------------------------------------------------------------------
  // Start up
  // ------------------------------------------------------------------------
  applySettings(settings);

  if (isPlain()) return;

  addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (winEl(id)) openWin(id);
  });

  boot().then(booted => {
    const id = location.hash.slice(1);
    openWin(winEl(id) ? id : 'profile', { focus: booted, track: false });
    if (booted) chime();
  });
})();

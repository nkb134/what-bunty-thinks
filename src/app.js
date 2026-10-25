/* What Brandon Thinks — private edition. Landing page, demo story, report view, uploads. */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Number(n).toLocaleString('en');
  const hh = h => ((h % 12) || 12) + ' ' + (h < 12 ? 'AM' : 'PM');
  const STORE = 'brandon.reports.v1';

  const AVATAR = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="32" fill="#5b95f2"/>' +
    '<path d="M14 64c2-12 9-17 18-17s16 5 18 17z" fill="#2c3e64"/><ellipse cx="32" cy="35" rx="13" ry="15" fill="#e9b48a"/>' +
    '<path d="M19 25h26l3 4H16z" fill="#f4efe4"/><path d="M22 25c1-9 5-12 10-12s9 3 10 12z" fill="#f4efe4"/><rect x="22" y="22" width="20" height="3.5" fill="#1d1d1d"/>' +
    '<rect x="21" y="31" width="9.5" height="6" rx="2.5" fill="#151515"/><rect x="33.5" y="31" width="9.5" height="6" rx="2.5" fill="#151515"/><rect x="29.5" y="32.5" width="5" height="1.6" fill="#151515"/>' +
    '<path d="M25 43c3-2.5 11-2.5 14 0-2 1.6-4 1-7 .4-3 .6-5 1.2-7-.4z" fill="#4a2c1a"/></svg>';
  document.querySelectorAll('.av').forEach(el => { el.innerHTML = AVATAR; });

  // Reports: the preloaded one plus anything uploaded in this browser.
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(STORE) || '[]'); } catch (e) { saved = []; }
  let REPORTS = [...(window.PRELOADED || []), ...saved];
  const persist = () => { try { localStorage.setItem(STORE, JSON.stringify(REPORTS.filter(r => r.uploaded))); } catch (e) { /* private mode: keep in memory */ } };

  const PLACEHOLDERS = [['The Boys', '🍻', '#ffd9c2'], ['Family', '❤️', '#ffe08a'], ['Bestie', '💖', '#ffd1e8'], ['Mom', '🏡', '#d5f5d0'],
    ['Uni crew', '🎓', '#ddd6ff'], ['Work wife', '💼', '#d3e7ff'], ['Him', '🙄', '#e3e3ff'], ['Situationship', '🌀', '#e0f2ff'],
    ['Group trip', '🌴', '#d5f5d0'], ['Cousins', '🎄', '#ffd9d9'], ['Crush', '👀', '#ffeaa6'], ['Ex', '🚩', '#ffd9d9']];

  /* ---------- shared renderers ---------- */
  const meOf = r => r.names[r.me] || r.me;
  function bubbles(r, list) {
    const me = meOf(r);
    // Like WhatsApp, label the sender only on the first bubble of a run.
    return list.map(([who, x, t], i) => `<div class="b ${who === me ? 'me' : 'them'}">${who === me || (list[i - 1] && list[i - 1][0] === who) ? '' : `<small>${esc(who)}</small>`}${esc(x)}<time>${esc(t || '')}</time></div>`).join('');
  }
  function statsHTML(r) {
    const s = r.stats, [a, b] = s.people, n = p => esc(r.names[p.name] || p.name);
    const pair = (fa, fb) => b ? `<div class="split"><span>${n(a)}<br><strong>${fa(a)}</strong></span><span style="text-align:right">${n(b)}<br><strong>${fb(b)}</strong></span></div>` : `<strong>${fa(a)}</strong>`;
    return `<div class="stats">
      <div><label>Messages</label><strong>${fmt(s.total)}</strong></div><div><label>A day</label><strong>${s.perDay}</strong></div>
      <div class="w"><label>Who does the talking</label>${pair(p => p.share + '%', p => p.share + '%')}<div class="meter"><i style="width:${a.share}%"></i><i style="width:${b ? b.share : 0}%"></i></div></div>
      <div><label>Texts first</label><strong>${a.first >= (b ? b.first : 0) ? a.first : b.first}%</strong><div style="font-size:12px;color:var(--muted)">${n(a.first >= (b ? b.first : 0) ? a : b)}</div></div>
      <div><label>After midnight</label><strong>${s.afterMidnight}%</strong></div>
      <div class="w"><label>Average reply time</label>${pair(p => p.reply, p => p.reply)}</div>
      <div><label>Busiest hour</label><strong>${hh(s.busiestHour)}</strong></div><div><label>Voice notes</label><strong>${s.voice}</strong></div>
      <div><label>Top emojis</label><span class="emo">${s.topEmoji.join('')}</span></div><div><label>Longest silence</label><strong>${s.silence.days} days</strong></div>
    </div>`;
  }
  function chart(r, type) {
    const s = r.stats, data = type === 'months' ? s.months : s.hours.map((v, i) => [i, v]);
    const W = 640, H = 170, pad = 22, bw = (W - pad) / data.length, max = Math.max(...data.map(d => d[1]));
    const bars = data.map(([k, v], i) => {
      const h = Math.max(2, (v / max) * (H - 40)), x = pad / 2 + i * bw, y = H - 22 - h;
      const lbl = type === 'months' ? (k.endsWith('-01') || i === 0 ? "'" + k.slice(2, 4) : (k.endsWith('-07') ? 'Jul' : '')) : (k % 6 === 0 ? hh(k) : '');
      const hot = type === 'hours' ? k === s.busiestHour : v === max;
      return `<rect x="${x + 1.5}" y="${y}" width="${Math.max(2, bw - 3)}" height="${h}" rx="3" fill="${hot ? '#4a8cf5' : '#d6d6d6'}"><title>${esc(String(k))}: ${v}</title></rect>` +
        (lbl ? `<text x="${x + bw / 2}" y="${H - 6}" font-size="11" text-anchor="middle" fill="#9a9a9a">${lbl}</text>` : '');
    }).join('');
    const cap = type === 'months' ? 'Messages per month' : 'Messages by hour of day';
    return `<figure class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${cap}">${bars}</svg><figcaption>${cap}</figcaption></figure>`;
  }
  function block(r, b) {
    if (b.p !== undefined) return b.p ? `<p>${esc(b.p)}</p>` : '';
    if (b.chat) return `<div class="thread">${bubbles(r, b.chat)}</div>`;
    if (b.big) return `<div class="big">${b.big.map(([n, l]) => `<div><strong>${esc(n)}</strong><span>${esc(l)}</span></div>`).join('')}</div>`;
    if (b.chart) return chart(r, b.chart);
    return '';
  }

  /* ---------- landing: chips ---------- */
  function chipHTML(item) {
    if (item.r) return `<button class="chip" data-id="${esc(item.r.id)}"><i style="background:#ffd1e8">${esc(item.r.emoji)}</i>${esc(item.r.label)} ${esc(item.r.emoji)}</button>`;
    return `<button class="chip add" data-label="${esc(item[0])}" data-emoji="${esc(item[1])}"><i style="background:${item[2]}">${item[1]}</i>${esc(item[0])}</button>`;
  }
  function renderChips() {
    const reps = REPORTS.map(r => ({ r }));
    const rows = [[], [], []];
    PLACEHOLDERS.forEach((p, i) => rows[i % 3].push(p));
    reps.forEach((r, i) => rows[i % 3].splice(1 + (i % 2), 0, r));
    $('#rows').innerHTML = rows.map((items, i) => {
      // Each half must be wider than the viewport so the -50% marquee loop never shows a gap.
      let html = items.map(chipHTML).join('');
      while (html.split('class="chip').length - 1 < 9) html += items.map(chipHTML).join('');
      return `<div class="row ${i === 1 ? 'rev' : ''}">${html}${html}</div>`;
    }).join('');
    markChips();
  }
  function markChips() { document.querySelectorAll('.chip[data-id]').forEach(c => c.classList.toggle('on', c.dataset.id === current?.id)); }
  $('#rows').addEventListener('click', e => {
    const c = e.target.closest('.chip'); if (!c) return;
    if (c.dataset.id) { select(REPORTS.find(r => r.id === c.dataset.id)); $('#stage').scrollIntoView({ block: 'center' }); }
    else openUpload({ label: c.dataset.label, emoji: c.dataset.emoji });
  });

  /* ---------- landing: demo story (scan → stats → outline → verdict) ---------- */
  let current = null, timers = [];
  const DUR = [5600, 5200, 5200];
  function select(r) {
    if (!r) return;
    current = r; markChips(); timers.forEach(clearTimeout); timers = [];
    $('#scanCount').textContent = fmt(r.stats.total) + ' messages';
    const feed = $('#feed'); feed.innerHTML = bubbles(r, r.preview); feed.style.transition = 'none'; feed.style.transform = 'translateY(0)';
    $('#pStats').innerHTML = statsHTML(r);
    $('#pOutline').innerHTML = `<div class="card outline"><h3>${esc(r.title)}</h3><div class="by"><span class="logo av">${AVATAR}</span>Brandon</div>` +
      r.chapters.slice(0, 4).map((c, i) => `<h4>${esc(c.h)}</h4>${'<div class="sk"></div>'.repeat(i % 2 ? 4 : 3)}`).join('') + '</div>';
    $('#pVerdict').innerHTML = `<div class="card verdict-mini"><div class="by" style="margin:0"><span class="logo av">${AVATAR}</span>Brandon's verdict</div>` +
      `<p>${esc(r.verdict.p[0])}</p><a class="read" href="#/r/${esc(r.id)}">Read the full report →</a></div>`;
    renderQuotes(r);
    go(0);
  }
  function go(i) {
    document.querySelectorAll('.panel').forEach((p, j) => p.classList.toggle('on', j === i));
    document.querySelectorAll('.bars b').forEach((b, j) => {
      b.style.transition = 'none'; b.style.width = j < i ? '100%' : '0';
      if (j === i && i < 3) requestAnimationFrame(() => requestAnimationFrame(() => { b.style.transition = `width ${DUR[i]}ms linear`; b.style.width = '100%'; }));
      if (j === 3 && i === 3) b.style.width = '100%';
    });
    if (i === 0) {
      const feed = $('#feed');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        feed.style.transition = 'transform 5.2s linear';
        feed.style.transform = `translateY(-${Math.max(0, feed.scrollHeight - 340)}px)`;
      }));
    }
    if (i < 3) timers.push(setTimeout(() => go(i + 1), DUR[i]));
  }
  $('#screen').addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const on = [...document.querySelectorAll('.panel')].findIndex(p => p.classList.contains('on'));
    timers.forEach(clearTimeout); go(Math.min(3, on + 1));
  });

  function renderQuotes(r) {
    $('#quotesFor').textContent = `From the ${r.label} chat`;
    $('#quotes').innerHTML = (r.quotes || []).map(q => `<article class="q"><b>${esc(q.who)}</b><p>${esc(q.x)}</p>` +
      `<footer><span class="tag">${esc(q.tag)}</span><span>${esc(q.date)} · ${esc(r.app)}</span></footer></article>`).join('');
    const tot = REPORTS.reduce((s, x) => s + x.stats.total, 0), days = REPORTS.reduce((s, x) => s + x.stats.spanDays, 0);
    $('#cMsgs').textContent = fmt(tot); $('#cDays').textContent = fmt(days); $('#cReps').textContent = fmt(REPORTS.length);
  }

  /* ---------- full report ---------- */
  function renderReport(r) {
    const chapters = r.chapters.map((c, i) => `<h2><small>Chapter ${i + 1}</small>${esc(c.h)}</h2>${c.blocks.map(b => block(r, b)).join('')}`).join('');
    const awards = (r.awards || []).map(a => `<div class="award"><div class="i">${esc(a.icon)}</div><b>${esc(a.title)}</b><em>${esc(a.who)}</em><p>${esc(a.why)}</p></div>`).join('');
    $('#art').innerHTML = `<a class="back" href="#/">← All chats</a>
      <div style="margin-top:28px" class="kicker"><span class="tag">${esc(r.emoji)} ${esc(r.tag)}</span>${esc(r.app)} · ${esc(r.stats.from)} → ${esc(r.stats.to)}</div>
      <h1>${esc(r.title)}</h1><div class="by"><span class="logo av">${AVATAR}</span><span><b style="color:var(--ink)">Brandon</b> · read ${fmt(r.stats.total)} messages</span></div>
      <p class="intro">${esc(r.intro)}</p>${statsHTML(r)}${chapters}
      ${awards ? `<h2><small>Brandon's awards</small>Superlatives</h2><div class="awards">${awards}</div>` : ''}
      <section class="verdict"><h2>${esc(r.verdict.h)}</h2>${r.verdict.p.map(p => `<p>${esc(p)}</p>`).join('')}</section>
      <div style="display:flex;gap:10px;justify-content:space-between;margin-top:30px;flex-wrap:wrap"><a class="back" href="#/">← All chats</a>
      ${r.uploaded ? `<button class="back" id="forget">Forget this chat</button>` : ''}</div>`;
    const f = $('#forget');
    if (f) f.onclick = () => { REPORTS = REPORTS.filter(x => x.id !== r.id); persist(); renderChips(); select(REPORTS[0]); location.hash = '#/'; };
  }
  function route() {
    const m = location.hash.match(/^#\/r\/(.+)$/), r = m && REPORTS.find(x => x.id === decodeURIComponent(m[1]));
    document.body.classList.toggle('reading', !!r);
    if (r) { renderReport(r); window.scrollTo({ top: 0, behavior: 'instant' }); document.title = r.title + ' — What Brandon Thinks'; }
    else document.title = 'What Brandon Thinks';
  }
  window.addEventListener('hashchange', route);

  /* ---------- upload ---------- */
  let parsed = null, preset = {};
  const modal = $('#modal');
  function openUpload(p = {}) {
    preset = p; parsed = null; $('#fileName').textContent = ''; $('#err').textContent = ''; $('#who').hidden = true; $('#gen').disabled = true;
    $('#label').value = p.label || ''; $('#reading').hidden = true; $('#form').hidden = false; modal.classList.add('open');
  }
  const closeUpload = () => modal.classList.remove('open');
  document.querySelectorAll('[data-try]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); openUpload(); }));
  $('#x').onclick = closeUpload;
  modal.addEventListener('click', e => { if (e.target === modal) closeUpload(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeUpload(); });

  function loadScript(src) {
    return new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => fail(new Error('Could not load the zip reader. Upload the _chat.txt file instead.')); document.head.appendChild(s); });
  }
  async function readFile(file) {
    if (/\.zip$/i.test(file.name)) {
      if (!window.JSZip) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
      const zip = await window.JSZip.loadAsync(file);
      const entry = Object.values(zip.files).find(f => /_chat\.txt$|\.txt$/i.test(f.name) && !f.dir);
      if (!entry) throw new Error('No chat .txt found inside that zip.');
      return entry.async('string');
    }
    return file.text();
  }
  // Name the chat after the other person, unless the user picked a chip or typed a name.
  let autoLabel = true;
  function fillLabel(people) {
    if (!autoLabel) return;
    const others = people.filter(p => p !== $('#me').value);
    $('#label').value = people.length > 2 ? 'Group chat' : others[0] || people[0];
  }
  $('#label').addEventListener('input', () => { autoLabel = false; });
  async function take(file) {
    $('#err').textContent = ''; $('#fileName').textContent = file.name;
    try {
      const msgs = window.Analyzer.parse(await readFile(file));
      if (msgs.length < 20) throw new Error("That doesn't look like a WhatsApp export (found " + msgs.length + ' messages).');
      parsed = msgs;
      const people = [...new Set(msgs.map(m => m.a))];
      $('#me').innerHTML = people.map(p => `<option>${esc(p)}</option>`).join('');
      $('#who').hidden = false; $('#gen').disabled = false;
      autoLabel = !$('#label').value;
      fillLabel(people);
      $('#me').onchange = () => fillLabel(people);
    } catch (e) { parsed = null; $('#gen').disabled = true; $('#err').textContent = e.message; }
  }
  $('#file').addEventListener('change', e => e.target.files[0] && take(e.target.files[0]));
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => e.dataTransfer.files[0] && take(e.dataTransfer.files[0]));
  $('#gen').onclick = () => {
    if (!parsed) return;
    $('#form').hidden = true; $('#reading').hidden = false;
    $('#readingCount').textContent = `Reading ${fmt(parsed.length)} messages…`;
    setTimeout(() => {
      try {
        const stats = window.Analyzer.analyze(parsed);
        const r = window.Writer.write(parsed, stats, { label: $('#label').value.trim(), emoji: preset.emoji, tag: $('#tag').value, me: $('#me').value });
        r.uploaded = true; parsed = null;
        REPORTS.push(r); persist(); renderChips(); select(r); closeUpload();
        location.hash = '#/r/' + r.id;
      } catch (e) {
        $('#reading').hidden = true; $('#form').hidden = false;
        $('#err').textContent = 'Brandon got confused by this chat: ' + e.message;
      }
    }, 1400);
  };

  renderChips(); select(REPORTS[0]); route();
})();

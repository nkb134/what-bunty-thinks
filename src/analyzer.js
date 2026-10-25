/* Chat analyzer: parses WhatsApp exports (iOS + Android) and computes report stats.
   Runs in the browser (window.Analyzer) and in Node (module.exports). */
(function (root) {
  const IOS = /^\[(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp]\.?\s?[Mm]\.?)?\]\s(.+?):\s([\s\S]*)$/;
  const AND = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp]\.?\s?[Mm]\.?)?\s[-–]\s(.+?):\s([\s\S]*)$/;
  // Whole emoji sequences (ZWJ joins, skin tones), so 😶‍🌫️ counts as one emoji, not two.
  const EMOJI = /\p{Extended_Pictographic}️?[\u{1F3FB}-\u{1F3FF}]?(?:‍\p{Extended_Pictographic}️?)*/gu;
  const emojiKey = e => {
    const k = e.replace(/️/g, '');
    if ([...k].length > 1) return e; // ZWJ sequences keep their own variation selectors
    return k.codePointAt(0) < 0x2800 ? k + '️' : k;
  };
  const STOP = new Set(('the a an i to you is it and of in me my for that this on be are was have do not no ok okay so what will with at but ' +
    'h hai ho ki ka ke ko se mai main bhi na ne kya ye yeh wo vo nhi nahi he hu hun ek kr kar rha rhi tha thi the ' +
    'just can how all your from like get got its it\'s are was were has had did does been being they them we our us ' +
    'omitted image sticker audio video document gif call voice missed click back https http www com').split(' '));

  function clean(s) { return s.replace(/[‎‏‪-‮⁦-⁩]/g, '').replace(/[  ]/g, ' '); }

  function parse(text) {
    const lines = clean(text).split(/\r?\n/);
    const raw = [];
    for (const line of lines) {
      const m = line.match(IOS) || line.match(AND);
      if (m) raw.push({ f: m.slice(1, 8), a: m[8].trim(), x: m[9] });
      else if (raw.length) raw[raw.length - 1].x += '\n' + line;
    }
    // Day/month order: if any first field > 12 it's D/M, if any second field > 12 it's M/D.
    let dmy = true;
    if (!raw.some(r => +r.f[0] > 12) && raw.some(r => +r.f[1] > 12)) dmy = false;
    return raw.map(r => {
      let [d, mo, y, h, mi, s, ap] = r.f;
      if (!dmy) [d, mo] = [mo, d];
      y = +y < 100 ? 2000 + +y : +y;
      h = +h;
      if (ap) { const pm = /p/i.test(ap); h = (h % 12) + (pm ? 12 : 0); }
      return { t: new Date(y, +mo - 1, +d, h, +mi, +(s || 0)).getTime(), a: r.a, x: r.x.trim() };
    }).filter(m => !isNaN(m.t) && !/end-to-end encrypted|created group|added you|changed the subject/i.test(m.x));
  }

  function kind(x) {
    if (/sticker omitted|STK-.*\.webp/i.test(x)) return 'sticker';
    if (/audio omitted|PTT-|\.opus|voice message/i.test(x)) return 'voice';
    if (/GIF omitted/i.test(x)) return 'gif';
    if (/video omitted|VID-.*\.mp4/i.test(x)) return 'video';
    if (/image omitted|IMG-.*\.(jpe?g|png)|<Media omitted>/i.test(x)) return 'image';
    if (/document omitted|\.pdf \(file attached\)/i.test(x)) return 'doc';
    if (/^Missed (voice|video|group) call/i.test(x)) return 'missed';
    if (/^(Voice|Video) call|^Group call/i.test(x)) return 'call';
    if (/This message was deleted|You deleted this message/i.test(x)) return 'deleted';
    return 'text';
  }

  function fmtDur(sec) {
    if (sec < 60) return Math.round(sec) + ' sec';
    if (sec < 3600) return Math.round(sec / 60) + ' min';
    const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
    return h + ' h ' + String(m).padStart(2, '0');
  }
  const median = a => { if (!a.length) return 0; const s = [...a].sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
  const pct = (n, d) => d ? Math.round(100 * n / d) : 0;
  const top = (obj, n) => Object.entries(obj).sort((p, q) => q[1] - p[1]).slice(0, n);
  const ymd = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const ym = t => ymd(t).slice(0, 7);
  const count = (msgs, who, re) => msgs.filter(m => m.a === who && m.k === 'text' && re.test(m.x)).length;

  function analyze(msgs) {
    msgs.forEach(m => { m.k = kind(m.x); });
    const byWho = {};
    msgs.forEach(m => { byWho[m.a] = (byWho[m.a] || 0) + 1; });
    const people = top(byWho, 12).map(([a]) => a);
    const P = {};
    people.forEach(a => { P[a] = { n: byWho[a], first: 0, replies: [], night: 0, words: 0, emoji: {}, kinds: {}, vocab: {} }; });

    const GAP = 6 * 3600e3;
    let silence = { d: 0, from: 0, to: 0, resumedBy: '' };
    const hours = Array(24).fill(0), months = {}, days = {};
    msgs.forEach((m, i) => {
      const p = P[m.a]; if (!p) return;
      const prev = msgs[i - 1];
      if (!prev || m.t - prev.t >= GAP) p.first++;
      if (prev && prev.a !== m.a && m.t - prev.t < 12 * 3600e3 && m.t >= prev.t) p.replies.push((m.t - prev.t) / 1000);
      if (prev && m.t - prev.t > silence.d) silence = { d: m.t - prev.t, from: prev.t, to: m.t, resumedBy: m.a };
      const hr = new Date(m.t).getHours();
      hours[hr]++;
      if (hr < 5) p.night++;
      months[ym(m.t)] = (months[ym(m.t)] || 0) + 1;
      days[ymd(m.t)] = (days[ymd(m.t)] || 0) + 1;
      p.kinds[m.k] = (p.kinds[m.k] || 0) + 1;
      if (m.k === 'text') {
        p.words += m.x.split(/\s+/).length;
        (m.x.match(EMOJI) || []).map(emojiKey).forEach(e => { p.emoji[e] = (p.emoji[e] || 0) + 1; });
        if (!/https?:\/\//.test(m.x)) (m.x.toLowerCase().match(/[a-z][a-z']{2,}/g) || []).forEach(w => {
          if (!STOP.has(w)) p.vocab[w] = (p.vocab[w] || 0) + 1;
        });
      }
    });

    // Fill month gaps so charts read as a continuous timeline.
    const first = msgs[0].t, last = msgs[msgs.length - 1].t;
    const series = [];
    for (let d = new Date(new Date(first).getFullYear(), new Date(first).getMonth(), 1); d.getTime() <= last; d.setMonth(d.getMonth() + 1)) {
      const k = ym(d.getTime()); series.push([k, months[k] || 0]);
    }
    const spanDays = Math.max(1, Math.round((last - first) / 864e5));
    const allEmoji = {};
    people.forEach(a => Object.entries(P[a].emoji).forEach(([e, n]) => { allEmoji[e] = (allEmoji[e] || 0) + n; }));
    const firsts = people.reduce((s, a) => s + P[a].first, 0);
    const nights = people.reduce((s, a) => s + P[a].night, 0);
    const busiestHour = hours.indexOf(Math.max(...hours));
    const busiestDay = top(days, 1)[0];

    const per = people.map(a => {
      const p = P[a];
      const others = people.filter(b => b !== a);
      // Signature words: things this person says that the others almost never do.
      const sig = top(p.vocab, 400).filter(([w, n]) => n >= 6 && others.every(b => (P[b].vocab[w] || 0) * 6 < n)).slice(0, 8);
      return {
        name: a, n: p.n, share: pct(p.n, msgs.length), first: pct(p.first, firsts),
        reply: fmtDur(median(p.replies)), replySec: median(p.replies), night: p.night,
        words: p.words, emoji: top(p.emoji, 6).map(e => e[0]),
        stickers: p.kinds.sticker || 0, photos: p.kinds.image || 0, voice: p.kinds.voice || 0,
        callsPlaced: (p.kinds.call || 0) + (p.kinds.missed || 0), callsMissed: p.kinds.missed || 0,
        love: count(msgs, a, /love you|i love/i), sorry: count(msgs, a, /sorry/i),
        miss: count(msgs, a, /miss(ing)? you|miss ho/i), signature: sig.map(([w, n]) => [w, n])
      };
    });

    return {
      total: msgs.length, perDay: Math.round(msgs.length / spanDays), spanDays,
      activeDays: Object.keys(days).length, from: ymd(first), to: ymd(last),
      people: per, afterMidnight: pct(nights, msgs.length),
      busiestHour, hours, months: series,
      busiestDay: busiestDay ? { day: busiestDay[0], n: busiestDay[1] } : null,
      voice: per.reduce((s, p) => s + p.voice, 0), topEmoji: top(allEmoji, 3).map(e => e[0]),
      silence: { days: +(silence.d / 864e5).toFixed(1), from: ymd(silence.from), to: ymd(silence.to), resumedBy: silence.resumedBy }
    };
  }

  const api = { parse, analyze, kind, fmtDur };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Analyzer = api;
})(typeof window !== 'undefined' ? window : globalThis);

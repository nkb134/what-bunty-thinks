/* Auto-writer: turns analyzer stats + messages into a Brandon-style report for any uploaded chat.
   Rule-based, runs fully in the browser. */
(function (root) {
  const first = n => n.split(' ')[0];
  const hh = h => ((h % 12) || 12) + (h < 12 ? ' AM' : ' PM');
  const mon = k => new Date(k + '-01T00:00').toLocaleString('en', { month: 'long', year: 'numeric' });
  const day = k => new Date(k + 'T00:00').toLocaleString('en', { day: 'numeric', month: 'long', year: 'numeric' });
  const time = t => new Date(t).toTimeString().slice(0, 5);
  const ymd = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const isText = m => m.k === 'text' && m.x.length > 1 && m.x.length < 160 && !/https?:|omitted|\d{5,}/.test(m.x);
  const fmt = n => n.toLocaleString('en');

  function write(msgs, s, opts) {
    const ppl = s.people.slice(0, 2);
    const [A, B] = ppl;
    const name = p => (p ? first(p.name) : 'Someone');
    const group = s.people.length > 2;
    const lead = [...s.people].sort((p, q) => q.first - p.first)[0];
    const fast = [...s.people].sort((p, q) => p.replySec - q.replySec)[0];
    const slow = [...s.people].sort((p, q) => q.replySec - p.replySec)[0];
    const names = Object.fromEntries(s.people.map(p => [p.name, first(p.name)]));
    const say = (m) => [names[m.a] || first(m.a), m.x, time(m.t)];

    // Busiest-day excerpt and the messages that broke the longest silence.
    const busy = s.busiestDay ? msgs.filter(m => isText(m) && ymd(m.t) === s.busiestDay.day) : [];
    const busyBits = busy.slice(Math.max(0, Math.floor(busy.length / 2) - 3)).slice(0, 7).map(say);
    const breakIdx = msgs.findIndex(m => ymd(m.t) >= s.silence.to);
    const breakBits = msgs.slice(Math.max(0, breakIdx), breakIdx + 12).filter(isText).slice(0, 4).map(say);

    // Peak month and the steepest drop: "the week it changed".
    const ms = s.months;
    const peak = ms.reduce((b, m) => (m[1] > b[1] ? m : b), ms[0]);
    let drop = null;
    for (let i = 3; i < ms.length - 1; i++) {
      const avg = (ms[i - 1][1] + ms[i - 2][1] + ms[i - 3][1]) / 3;
      const d = avg ? (avg - ms[i][1]) / avg : 0;
      if (!drop || d > drop.d) drop = { d, k: ms[i][0], avg: Math.round(avg), n: ms[i][1] };
    }

    const preview = msgs.filter(isText).slice(-60).slice(-13).map(say);
    const talker = [...s.people].sort((p, q) => q.share - p.share)[0];
    const lover = [...s.people].sort((p, q) => q.love - p.love)[0];
    const sticky = [...s.people].sort((p, q) => q.stickers - p.stickers)[0];
    const sorry = [...s.people].sort((p, q) => q.sorry - p.sorry)[0];
    const owl = [...s.people].sort((p, q) => q.night - p.night)[0];
    const caller = [...s.people].sort((p, q) => q.callsPlaced - p.callsPlaced)[0];

    const chapters = [
      { h: 'Who texts first, and who pretends not to care', blocks: [
        { p: `${name(lead)} starts ${lead.first}% of your conversations. ${group ? 'The rest of the group' : name(lead === A ? B : A)} mostly waits to be asked. ` +
          `${name(fast)} replies in a median of ${fast.reply}${slow !== fast ? `; ${name(slow)} takes ${slow.reply}` : ''}.` },
        { big: [[fmt(s.total), 'messages'], [lead.first + '%', `conversations started by ${name(lead)}`], [fast.reply, `${name(fast)}'s median reply`]] },
        { p: `${name(talker)} does ${talker.share}% of the talking.` + (A && B && Math.abs(A.share - B.share) < 8 ? ' That is about as even as chats get.' : ' Someone is carrying this conversation, and you both know who.') }
      ] },
      { h: 'The day you couldn\'t stop texting', blocks: [
        { p: s.busiestDay ? `Your busiest day was ${day(s.busiestDay.day)}, with ${s.busiestDay.n} messages. Here is a slice of it:` : 'No day stands out. You keep a steady rhythm.' },
        busyBits.length ? { chat: busyBits } : { p: '' }
      ] },
      { h: 'The month it changed', blocks: [
        { chart: 'months' },
        { p: `Your peak was ${mon(peak[0])}, with ${fmt(peak[1])} messages.` + (drop && drop.d > 0.35 ? ` The sharpest drop came in ${mon(drop.k)}, when you went from about ${drop.avg} a month to ${drop.n}. Something shifted there. Scroll back to it.` : ' There is no dramatic cliff in this chat, just the normal tides.') }
      ] },
      { h: 'The longest silence', blocks: [
        { p: `${s.silence.days} days, from ${day(s.silence.from)} to ${day(s.silence.to)}. ${first(s.silence.resumedBy)} broke it.` + (breakBits.length ? ' This is how:' : '') },
        breakBits.length ? { chat: breakBits } : { p: '' }
      ] },
      { h: 'How you say it', blocks: [
        { chart: 'hours' },
        { p: `You talk most around ${hh(s.busiestHour)}. ${s.afterMidnight}% of your messages are sent after midnight, mostly by ${name(owl)}. ` +
          s.people.slice(0, 4).map(p => `${name(p)}: ${p.love} "love you"s, ${p.sorry} sorries, ${p.stickers} stickers, favourite emoji ${p.emoji[0] || 'none'}.`).join(' ') }
      ] }
    ];

    const awards = [
      { icon: '🚀', title: 'Texts first', who: name(lead), why: `Starts ${lead.first}% of conversations.` },
      { icon: '⚡', title: 'Fastest thumbs', who: name(fast), why: `Median reply time: ${fast.reply}.` },
      { icon: '🦉', title: 'Night owl', who: name(owl), why: `${owl.night} messages between midnight and 5 AM.` },
      { icon: '❤️', title: 'Says it most', who: name(lover), why: `${lover.love} "love you"s.` },
      { icon: '🧩', title: 'Sticker person', who: name(sticky), why: `${sticky.stickers} stickers sent.` },
      { icon: '🙏', title: 'Apologizer-in-chief', who: name(sorry), why: `${sorry.sorry} sorries.` },
      { icon: '📞', title: 'Most likely to call', who: name(caller), why: `${caller.callsPlaced} calls placed.` }
    ].filter(a => !/: 0\b|^0 /.test(a.why) && !/\b0 (stickers|sorries|calls|"love)/.test(a.why));

    const quotes = msgs.filter(m => isText(m) && m.x.length > 25 && /love|miss|sorry|proud|happy|thank|together|always/i.test(m.x))
      .filter((m, i, a) => i % Math.max(1, Math.floor(a.length / 10)) === 0).slice(0, 10)
      .map(m => ({ who: names[m.a] || first(m.a), x: m.x, date: new Date(m.t).toLocaleString('en', { month: 'short', year: 'numeric' }), tag: /sorry/i.test(m.x) ? '🙏 Sorry' : /miss/i.test(m.x) ? '🥺 Missing' : '❤️ Soft' }));

    const balance = A && B ? Math.abs(A.first - B.first) : 0;
    const verdict = { h: 'Verdict', p: [
      balance > 25 ? `This chat leans. ${name(lead)} reaches out ${lead.first}% of the time, and that is a lot of knocking on one door. If you are ${name(lead === A ? B : A)}, go first next time. It costs nothing and it will be noticed.`
        : 'This chat is balanced. You both reach out, you both show up, and nobody is keeping score. That is rarer than you think.',
      `${fmt(s.total)} messages over ${s.spanDays} days, ${s.activeDays} of which you actually talked. Whatever you are to each other, you keep coming back. Do it in person once in a while.`
    ] };

    return {
      id: 'u' + Date.now(), label: opts.label || (group ? 'Group chat' : name(B || A)), emoji: opts.emoji || '💬', tag: opts.tag || 'Chat', app: 'WhatsApp',
      me: opts.me || (A && A.name), names, title: group ? `${s.people.length} People, ${fmt(s.total)} Messages and One Group Chat` :
        `${name(lead)} Texts First, ${fmt(s.total)} Messages and a ${s.silence.days}-Day Silence`,
      intro: `I read all ${fmt(s.total)} messages, from ${day(s.from)} to ${day(s.to)}. Here is what I think.`,
      preview, chapters, awards, quotes, verdict, stats: s
    };
  }

  const api = { write };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Writer = api;
})(typeof window !== 'undefined' ? window : globalThis);

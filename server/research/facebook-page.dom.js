// Facebook page reader for OpenCLI `browser eval` — copied VERBATIM from DivisionX Card deploy/agents/social_watch.py (FB_JS).
// Loaded with fs.readFileSync and passed to OpenCLI as-is. Never paste this into a JS template literal:
// `\/`, `\d`, `\s` would be mangled and the login/checkpoint detector would silently stop working.
// Returns only captions + counts + media ids. No commenter names or comment text.
// Source of truth for DOM fixes is the DVX file; re-run scratchpad extract-fbjs.mjs after DVX changes it.

(() => {
  const clean = s => (s || '').replace(/[\u200b-\u200f\u034f\u2060\ufeff]/g, '');
  const path = location.pathname;
  if (/^\/(login|checkpoint)/.test(path)) return { blocked: path.split('/')[1], posts: [] };
  if (document.querySelector('input[name="pass"]') && !document.querySelector('div[aria-posinset]'))
    return { blocked: 'login', posts: [] };
  const MUL = { k: 1e3, K: 1e3, m: 1e6, M: 1e6, 'พัน': 1e3, 'หมื่น': 1e4, 'แสน': 1e5, 'ล้าน': 1e6 };
  const num = s => {
    const m = String(s || '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*([KkMm]|พัน|หมื่น|แสน|ล้าน)?/);
    return m ? Math.round(parseFloat(m[1]) * (MUL[m[2]] || 1)) : null;
  };
  const N = '([\\d.,]+\\s*(?:[KkMm]|พัน|หมื่น|แสน|ล้าน)?)';
  const RX = {
    comments: [new RegExp('^' + N + '\\s+comments?$', 'i'), new RegExp('^ความคิดเห็น\\s*' + N + '\\s*รายการ$')],
    shares: [new RegExp('^' + N + '\\s+shares?$', 'i'), new RegExp('^(?:แชร์|การแชร์)\\s*' + N + '\\s*ครั้ง$')],
    views: [new RegExp('^' + N + '\\s+(?:views?|plays?)$', 'i'), new RegExp('^(?:การดู|ดู|ยอดดู)\\s*' + N + '\\s*ครั้ง$')],
  };
  const UI = /^(?:·\s*)?(See translation|See original|Rate this translation|See more|… ?See more|ดูคำแปล|ดูต้นฉบับ|ให้คะแนนคำแปลนี้|ดูเพิ่มเติม|Send message|ส่งข้อความ|Like|Comment|Share|ถูกใจ|แสดงความคิดเห็น|แชร์|Follow|ติดตาม|·)$/;
  const STOP = /^(All reactions:?|ความรู้สึกทั้งหมด:?|Like|ถูกใจ)$/i;
  const posts = [];
  for (const a of document.querySelectorAll('div[aria-posinset]')) {
    const txt = clean(a.innerText).trim();
    if (!txt) continue;
    // ⚠️ 22 ต.ค. 2026 — บางโพสต์มีป้ายซ่อนคำว่า "Facebook" ซ้ำหลายสิบบรรทัดนำหน้า (เห็นใน innerText)
    //    ไม่กรองแล้วแคปชั่นสำรองกลายเป็น "Facebook" 32 บรรทัด + ชื่อเพจ (เจอที่ Pokémon Trainers Thailand)
    const lines = txt.split('\n').map(s => s.trim()).filter(l => l && l !== 'Facebook');
    const m = { reactions: null, comments: null, shares: null, views: null };
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (m.reactions == null && /^(All reactions:?|ความรู้สึกทั้งหมด:?)$/i.test(l)) m.reactions = num(lines[i + 1]);
      for (const k of ['comments', 'shares', 'views']) {
        if (m[k] != null) continue;
        for (const rx of RX[k]) { const x = l.match(rx); if (x) { m[k] = num(x[1]); break; } }
      }
    }
    const msgEl = a.querySelector('[data-ad-comet-preview="message"], [data-ad-preview="message"]');
    let caption = msgEl ? clean(msgEl.innerText) : '';
    if (!caption) {
      const end = lines.findIndex(l => STOP.test(l) || RX.views[0].test(l));
      caption = lines.slice(1, end > 0 ? end : 12)
        .filter(l => l.length > 2 && !UI.test(l) && !/^\d+:\d+ \/ \d+:\d+$/.test(l)).join('\n');
    }
    caption = caption.replace(/…\s*(See more|ดูเพิ่มเติม)\s*$/, '…').trim();
    const vEl = a.querySelector('[data-video-id]');
    const vid = vEl ? vEl.getAttribute('data-video-id') : null;
    const fbids = [...new Set([...a.querySelectorAll('a[href*="fbid="]')]
      .map(x => ((x.getAttribute('href') || '').match(/[?&]fbid=(\d+)/) || [])[1]).filter(Boolean))];
    const perma = [...a.querySelectorAll('a[href]')].map(x => x.href)
      .find(h => /\/posts\/|story_fbid=|\/permalink\.php|\/reel\/\d+|\/videos\/\d+/.test(h) && !/comment_id=/.test(h)) || null;
    const ext = [...a.querySelectorAll('a[href*="l.facebook.com/l.php"]')].map(x => {
      try { return new URL(new URL(x.href).searchParams.get('u')).hostname; } catch (e) { return null; } }).find(Boolean) || null;
    const format = vid ? 'video' : fbids.length > 1 ? 'album' : fbids.length === 1 ? 'photo' : ext ? 'link' : 'text';
    posts.push({ pos: Number(a.getAttribute('aria-posinset')) || null, vid, fbids: fbids.slice(0, 4), perma, ext,
      format, caption: caption.slice(0, 700), m });
  }
  return { blocked: null, posts };
})()

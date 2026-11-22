/* Family tree renderer. Data: js/family-data.js (built from guide/data/family.json, posted episodes only).
   Draws each group as a small tree; follows the "watched up to" filter; tap a person for a card panel. No network. */
(function () {
  var D = window.VI_FAMILY; if (!D) return;
  var L = document.documentElement.lang || 'en';
  var ROOT = document.documentElement.getAttribute('data-root') || '';
  var S = D.strings[L];
  var DOWN = { parent: 1, descendant: 1, teacher: 1 };
  var SVGNS = 'http://www.w3.org/2000/svg';
  function upto() { return window.VI_UPTO ? window.VI_UPTO() : D.max; }
  function vis(l, u) { return l.ep <= u && !(l.until && u >= l.until); }
  function nm(id) { return D.people[id].n[L]; }
  function first(s) {
    try { if (window.Intl && Intl.Segmenter) { var it = new Intl.Segmenter(L, { granularity: 'grapheme' }).segment(s)[Symbol.iterator](); return it.next().value.segment; } } catch (e) {}
    return s.charAt(0);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function medal(id) {
    var p = D.people[id];
    if (p.img) return '<img src="' + ROOT + 'img/' + p.img + '.jpg" alt="" loading="lazy">';
    var n = nm(id).replace(/^(King|राजा)\s+/, '');
    return '<span class="mono" aria-hidden="true">' + esc(first(n)) + '</span>';
  }

  function dims() {
    var small = window.innerWidth < 640;
    return small ? { W: 74, D: 50, GI: 6, GX: 10, PAD: 10, NH: 50 + 6 + 34, RG: 40, small: true }
                 : { W: 100, D: 62, GI: 18, GX: 24, PAD: 22, NH: 62 + 6 + 36, RG: 46 };
  }

  function layout(links, M) {
    var ids = [], seen = {};
    links.forEach(function (l) { [l.a, l.b].forEach(function (x) { if (!seen[x]) { seen[x] = 1; ids.push(x); } }); });
    var g = {}; ids.forEach(function (x) { g[x] = 0; });
    for (var it = 0; it < 80; it++) {
      var ch = false;
      links.forEach(function (l) {
        if (DOWN[l.type]) { var s = l.span || 1; if (g[l.b] < g[l.a] + s) { g[l.b] = g[l.a] + s; ch = true; } }
        else { var m = Math.max(g[l.a], g[l.b]); if (g[l.a] !== m || g[l.b] !== m) { g[l.a] = g[l.b] = m; ch = true; } }
      });
      if (!ch) break;
    }
    var rows = []; ids.forEach(function (x) { if (rows.indexOf(g[x]) < 0) rows.push(g[x]); });
    rows.sort(function (a, b) { return a - b; });
    var row = {}; ids.forEach(function (x) { row[x] = rows.indexOf(g[x]); });
    var par = {}; ids.forEach(function (x) { par[x] = x; });
    function f(x) { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; }
    function un(a, b) { a = f(a); b = f(b); if (a !== b) par[b] = a; }
    links.forEach(function (l) { if (l.type === 'spouse' || l.type === 'sibling') un(l.a, l.b); });
    var parentsOf = {};
    links.forEach(function (l) { if (l.type === 'parent') (parentsOf[l.b] = parentsOf[l.b] || []).push(l.a); });
    var copar = [];
    Object.keys(parentsOf).forEach(function (c) {
      var p = parentsOf[c];
      if (p.length === 2 && row[p[0]] === row[p[1]]) {
        var married = links.some(function (l) { return l.type === 'spouse' && ((l.a === p[0] && l.b === p[1]) || (l.a === p[1] && l.b === p[0])); });
        if (!married) copar.push([p[0], p[1]]);
        un(p[0], p[1]);
      }
    });
    var units = {}, order = [];
    ids.forEach(function (x) { var r = f(x); if (!units[r]) { units[r] = []; order.push(r); } units[r].push(x); });
    var kids = {}, hasPar = {};
    links.forEach(function (l) {
      if (!DOWN[l.type]) return;
      var pu = f(l.a), cu = f(l.b);
      if (pu === cu || hasPar[cu]) return;
      hasPar[cu] = pu; (kids[pu] = kids[pu] || []).push(cu);
    });
    function uw(U) { var n = units[U].length; return n * M.W + (n - 1) * M.GI; }
    var memo = {};
    function sw(U) {
      if (memo[U] != null) return memo[U];
      var s = 0; (kids[U] || []).forEach(function (c, i) { s += sw(c) + (i ? M.GX : 0); });
      return (memo[U] = Math.max(uw(U), s));
    }
    var pos = {};
    function place(U, left) {
      var w = sw(U), ux = left + (w - uw(U)) / 2;
      units[U].forEach(function (m, i) { pos[m] = { x: ux + i * (M.W + M.GI) + M.W / 2, y: M.PAD + row[m] * (M.NH + M.RG), unit: U, idx: i }; });
      var k = kids[U] || [], s = 0;
      k.forEach(function (c, i) { s += sw(c) + (i ? M.GX : 0); });
      var x = left + (w - s) / 2;
      k.forEach(function (c) { place(c, x); x += sw(c) + M.GX; });
    }
    var x = M.PAD;
    order.forEach(function (U) { if (!hasPar[U]) { place(U, x); x += sw(U) + M.GX * 2; } });
    return { pos: pos, width: x - M.GX * 2 + M.PAD, height: M.PAD * 2 + rows.length * M.NH + (rows.length - 1) * M.RG, copar: copar, parentsOf: parentsOf };
  }

  function line(svg, d, cls) {
    var p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', d); p.setAttribute('fill', 'none');
    var st = getComputedStyle(document.documentElement);
    var gold = st.getPropertyValue('--gold').trim() || '#b48c3c', ink = st.getPropertyValue('--mut').trim() || '#5d596b';
    var A = { spouse: [gold, 1.6, ''], parent: [ink, 1.3, ''], copar: [ink, 1.2, ''], descendant: [ink, 1.3, '2 5'], sibling: [ink, 1.2, '1 4'], teacher: [gold, 1.3, '7 5'] }[cls];
    p.setAttribute('stroke', A[0]); p.setAttribute('stroke-width', A[1]); if (A[2]) p.setAttribute('stroke-dasharray', A[2]);
    p.setAttribute('stroke-linecap', 'round');
    svg.appendChild(p);
  }

  function parts(links) { // connected pieces, in link order
    var par = {};
    function f(x) { if (par[x] == null) par[x] = x; while (par[x] !== x) x = par[x]; return x; }
    links.forEach(function (l) { var a = f(l.a), b = f(l.b); if (a !== b) par[b] = a; });
    var out = [], idx = {};
    links.forEach(function (l) { var r = f(l.a); if (idx[r] == null) { idx[r] = out.length; out.push([]); } out[idx[r]].push(l); });
    return out;
  }
  function draw(box, links) {
    box.innerHTML = '';
    if (!links.length) { box.innerHTML = '<p class="tempty" style="padding:16px">' + esc(S.empty) + '</p>'; return; }
    var M = dims();
    if (M.small) { var ps = parts(links); if (ps.length > 1) { ps.forEach(function (p) { drawOne(box, p, M); }); return; } }
    drawOne(box, links, M);
  }
  function drawOne(box, links, M) {
    var Lo = layout(links, M), P = Lo.pos;
    var cv = document.createElement('div'); cv.className = 'tcanvas';
    cv.style.width = Lo.width + 'px'; cv.style.height = Lo.height + 'px';
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('width', Lo.width); svg.setAttribute('height', Lo.height); svg.setAttribute('aria-hidden', 'true');
    cv.appendChild(svg);
    var r = M.D / 2;
    function cy(id) { return P[id].y + r; }
    // couples and co-parents
    links.forEach(function (l) {
      if (l.type !== 'spouse') return;
      var a = P[l.a], b = P[l.b]; var L1 = a.x < b.x ? a : b, R1 = a.x < b.x ? b : a;
      if (Math.abs(a.idx - b.idx) === 1) {
        line(svg, 'M' + (L1.x + r + 3) + ' ' + (cy(l.a) - 2.5) + 'H' + (R1.x - r - 3), 'spouse');
        line(svg, 'M' + (L1.x + r + 3) + ' ' + (cy(l.a) + 2.5) + 'H' + (R1.x - r - 3), 'spouse');
      } else {
        line(svg, 'M' + L1.x + ' ' + (L1.y - 4) + 'Q' + ((L1.x + R1.x) / 2) + ' ' + (L1.y - 30) + ' ' + R1.x + ' ' + (R1.y - 4), 'spouse');
      }
    });
    Lo.copar.forEach(function (c) {
      var a = P[c[0]], b = P[c[1]]; var L1 = a.x < b.x ? a : b, R1 = a.x < b.x ? b : a;
      line(svg, 'M' + (L1.x + r + 3) + ' ' + (L1.y + r) + 'H' + (R1.x - r - 3), 'copar');
    });
    // brothers: one bracket under the names
    var sib = {};
    links.forEach(function (l) { if (l.type === 'sibling') { var u = P[l.a].unit; (sib[u] = sib[u] || {})[l.a] = 1; sib[u][l.b] = 1; } });
    Object.keys(sib).forEach(function (u) {
      var xs = Object.keys(sib[u]).map(function (id) { return P[id].x; }), y = P[Object.keys(sib[u])[0]].y + M.NH + 6;
      var mn = Math.min.apply(null, xs), mx = Math.max.apply(null, xs);
      line(svg, 'M' + mn + ' ' + y + 'H' + mx, 'sibling');
      xs.forEach(function (x) { line(svg, 'M' + x + ' ' + (y - 6) + 'V' + y, 'sibling'); });
    });
    // parent, descendant and teacher lines
    var done = {};
    links.forEach(function (l) {
      if (!DOWN[l.type]) return;
      var ps = (Lo.parentsOf[l.b] || []).filter(function (p) { return P[p] && P[p].unit === P[l.a].unit; });
      var key = l.b + '|' + l.type; if (l.type === 'parent' && ps.length === 2) { if (done[key]) return; done[key] = 1; }
      var ax, ay;
      if (l.type === 'parent' && ps.length === 2 && Math.abs(P[ps[0]].idx - P[ps[1]].idx) === 1) { ax = (P[ps[0]].x + P[ps[1]].x) / 2; ay = cy(ps[0]); }
      else { ax = P[l.a].x; ay = P[l.a].y + M.NH + 2; }
      var b = P[l.b], by = b.y - 4;
      var bus = P[l.a].y + M.NH + Math.min(M.RG / 2, 22);
      if (sib[P[l.a].unit]) bus += 8;
      if (l.type === 'descendant') bus += 10;   // keep dotted lines off the solid parent line
      line(svg, 'M' + ax + ' ' + ay + 'V' + bus + 'H' + b.x + 'V' + by, l.type);
    });
    // nodes
    Object.keys(P).forEach(function (id) {
      var p = P[id], bt = document.createElement('button');
      bt.type = 'button'; bt.className = 'tnode'; bt.setAttribute('data-id', id); bt.setAttribute('aria-pressed', 'false');
      bt.setAttribute('aria-label', nm(id) + '. ' + D.people[id].r[L]);
      bt.style.left = (p.x - M.W / 2) + 'px'; bt.style.top = p.y + 'px'; bt.style.width = M.W + 'px';
      bt.innerHTML = '<span class="med" style="width:' + M.D + 'px;height:' + M.D + 'px">' + medal(id) + '</span><span class="tn">' + esc(nm(id)) + '</span>';
      bt.addEventListener('click', function () { open(id, bt); });
      cv.appendChild(bt);
    });
    box.appendChild(cv);
  }

  // panel
  var panel, lastBtn;
  function close() {
    if (!panel) return; panel.hidden = true;
    var pr = document.querySelectorAll('.tnode[aria-pressed="true"]'); for (var i = 0; i < pr.length; i++) pr[i].setAttribute('aria-pressed', 'false');
    if (lastBtn) try { lastBtn.focus(); } catch (e) {}
  }
  function open(id, btn) {
    if (!panel) {
      panel = document.createElement('div'); panel.className = 'tpanel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'false');
      document.body.appendChild(panel);
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panel && !panel.hidden) close(); });
    }
    if (btn) lastBtn = btn;
    var pr = document.querySelectorAll('.tnode'); for (var i = 0; i < pr.length; i++) pr[i].setAttribute('aria-pressed', pr[i].getAttribute('data-id') === id ? 'true' : 'false');
    var p = D.people[id], u = upto();
    var rels = D.links.filter(function (l) { return vis(l, u) && (l.a === id || l.b === id); });
    var lis = rels.map(function (l) {
      var other = l.a === id ? l.b : l.a, key = l.a === id ? l.ab : l.ba;
      return '<li><span>' + esc(D.rel[key][L][0]) + ': <button type="button" data-go="' + other + '">' + esc(nm(other)) + '</button></span><span class="v">' + esc(S.adi) + ' ' + esc(l.v) + '</span></li>';
    }).join('');
    var ep = p.ep, t = D.titles[L][ep] || '';
    var card = (p.card && u >= D.cardEp) ? '<p><a href="' + ROOT + L + '/c/' + p.img + '.html">' + esc(S.card) + ' →</a></p>' : '';
    panel.setAttribute('aria-label', nm(id));
    panel.innerHTML = '<button type="button" class="x" aria-label="' + esc(S.close) + '">×</button>' +
      '<div class="ph"><span class="med">' + medal(id) + '</span><div><h2>' + esc(nm(id)) + '</h2></div></div>' +
      '<p class="role">' + esc(p.r[L]) + '</p>' +
      '<h4>' + esc(S.first) + '</h4><p><a href="' + ROOT + L + '/index.html#ep-' + ep + '">' + esc(S.ep.replace('{n}', ep)) + ' · ' + esc(t) + '</a></p>' +
      (lis ? '<h4>' + esc(S.rels) + '</h4><ul>' + lis + '</ul>' : '') + card;
    panel.hidden = false;
    panel.querySelector('.x').addEventListener('click', close);
    var go = panel.querySelectorAll('[data-go]');
    for (var j = 0; j < go.length; j++) go[j].addEventListener('click', function () {
      var oid = this.getAttribute('data-go'), b = document.querySelector('.tnode[data-id="' + oid + '"]');
      if (b) { try { b.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} }
      open(oid, b || lastBtn);
    });
    panel.querySelector('.x').focus();
  }

  function render() {
    var u = upto();
    var boxes = document.querySelectorAll('[data-tree]');
    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i], spec = b.getAttribute('data-tree'), links;
      if (spec.indexOf('ids:') === 0) {
        var set = spec.slice(4).split(','), types = (b.getAttribute('data-types') || '').split(',');
        links = D.links.filter(function (l) { return vis(l, u) && set.indexOf(l.a) >= 0 && set.indexOf(l.b) >= 0 && types.indexOf(l.type) >= 0; });
      } else {
        links = D.links.filter(function (l) { return vis(l, u) && l.g === spec; });
      }
      var sec = b.closest('.tg'); if (sec) { sec.hidden = !links.length; sec.classList.remove('wide'); }
      draw(b, links);
      var cv = b.querySelector('.tcanvas');
      if (sec && cv && sec.parentNode.classList.contains('tgrid') && cv.offsetWidth > b.clientWidth + 1) sec.classList.add('wide');
    }
    if (panel && !panel.hidden) close();
    var none = document.getElementById('tnone');
    if (none) none.hidden = !!document.querySelector('.tg:not([hidden])');
  }
  var rt, lastW = window.innerWidth;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastW) return; // phones fire resize when the address bar moves
    lastW = window.innerWidth; clearTimeout(rt); rt = setTimeout(render, 150);
  });
  document.addEventListener('vi:upto', render);
})();

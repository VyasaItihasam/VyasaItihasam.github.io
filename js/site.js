/* Vyasa Itihasam guide: language picker, language switch, "watched up to" spoiler filter.
   localStorage only, every access guarded. No network, no cookies, no third-party code. */
(function () {
  var KEY = 'vi_watched_upto', LKEY = 'vi_lang', LANGS = ['en', 'te', 'hi'];
  function read(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function write(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* private mode: keep going */ } }
  var root = document.documentElement;
  var MAX = parseInt(root.getAttribute('data-max'), 10) || 1;
  var upto = parseInt(read(KEY), 10);
  if (!(upto >= 1 && upto <= MAX)) upto = MAX;
  window.VI_UPTO = function () { return upto; };

  function apply() {
    var els = document.querySelectorAll('[data-ep]');
    for (var i = 0; i < els.length; i++) {
      var ep = parseInt(els[i].getAttribute('data-ep'), 10);
      var until = parseInt(els[i].getAttribute('data-until'), 10);
      els[i].hidden = ep > upto || (until > 0 && upto >= until);
    }
    var lk = document.querySelectorAll('[data-below]');
    for (var j = 0; j < lk.length; j++) {
      lk[j].style.display = upto < parseInt(lk[j].getAttribute('data-below'), 10) ? 'block' : 'none';
    }
    var sel = document.getElementById('upto'); if (sel) sel.value = String(upto);
    var ev; try { ev = new CustomEvent('vi:upto'); } catch (e) { ev = document.createEvent('Event'); ev.initEvent('vi:upto', false, false); }
    document.dispatchEvent(ev);
  }

  function choose(lang) { if (LANGS.indexOf(lang) >= 0) write(LKEY, lang); }

  function showPicker() {
    var p = document.getElementById('picker');
    if (!p) return;
    p.hidden = false;
    var first = p.querySelector('a'); if (first) first.focus();
    p.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { choose(root.lang); p.hidden = true; }
      if (e.key === 'Tab') { // keep focus inside the picker
        var a = p.querySelectorAll('a'); if (!a.length) return;
        if (e.shiftKey && document.activeElement === a[0]) { e.preventDefault(); a[a.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === a[a.length - 1]) { e.preventDefault(); a[0].focus(); }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var sel = document.getElementById('upto');
    if (sel) sel.addEventListener('change', function () { upto = parseInt(sel.value, 10) || MAX; write(KEY, String(upto)); apply(); });
    var ls = document.querySelectorAll('[data-setlang]');
    for (var i = 0; i < ls.length; i++) ls[i].addEventListener('click', function () { choose(this.getAttribute('data-setlang')); });
    var stored = read(LKEY);
    if (root.hasAttribute('data-picker-page')) {
      if (LANGS.indexOf(stored) >= 0) { window.location.replace(stored + '/index.html'); return; }
      var f = document.querySelector('#picker a'); if (f) f.focus();
    } else if (LANGS.indexOf(stored) < 0) {
      showPicker();
    }
    apply();
  });
})();

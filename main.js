(function () {
  "use strict";

  // ==== 案件設定 ====
  var CAMPAIGN_RATE = 20; // 楽天スーパーDEALの還元率(通常1倍分を含む・店舗ポイントとは併用なし)
  var TAX_RATE = 1.08; // DEALのポイントは税抜価格が基準
  var START = new Date("2026-11-22T00:00:00+09:00").getTime();
  var END = new Date("2026-11-23T00:00:00+09:00").getTime();
  var SIZES = [
    { cups: 80, price: 2788 },
    { cups: 100, price: 3288 },
    { cups: 160, price: 5188, popular: true },
    { cups: 200, price: 6288 },
    { cups: 300, price: 8888 }
  ];
  var MIN_DAYS = 30; // おすすめは「1か月以上もつ最小サイズ」
  var WALL_WORDS = 90;
  var WALL_STAGGER_MS = 24;
  var COUNT_MS = 1400;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var qs = function (s) { return document.querySelector(s); };
  var qsa = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var yen = function (n) { return n.toLocaleString("ja-JP"); };

  // 確認用: ?now=2026-11-22T12:00:00%2B09:00 で開催中の表示を確認できる
  var fixedNow = (function () {
    var v = new URLSearchParams(location.search).get("now");
    var t = v ? new Date(v).getTime() : NaN;
    return isNaN(t) ? null : t;
  })();
  var nowMs = function () { return fixedNow === null ? Date.now() : fixedNow; };

  function onceInView(el, threshold, cb) {
    if (reduced || !("IntersectionObserver" in window)) { cb(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      cb();
    }, { threshold: threshold });
    io.observe(el);
  }

  /* ---- FV: レビュー件数のカウント ---- */
  function runCount() {
    if (reduced) return;
    var el = qs("[data-count]");
    var target = Number(el.dataset.count);
    var start = performance.now();
    (function tick(t) {
      var p = Math.min(1, (t - start) / COUNT_MS);
      el.textContent = yen(Math.round(target * (1 - Math.pow(1 - p, 4))));
      if (p < 1) requestAnimationFrame(tick);
    })(start);
  }

  /* ---- カウントダウン ---- */
  function pad(n) { return String(n).padStart(2, "0"); }
  function unit(n, u) { return n + "<small>" + u + "</small>"; }

  function renderClock() {
    var now = nowMs();
    var label = qs("[data-clock-label]");
    var clocks = qsa("[data-clock]");
    var html;
    if (now >= END) {
      label.textContent = "本企画は終了しました";
      clocks.forEach(function (c) { c.hidden = true; });
      qsa(".btn[data-cta]").forEach(function (b) {
        b.textContent = "商品ページを見る";
        b.classList.add("is-off");
      });
      return false;
    }
    if (now < START) {
      var left = START - now;
      label.textContent = "開始まで";
      html = "あと" + unit(Math.floor(left / 864e5), "日") + unit(Math.floor(left / 36e5) % 24, "時間") + unit(Math.floor(left / 6e4) % 60, "分");
    } else {
      var rest = END - now;
      label.textContent = "終了まで";
      html = "あと" + unit(Math.floor(rest / 36e5), "時間") + unit(pad(Math.floor(rest / 6e4) % 60), "分") + unit(pad(Math.floor(rest / 1e3) % 60), "秒");
    }
    clocks.forEach(function (c) { c.innerHTML = html; });
    return true;
  }

  /* ---- 「おいしい」の壁 ---- */
  function setupWall() {
    var wall = qs("[data-wall]");
    var sizes = [14, 16, 19, 23, 28];
    var frag = document.createDocumentFragment();
    var spans = Array.from({ length: WALL_WORDS }, function (_, i) {
      var s = document.createElement("span");
      s.textContent = "おいしい";
      s.style.fontSize = sizes[(i * 7 + (i % 5) * 3) % sizes.length] + "px";
      frag.appendChild(s);
      return s;
    });
    wall.appendChild(frag);
    onceInView(wall, 0.3, function () {
      spans.forEach(function (_, n) {
        var idx = (n * 37) % spans.length;
        setTimeout(function () { spans[idx].classList.add("is-lit"); }, reduced ? 0 : n * WALL_STAGGER_MS);
      });
    });
  }

  /* ---- 倍率の帯 ---- */
  function setupRate() {
    var rate = qs("[data-rate]");
    onceInView(rate, 0.5, function () { rate.classList.add("is-in"); });
  }

  /* ---- サイズ計算 ---- */
  function recommend(people, cups) {
    var perDay = people * cups;
    var fit = SIZES.filter(function (s) { return s.cups / perDay >= MIN_DAYS; })[0] || SIZES[SIZES.length - 1];
    return { size: fit, days: Math.floor(fit.cups / perDay) };
  }

  function setupCalc() {
    var state = { people: 2, cups: 2 };
    function render() {
      var r = recommend(state.people, state.cups);
      qs("[data-res-size]").textContent = "約" + r.size.cups + "杯分";
      qs("[data-res-days]").textContent = r.days;
    }
    qsa("[data-opts]").forEach(function (group) {
      group.addEventListener("click", function (e) {
        var btn = e.target.closest("button");
        if (!btn) return;
        Array.prototype.forEach.call(group.children, function (b) { b.classList.toggle("on", b === btn); });
        state = Object.assign({}, state, { [group.dataset.opts]: Number(btn.dataset.v) });
        render();
      });
    });
    render();
  }

  /* ---- ポイント早見表 ---- */
  function renderPoints() {
    qs("[data-points]").innerHTML = SIZES.map(function (s) {
      var pt = Math.floor((s.price / TAX_RATE) * CAMPAIGN_RATE / 100 / 10) * 10;
      var tag = s.popular ? "<small>1番人気</small>" : "";
      return "<tr><td>" + tag + "約" + s.cups + "杯分</td><td>" + yen(s.price) + "円</td><td>約" + yen(pt) + "pt</td></tr>";
    }).join("");
  }

  /* ---- 追従CTA ---- */
  function setupDock() {
    if (!("IntersectionObserver" in window)) return;
    var dock = qs("[data-dock]");
    var fv = qs(".fv");
    var hide = { fv: true, final: false };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        hide = Object.assign({}, hide, e.target === fv ? { fv: e.isIntersecting } : { final: e.isIntersecting });
      });
      dock.classList.toggle("is-on", !hide.fv && !hide.final);
    });
    io.observe(fv);
    io.observe(qs(".final"));
  }

  runCount();
  if (renderClock()) {
    var timer = setInterval(function () { if (!renderClock()) clearInterval(timer); }, 1000);
  }
  setupWall();
  setupRate();
  setupCalc();
  renderPoints();
  setupDock();
})();

(function () {
  "use strict";

  // ==== 案件設定 ====
  // BASE_RATE: 「いつも」のポイント倍率。グラフと「いつもの◯倍」の表記に反映される。
  // この商品は通常2倍で設定済み(2025-10-28〜)。
  var BASE_RATE = 2;
  var CAMPAIGN_RATE = 20; // 楽天スーパーDEALの還元率(通常1倍分を含む・店舗ポイントとは併用なし)
  var TAX_RATE = 1.08; // DEALのポイントは税抜価格が基準
  var START = new Date("2026-11-22T00:00:00+09:00").getTime();
  var END = new Date("2026-11-23T00:00:00+09:00").getTime();
  var SIZES = [
    { cups: 80, label: "400g×2袋", price: 2788 },
    { cups: 100, label: "500g×2袋", price: 3288 },
    { cups: 160, label: "400g×4袋", price: 5188, popular: true },
    { cups: 200, label: "500g×4袋", price: 6288 },
    { cups: 300, label: "500g×6袋", price: 8888 }
  ];
  var MIN_DAYS = 30; // おすすめは「1か月以上もつ最小サイズ」
  var WALL_WORDS = 170;
  var COUNT_MS = 1500;

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

  /* ---- FV: カウント→20倍→紙吹雪 ---- */
  function runConfetti() {
    var canvas = qs(".fv-confetti");
    var ctx = canvas.getContext && canvas.getContext("2d");
    if (!ctx) return;
    var rect = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    var colors = ["#f2cb6c", "#fff3d0", "#c8962e", "#ffffff"];
    var parts = Array.from({ length: 110 }, function () {
      return {
        x: rect.width * (0.15 + Math.random() * 0.7),
        y: rect.height * 0.55,
        vx: (Math.random() - 0.5) * 9,
        vy: -6 - Math.random() * 9,
        s: 5 + Math.random() * 6,
        r: Math.random() * 6,
        vr: (Math.random() - 0.5) * 0.3,
        c: colors[Math.floor(Math.random() * colors.length)]
      };
    });
    var start = performance.now();
    (function tick(t) {
      var life = (t - start) / 2400;
      ctx.clearRect(0, 0, rect.width, rect.height);
      if (life >= 1) return;
      ctx.globalAlpha = Math.min(1, (1 - life) * 2);
      parts.forEach(function (p) {
        p.vy += 0.22; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66);
        ctx.restore();
      });
      requestAnimationFrame(tick);
    })(start);
  }

  function runHero() {
    var el = qs("[data-count]");
    var big = qs(".fv-title-big");
    var target = Number(el.dataset.count);
    if (reduced) return;
    document.documentElement.classList.add("is-animating");
    var start = performance.now();
    (function tick(t) {
      var p = Math.min(1, (t - start) / COUNT_MS);
      var eased = 1 - Math.pow(1 - p, 4);
      el.textContent = yen(Math.round(target * eased));
      if (p < 1) { requestAnimationFrame(tick); return; }
      big.classList.add("is-in");
      setTimeout(runConfetti, 180);
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
      qsa("[data-cta]").forEach(function (b) {
        if (!b.querySelector("img")) b.textContent = "商品ページを見る";
        b.classList.add("is-off");
      });
      return false;
    }
    if (now < START) {
      var left = START - now;
      var d = Math.floor(left / 864e5);
      var h = Math.floor(left / 36e5) % 24;
      var m = Math.floor(left / 6e4) % 60;
      label.textContent = "開始まで";
      html = "あと" + unit(d, "日") + unit(h, "時間") + unit(m, "分");
    } else {
      var rest = END - now;
      label.textContent = "終了まで";
      html = "あと" + unit(Math.floor(rest / 36e5), "時間") + unit(pad(Math.floor(rest / 6e4) % 60), "分") + unit(pad(Math.floor(rest / 1e3) % 60), "秒");
    }
    clocks.forEach(function (c) { c.innerHTML = html; });
    return true;
  }

  /* ---- 倍率ジャンプ(スクロール連動・グラフは実倍率どおりの縮尺) ---- */
  function setupJump() {
    var section = qs("[data-jump]");
    var bar = qs("[data-jump-bar]");
    var num = qs("[data-jump-num]");
    var end = qs("[data-jump-end]");
    var baseRatio = BASE_RATE / CAMPAIGN_RATE;
    section.style.setProperty("--base", baseRatio);
    qs("[data-jump-mult]").textContent = CAMPAIGN_RATE / BASE_RATE;

    function paint(p) {
      var eased = p * p * (3 - 2 * p);
      var rate = BASE_RATE + (CAMPAIGN_RATE - BASE_RATE) * eased;
      bar.style.setProperty("--h", rate / CAMPAIGN_RATE);
      num.textContent = Math.round(rate);
      end.classList.toggle("is-on", p >= 0.96);
    }
    if (reduced) { paint(1); return; }

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        var r = section.getBoundingClientRect();
        var run = r.height - window.innerHeight;
        var p = Math.max(0, Math.min(1, (-r.top - run * 0.08) / (run * 0.78)));
        paint(p);
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---- 「おいしい」の壁 ---- */
  function setupWall() {
    var wall = qs("[data-wall]");
    var sizes = [15, 19, 24, 31, 42, 56];
    var frag = document.createDocumentFragment();
    var spans = Array.from({ length: WALL_WORDS }, function (_, i) {
      var s = document.createElement("span");
      s.textContent = "おいしい";
      s.style.fontSize = sizes[(i * 7 + (i % 5) * 3) % sizes.length] + "px";
      frag.appendChild(s);
      return s;
    });
    wall.appendChild(frag);

    if (reduced || !("IntersectionObserver" in window)) {
      spans.forEach(function (s) { s.classList.add("is-lit"); });
      return;
    }
    var order = spans.map(function (s, i) { return (i * 37) % spans.length; });
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      order.forEach(function (idx, n) {
        setTimeout(function () { spans[idx].classList.add("is-lit"); }, n * 12);
      });
    }, { threshold: 0.3 });
    io.observe(wall);
  }

  /* ---- 何杯 計算 ---- */
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
    var dock = qs("[data-dock]");
    var fv = qs(".fv");
    var finalSec = qs(".final");
    if (!("IntersectionObserver" in window)) return;
    var hide = { fv: true, final: false };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.target === fv) hide = Object.assign({}, hide, { fv: e.isIntersecting });
        else hide = Object.assign({}, hide, { final: e.isIntersecting });
      });
      dock.classList.toggle("is-on", !hide.fv && !hide.final);
    });
    io.observe(fv);
    io.observe(finalSec);
  }

  runHero();
  if (renderClock()) {
    var timer = setInterval(function () { if (!renderClock()) clearInterval(timer); }, 1000);
  }
  setupJump();
  setupWall();
  setupCalc();
  renderPoints();
  setupDock();
})();

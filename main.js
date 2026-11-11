(function () {
  "use strict";

  // ==== 案件設定 ====
  var CAMPAIGN_RATE = 20; // 楽天スーパーDEALの還元率(通常1倍分を含む・店舗ポイントとは併用なし)
  var TAX_RATE = 1.08; // DEALのポイントは税抜価格が基準
  // 開催日。変更になったらここだけ書き換える(ページ内の日付・曜日・カウントダウンに反映される)
  var DEAL_DATE = "2026-11-23";
  var START = new Date(DEAL_DATE + "T00:00:00+09:00").getTime();
  var END = START + 864e5;
  var SIZES = [
    { cups: 80, price: 2788 },
    { cups: 100, price: 3288 },
    { cups: 160, price: 5188, popular: true },
    { cups: 200, price: 6288 },
    { cups: 300, price: 8888 }
  ];
  var MIN_DAYS = 30; // おすすめは「1か月以上もつ最小サイズ」
  var COUNT_MS = 1400;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasIO = "IntersectionObserver" in window;
  var qs = function (s) { return document.querySelector(s); };
  var qsa = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var yen = function (n) { return n.toLocaleString("ja-JP"); };

  // 確認用: ?now=2026-11-23T12:00:00%2B09:00 で開催中の表示を確認できる
  var fixedNow = (function () {
    var v = new URLSearchParams(location.search).get("now");
    var t = v ? new Date(v).getTime() : NaN;
    return isNaN(t) ? null : t;
  })();
  var nowMs = function () { return fixedNow === null ? Date.now() : fixedNow; };

  /* ---- 電球の縁取り(看板の大きさに合わせる) ---- */
  function sizeBulbs() {
    var sign = qs("[data-sign]");
    var r = sign.getBoundingClientRect();
    if (r.width < 20) return;
    var svg = sign.querySelector(".bulbs");
    svg.setAttribute("viewBox", "0 0 " + r.width + " " + r.height);
    Array.prototype.forEach.call(svg.querySelectorAll("rect"), function (el) {
      el.setAttribute("x", 7); el.setAttribute("y", 7);
      el.setAttribute("width", r.width - 14); el.setAttribute("height", r.height - 14);
      el.setAttribute("rx", 14);
    });
  }

  /* ---- 看板のレビュー件数カウント ---- */
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

  /* ---- カウントダウン(FV・左レール・締めの3か所) ---- */
  function pad(n) { return String(n).padStart(2, "0"); }
  function unit(n, u) { return n + "<small>" + u + "</small>"; }

  function renderClock() {
    var now = nowMs();
    var labels = qsa("[data-clock-label]");
    var clocks = qsa("[data-clock]");
    var label;
    var html;
    if (now >= END) {
      labels.forEach(function (l) { l.textContent = "本企画は終了しました"; });
      clocks.forEach(function (c) { c.hidden = true; });
      qsa(".btn[data-cta]").forEach(function (b) { b.textContent = "商品ページを見る"; b.classList.add("is-off"); });
      return false;
    }
    if (now < START) {
      var left = START - now;
      label = "開始まで";
      html = unit(Math.floor(left / 864e5), "日") + unit(pad(Math.floor(left / 36e5) % 24), "時間") + unit(pad(Math.floor(left / 6e4) % 60), "分") + unit(pad(Math.floor(left / 1e3) % 60), "秒");
    } else {
      var rest = END - now;
      label = "終了まで";
      html = unit(pad(Math.floor(rest / 36e5)), "時間") + unit(pad(Math.floor(rest / 6e4) % 60), "分") + unit(pad(Math.floor(rest / 1e3) % 60), "秒");
    }
    labels.forEach(function (l) { l.textContent = label; });
    clocks.forEach(function (c) { c.innerHTML = html; });
    return true;
  }

  /* ---- 登場 ---- */
  function setupReveal() {
    var els = qsa(".rv");
    if (reduced || !hasIO) { els.forEach(function (e) { e.classList.add("in"); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        io.unobserve(e.target);
      });
    }, { threshold: 0.15 });
    els.forEach(function (e) { io.observe(e); });
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

  /* ---- いま見ている場所をメニューで光らせる ---- */
  function setupHere() {
    if (!hasIO) return;
    var links = qsa("[data-nav] a, [data-tabbar] a");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var hash = "#" + e.target.id;
        links.forEach(function (a) { a.classList.toggle("is-here", a.getAttribute("href") === hash); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    ["deal", "thanks", "blends", "history", "size"].forEach(function (id) { io.observe(document.getElementById(id)); });
  }

  /* ---- 開催日の日付・曜日をページに入れる ---- */
  function renderDealDate() {
    var day = String(Number(DEAL_DATE.slice(8, 10)));
    var dow = "日月火水木金土".charAt(new Date(DEAL_DATE + "T00:00:00Z").getUTCDay());
    qsa("[data-day]").forEach(function (el) { el.textContent = day; });
    qsa("[data-dow]").forEach(function (el) { el.textContent = dow; });
  }

  renderDealDate();
  sizeBulbs();
  window.addEventListener("resize", sizeBulbs);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizeBulbs);
  runCount();
  if (renderClock()) {
    var timer = setInterval(function () { if (!renderClock()) clearInterval(timer); }, 1000);
  }
  setupReveal();
  setupCalc();
  renderPoints();
  setupHere();
})();

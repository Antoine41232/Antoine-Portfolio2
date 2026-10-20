/* Antoine Soler-Mores — interactions */
(() => {
  const root = document.documentElement;
  document.body.classList.add("js");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- thème jour / nuit ---------- */
  let theme = "light";
  try { theme = localStorage.getItem("asm-theme") || "light"; } catch {}
  const applyTheme = (t) => {
    theme = t;
    root.setAttribute("data-theme", t);
    try { localStorage.setItem("asm-theme", t); } catch {}
  };
  applyTheme(theme);
  document.querySelectorAll("#themeToggle").forEach((b) =>
    b.addEventListener("click", () => applyTheme(theme === "light" ? "dark" : "light"))
  );

  /* ---------- curseur sur mesure ---------- */
  const fine = matchMedia("(pointer: fine)").matches;
  if (fine && !reduce) {
    const dot = document.createElement("div");
    const ring = document.createElement("div");
    dot.className = "cur-dot"; ring.className = "cur-ring";
    document.body.append(dot, ring);
    document.body.classList.add("has-cur");
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    addEventListener("mousemove", (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
    }, { passive: true });
    (function loop() {
      rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
      ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
      requestAnimationFrame(loop);
    })();
    document.querySelectorAll("a, button, .card, .cert").forEach((el) => {
      el.addEventListener("mouseenter", () => ring.classList.add("big"));
      el.addEventListener("mouseleave", () => ring.classList.remove("big"));
    });
  }

  /* ---------- l'œil (signature) ---------- */
  const eye = document.getElementById("eyeSvg");
  if (eye) {
    const iris = eye.querySelector(".irisG");
    const g = eye.getBoundingClientRect();
    let tx = 0, ty = 0, cx = 0, cy = 0;
    const MAX = 7;
    addEventListener("mousemove", (e) => {
      const r = eye.getBoundingClientRect();
      const ex = r.left + r.width / 2, ey = r.top + r.height / 2;
      const dx = e.clientX - ex, dy = e.clientY - ey;
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 260);
      tx = (dx / d) * MAX * k; ty = (dy / d) * MAX * 0.75 * k;
    }, { passive: true });
    /* le suivi du curseur est doux (7 px) : il reste actif même en mode « réduire les animations » ;
       seul le clignement, plus surprenant, respecte ce réglage */
    (function loop() {
      cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12;
      iris.setAttribute("transform", `translate(${cx.toFixed(2)} ${cy.toFixed(2)})`);
      requestAnimationFrame(loop);
    })();
    if (!reduce) {
      /* clignement discret */
      const gEl = eye.querySelector("#eyeG");
      const blink = () => {
        gEl.style.transform = "scaleY(.08)";
        setTimeout(() => { gEl.style.transform = "scaleY(1)"; }, 130);
        setTimeout(blink, 3800 + Math.random() * 3200);
      };
      setTimeout(blink, 2600);
    }
  }

  /* ---------- apparition au défilement ---------- */
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.14, rootMargin: "0px 0px -6% 0px" });
  document.querySelectorAll(".rv").forEach((el) => io.observe(el));

  /* ---------- horloge de Paris ---------- */
  const clock = document.getElementById("clock");
  if (clock) {
    const fmt = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit",
    });
    const tick = () => { clock.textContent = "Marseille · " + fmt.format(new Date()); };
    tick(); setInterval(tick, 30000);
  }

  /* ---------- copie e-mail ---------- */
  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const txt = btn.getAttribute("data-copy");
      let ok = false;
      try { await navigator.clipboard.writeText(txt); ok = true; }
      catch {
        const ta = document.createElement("textarea");
        ta.value = txt; document.body.appendChild(ta); ta.select();
        try { ok = document.execCommand("copy"); } catch {}
        ta.remove();
      }
      const old = btn.textContent;
      btn.textContent = ok ? "copié ✓" : "copier";
      setTimeout(() => { btn.textContent = old; }, 1800);
    });
  });

  /* ---------- aperçu de documents (modale) ---------- */
  const modal = document.getElementById("docModal");
  if (modal) {
    const mTitle = document.getElementById("dmTitle");
    const mDl = document.getElementById("dmDl");
    const mPages = document.getElementById("dmPages");
    const mImg = document.getElementById("dmImg");
    let manifestP = null;
    const getManifest = () => {
      if (!manifestP) {
        manifestP = fetch("assets/pages/pages.json").then((r) => r.json()).catch(() => ({}));
      }
      return manifestP;
    };
    const buildPages = async (src) => {
      const slug = src.split("/").pop().replace(/\.pdf$/i, "");
      const mani = await getManifest();
      const info = mani[slug];
      mPages.innerHTML = "";
      if (!info) {
        const p = document.createElement("p");
        p.className = "dm-end";
        p.textContent = "Aperçu indisponible — utilisez le bouton télécharger.";
        mPages.appendChild(p);
        return;
      }
      for (let i = 1; i <= info.preview; i++) {
        const im = document.createElement("img");
        im.src = `assets/pages/${slug}-p${i}.jpg`;
        im.alt = `page ${i} du document`;
        im.decoding = "async";
        if (i <= 2) { im.loading = "eager"; im.fetchPriority = "high"; }
        else im.loading = "lazy";
        mPages.appendChild(im);
      }
      if (info.total > 1) {
        const p = document.createElement("p");
        p.className = "dm-end";
        p.textContent = `document complet — ${info.total} pages · cliquez sur une page pour l'agrandir, ou « télécharger » ci-dessus`;
        mPages.appendChild(p);
      }
    };
    const open = (src, kind, title) => {
      mTitle.textContent = title;
      mDl.setAttribute("href", src);
      mDl.setAttribute("download", src.split("/").pop());
      if (kind === "img") {
        mPages.hidden = true; mPages.innerHTML = "";
        mImg.hidden = false; mImg.setAttribute("src", src);
      } else {
        mImg.hidden = true; mImg.removeAttribute("src");
        mPages.hidden = false;
        buildPages(src);
      }
      modal.hidden = false;
      document.body.classList.add("dm-open");
    };
    const close = () => {
      modal.classList.remove("dm-full");
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      modal.hidden = true;
      document.body.classList.remove("dm-open");
      mPages.innerHTML = "";
      mImg.removeAttribute("src");
    };
    document.querySelectorAll("[data-doc]").forEach((el) => {
      el.addEventListener("click", () =>
        open(el.getAttribute("data-doc"), el.getAttribute("data-kind") || "pdf", el.getAttribute("data-title") || "document")
      );
    });
    modal.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", close));
    /* bouton grand écran : plein écran natif si possible, sinon agrandissement CSS (iframes, iOS) */
    const mFs = document.getElementById("dmFs");
    const dmBox = modal.querySelector(".dm-box");
    const exitFs = () => {
      modal.classList.remove("dm-full");
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
    if (mFs && dmBox) {
      mFs.addEventListener("click", () => {
        if (modal.classList.contains("dm-full") || document.fullscreenElement) {
          exitFs();
          return;
        }
        if (dmBox.requestFullscreen) {
          dmBox.requestFullscreen().catch(() => modal.classList.add("dm-full"));
        } else {
          modal.classList.add("dm-full");
        }
      });
      document.addEventListener("fullscreenchange", () => {
        if (!document.fullscreenElement) modal.classList.remove("dm-full");
      });
    }

    /* précharge la 1re page au survol d'une carte — l'aperçu s'ouvre instantanément */
    const preloaded = new Set();
    document.querySelectorAll('[data-doc$=".pdf"]').forEach((el) => {
      el.addEventListener("pointerenter", () => {
        const slug = el.getAttribute("data-doc").split("/").pop().replace(/\.pdf$/i, "");
        if (preloaded.has(slug)) return;
        preloaded.add(slug);
        for (const i of [1, 2]) {
          const im = new Image();
          im.src = `assets/pages/${slug}-p${i}.jpg`;
        }
      }, { once: true });
    });

    /* zoom plein écran sur une page */
    const pz = document.getElementById("pageZoom");
    const pzImg = document.getElementById("pzImg");
    const closeZoom = () => { if (pz) { pz.hidden = true; pzImg.removeAttribute("src"); } };
    if (pz && pzImg) {
      mPages.addEventListener("click", (e) => {
        if (e.target.tagName !== "IMG") return;
        pzImg.src = e.target.src;
        pz.hidden = false;
      });
      pz.addEventListener("click", closeZoom);
    }
    addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (pz && !pz.hidden) closeZoom();
      else if (modal.classList.contains("dm-full")) exitFs();
      else if (!modal.hidden) close();
    });
  }

  /* ---------- menu mobile ---------- */
  const navToggle = document.getElementById("navToggle");
  if (navToggle) {
    const setNav = (open) => {
      document.body.classList.toggle("nav-open", open);
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.setAttribute("aria-label", open ? "fermer le menu" : "ouvrir le menu");
    };
    navToggle.addEventListener("click", () =>
      setNav(!document.body.classList.contains("nav-open"))
    );
    document.querySelectorAll('#mainnav a[href^="#"]').forEach((a) =>
      a.addEventListener("click", () => setNav(false))
    );
    addEventListener("keydown", (e) => { if (e.key === "Escape") setNav(false); });
    addEventListener("resize", () => { if (innerWidth > 940) setNav(false); });
  }

  /* ---------- scrollspy léger ---------- */
  const navLinks = [...document.querySelectorAll('#mainnav a[href^="#"]')];
  const secs = navLinks
    .map((a) => document.getElementById(a.getAttribute("href").slice(1)))
    .filter(Boolean);
  if (navLinks.length && secs.length) {
    const spy = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        navLinks.forEach((a) =>
          a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id)
        );
      });
    }, { rootMargin: "-30% 0px -55% 0px" });
    secs.forEach((s) => spy.observe(s));
  }

  /* ---------- flux RSS en direct (CERT-FR) ---------- */
  const live = document.getElementById("liveJournal");
  if (live) {
    const FEED = "https://www.cert.ssi.gouv.fr/feed/";
    const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const strip = (h) => {
      const t = document.createElement("div");
      t.innerHTML = h || "";
      const txt = (t.textContent || "").trim();
      return txt.length > 240 ? txt.slice(0, 240).trimEnd() + "…" : txt;
    };
    const fmtDate = (d) => {
      try {
        return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));
      } catch { return ""; }
    };
    const render = (items) => {
      live.innerHTML = "";
      items.sort((a, b) => new Date(b.date) - new Date(a.date));
      items.slice(0, 5).forEach((it) => {
        const row = document.createElement("div");
        row.className = "jrow";
        const safe = /^(https?:)?\/\//.test(it.link) ? it.link : "https://www.cert.ssi.gouv.fr";
        row.innerHTML =
          `<span class="jdate">${esc(fmtDate(it.date))}</span>` +
          `<span class="jtag t">cert-fr</span>` +
          `<div class="jbody"><b>${esc(it.title)}</b><p>${esc(it.desc)}</p></div>` +
          `<span class="jsrc">source : <a href="${esc(safe)}" target="_blank" rel="noopener">lire l'avis complet</a></span>`;
        live.appendChild(row);
      });
    };
    const fail = () => {
      live.innerHTML =
        `<div class="jrow">` +
        `<span class="jdate">hors-ligne</span>` +
        `<span class="jtag t">cert-fr</span>` +
        `<div class="jbody"><b>Flux momentanément indisponible</b>` +
        `<p>Le flux RSS n'a pas pu être chargé cette fois-ci — il se reconnecte à chaque visite. Le journal ci-dessous reste consultable.</p></div>` +
        `<span class="jsrc">source : <a href="https://www.cert.ssi.gouv.fr" target="_blank" rel="noopener">cert.ssi.gouv.fr</a></span>` +
        `</div>`;
    };
    const viaRss2Json = fetch("https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(FEED))
      .then((r) => r.json())
      .then((j) => {
        if (j.status !== "ok" || !j.items || !j.items.length) throw new Error("rss2json");
        return j.items.map((i) => ({ title: i.title, link: i.link, date: i.pubDate, desc: strip(i.description) }));
      });
    const viaAllOrigins = fetch("https://api.allorigins.win/raw?url=" + encodeURIComponent(FEED))
      .then((r) => r.text())
      .then((x) => {
        const doc = new DOMParser().parseFromString(x, "text/xml");
        const items = [...doc.querySelectorAll("item")];
        if (!items.length) throw new Error("allorigins");
        return items.map((it) => ({
          title: it.querySelector("title")?.textContent || "",
          link: it.querySelector("link")?.textContent || "",
          date: it.querySelector("pubDate")?.textContent || "",
          desc: strip(it.querySelector("description")?.textContent || ""),
        }));
      });
    viaRss2Json.catch(() => viaAllOrigins).then(render).catch(fail);
  }
})();

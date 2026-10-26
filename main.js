/* Antoine Soler-Mores — interactions */
(() => {
  const root = document.documentElement;
  document.body.classList.add("js");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- préloader : retrait une fois le rideau levé ---------- */
  const loader = document.getElementById("loader");
  if (loader) {
    if (reduce) loader.hidden = true;
    else setTimeout(() => { loader.hidden = true; }, 2400);
  }

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
    let tx = 0, ty = 0, cx = 0, cy = 0;
    let eyeFocus = false; /* mode relevé : l'œil se fige au centre pour les mesures */
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
      const gx = eyeFocus ? 0 : tx, gy = eyeFocus ? 0 : ty;
      cx += (gx - cx) * 0.12; cy += (gy - cy) * 0.12;
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
    /* relevé technique : un appui sur le cadre fige l'œil et affiche les mesures */
    const figFrame = document.getElementById("figFrame");
    if (figFrame) {
      const figHint = document.getElementById("figHint");
      const figState = document.getElementById("figState");
      const setFocus = (on) => {
        eyeFocus = on;
        figFrame.classList.toggle("focus", on);
        figFrame.setAttribute("aria-expanded", on ? "true" : "false");
        if (figHint) figHint.textContent = on ? "appuyer · fermer" : "appuyer · détails";
        if (figState) figState.textContent = on ? "relevé figé" : "suit le curseur";
      };
      figFrame.addEventListener("click", () => setFocus(!eyeFocus));
      figFrame.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFocus(!eyeFocus); }
      });
      addEventListener("keydown", (e) => { if (e.key === "Escape" && eyeFocus) setFocus(false); });
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

  /* ---------- lecteur de documents : vignettes, pages et zoom ---------- */
  const modal = document.getElementById("docModal");
  if (modal) {
    const mTitle = document.getElementById("dmTitle");
    const mDl = document.getElementById("dmDl");
    const mReader = document.getElementById("dmReader");
    const mPages = document.getElementById("dmPages");
    const mStage = document.getElementById("dmStage");
    const mImg = document.getElementById("dmImg");
    const mFoot = document.getElementById("dmFoot");
    const mPrev = document.getElementById("dmPrev");
    const mNext = document.getElementById("dmNext");
    const mPageForm = document.getElementById("dmPageForm");
    const mPageInput = document.getElementById("dmPageInput");
    const mPageTotal = document.getElementById("dmPageTotal");
    const dmBox = modal.querySelector(".dm-box");
    let manifestP = null;
    let docLastFocus = null;
    let zoomLastFocus = null;
    let loadToken = 0;
    let reader = { slug: "", total: 0, page: 1 };

    const getManifest = () => {
      if (!manifestP) {
        manifestP = fetch("assets/pages/pages.json")
          .then((r) => { if (!r.ok) throw new Error("manifest"); return r.json(); })
          .catch(() => ({}));
      }
      return manifestP;
    };

    const syncPage = (requested) => {
      if (!reader.total) return;
      const page = Math.max(1, Math.min(reader.total, Number(requested) || 1));
      const changed = reader.page !== page;
      reader.page = page;
      mPageInput.value = String(page);
      mPageInput.max = String(reader.total);
      mPageTotal.textContent = String(reader.total);
      mPrev.disabled = page <= 1;
      mNext.disabled = page >= reader.total;
      let activeThumb = null;
      mPages.querySelectorAll("[data-page-thumb]").forEach((thumb) => {
        const thumbPage = Number(thumb.getAttribute("data-page-thumb"));
        const on = thumbPage === page;
        if (Math.abs(thumbPage - page) <= 3) thumb.querySelector("img").loading = "eager";
        thumb.classList.toggle("on", on);
        if (on) {
          thumb.setAttribute("aria-current", "page");
          activeThumb = thumb;
        } else thumb.removeAttribute("aria-current");
      });
      mStage.querySelectorAll("[data-page-sheet]").forEach((sheet) => {
        const sheetPage = Number(sheet.getAttribute("data-page-sheet"));
        if (Math.abs(sheetPage - page) <= 2) sheet.querySelector("img").loading = "eager";
        sheet.querySelector("button").tabIndex = sheetPage === page ? 0 : -1;
      });
      if (activeThumb && changed) {
        requestAnimationFrame(() => {
          if (reader.page !== page) return;
          const box = mPages.getBoundingClientRect();
          const rect = activeThumb.getBoundingClientRect();
          if (mPages.scrollHeight > mPages.clientHeight) {
            mPages.scrollTop += rect.top - box.top - (box.height - rect.height) / 2;
          }
          if (mPages.scrollWidth > mPages.clientWidth) {
            mPages.scrollLeft += rect.left - box.left - (box.width - rect.width) / 2;
          }
        });
      }
    };

    const showPage = (requested) => {
      if (!reader.total) return;
      const page = Math.max(1, Math.min(reader.total, Number(requested) || 1));
      syncPage(page);
      requestAnimationFrame(() => {
        if (reader.page !== page) return;
        mStage.scrollTop = (page - 1) * mStage.clientHeight;
        syncPage(page);
      });
    };

    let stageTick = false;
    mStage.addEventListener("scroll", () => {
      if (stageTick || !reader.total || !mStage.clientHeight) return;
      stageTick = true;
      requestAnimationFrame(() => {
        stageTick = false;
        const page = Math.round(mStage.scrollTop / mStage.clientHeight) + 1;
        syncPage(page);
      });
    }, { passive: true });

    const buildPages = async (src, startPage, withMorph) => {
      const slug = src.split("/").pop().replace(/\.pdf$/i, "");
      const token = ++loadToken;
      reader = { slug: "", total: 0, page: 1 };
      mPages.innerHTML = "";
      mStage.innerHTML = '<p class="dm-loading">ouverture du dossier…</p>';
      mStage.scrollTop = 0;
      mFoot.hidden = true;
      const mani = await getManifest();
      if (token !== loadToken) return;
      const info = mani[slug];
      mStage.innerHTML = "";
      if (!info || !info.preview) {
        const p = document.createElement("p");
        p.className = "dm-end";
        p.textContent = "Aperçu indisponible — utilisez le bouton télécharger.";
        mStage.appendChild(p);
        return;
      }
      const firstPage = Math.max(1, Math.min(info.preview, Number(startPage) || 1));
      reader = { slug, total: info.preview, page: 0 };
      let firstImage = null;
      for (let i = 1; i <= info.preview; i++) {
        const thumb = document.createElement("button");
        thumb.type = "button";
        thumb.className = "dm-thumb";
        thumb.setAttribute("data-page-thumb", String(i));
        thumb.setAttribute("aria-label", `Afficher la page ${i}`);
        const thumbImg = document.createElement("img");
        thumbImg.src = `assets/thumbs/${slug}-p${i}.jpg`;
        thumbImg.alt = "";
        thumbImg.decoding = "async";
        thumbImg.loading = Math.abs(i - firstPage) <= 3 ? "eager" : "lazy";
        const label = document.createElement("span");
        label.textContent = `P. ${String(i).padStart(2, "0")}`;
        thumb.appendChild(thumbImg);
        thumb.appendChild(label);
        mPages.appendChild(thumb);

        const sheet = document.createElement("div");
        sheet.className = "dm-sheet";
        sheet.setAttribute("data-page-sheet", String(i));
        const pageButton = document.createElement("button");
        pageButton.type = "button";
        pageButton.className = "dm-page-button";
        pageButton.setAttribute("data-page-zoom", String(i));
        pageButton.setAttribute("aria-label", `Agrandir la page ${i}`);
        pageButton.tabIndex = i === firstPage ? 0 : -1;
        const pageImg = document.createElement("img");
        pageImg.alt = `Page ${i} sur ${info.preview} — ${mTitle.textContent}`;
        pageImg.decoding = "async";
        pageImg.loading = Math.abs(i - firstPage) <= 1 ? "eager" : "lazy";
        if (withMorph && i === firstPage) {
          firstImage = pageImg;
          pageImg.classList.add("dm-morph-target");
        }
        pageImg.addEventListener("load", () => pageImg.classList.add("is-ready"));
        pageImg.src = `assets/pages/${slug}-p${i}.jpg`;
        pageButton.appendChild(pageImg);
        sheet.appendChild(pageButton);
        mStage.appendChild(sheet);
      }
      mFoot.hidden = info.preview <= 1;
      showPage(firstPage);
      return { image: firstImage, token };
    };

    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

    /* La vraie vignette rejoint la page demandée : le mouvement n'attend pas le HD. */
    const morphIntoReader = async (building, origin) => {
      const clone = document.createElement("img");
      clone.className = "dm-morph";
      clone.src = origin.src;
      clone.alt = "";
      clone.setAttribute("aria-hidden", "true");
      clone.style.top = origin.rect.top + "px";
      clone.style.left = origin.rect.left + "px";
      clone.style.width = origin.rect.width + "px";
      clone.style.height = origin.rect.height + "px";
      clone.style.objectFit = origin.objectFit;
      clone.style.objectPosition = origin.objectPosition;
      document.body.appendChild(clone);

      const result = await building;
      if (!result || result.token !== loadToken || modal.hidden || !result.image) {
        clone.remove();
        return;
      }
      const target = result.image;
      let finished = false;
      let moved = false;
      let ready = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        if (target.isConnected) target.classList.remove("dm-morph-target");
        clone.style.opacity = "0";
        setTimeout(() => clone.remove(), 150);
      };
      const maybeFinish = () => { if (moved && ready) finish(); };
      const markMoved = () => { moved = true; maybeFinish(); };
      const markReady = () => {
        if (ready || finished) return;
        ready = true;
        maybeFinish();
      };
      const onReady = () => {
        if (target.decode) target.decode().catch(() => {}).then(markReady);
        else markReady();
      };
      try {
        /* Deux frames suffisent pour poser la modale et mesurer son cadre. */
        await nextFrame();
        await nextFrame();
        if (result.token !== loadToken || modal.hidden || !target.isConnected) { finish(); return; }
        const frame = target.parentElement.getBoundingClientRect();
        const ratio = origin.ratio || (target.naturalWidth / target.naturalHeight);
        if (!frame.width || !frame.height || !ratio) { finish(); return; }
        const width = Math.min(frame.width, frame.height * ratio);
        const height = width / ratio;
        const end = {
          left: frame.left + (frame.width - width) / 2,
          top: frame.top + (frame.height - height) / 2,
          width, height
        };
        clone.style.top = end.top + "px";
        clone.style.left = end.left + "px";
        clone.style.width = end.width + "px";
        clone.style.height = end.height + "px";
        clone.style.objectFit = "contain";
        clone.style.objectPosition = "center";
        clone.style.transform = `translate(${origin.rect.left - end.left}px,${origin.rect.top - end.top}px) scale(${origin.rect.width / end.width},${origin.rect.height / end.height})`;

        if (target.complete) onReady();
        else {
          target.addEventListener("load", onReady, { once: true });
          target.addEventListener("error", markReady, { once: true });
        }
        clone.addEventListener("transitionend", (e) => {
          if (e.propertyName === "transform") markMoved();
        });
        clone.getBoundingClientRect();
        await nextFrame();
        if (result.token !== loadToken || modal.hidden || !target.isConnected) { finish(); return; }
        clone.style.transform = "translate(0,0) scale(1,1)";
        setTimeout(markMoved, 360);
        setTimeout(finish, 5000);
      } catch { finish(); }
    };

    const open = (src, kind, title, startPage, originImg) => {
      docLastFocus = document.activeElement;
      document.querySelectorAll(".dm-morph").forEach((el) => el.remove());
      let origin = null;
      if (!reduce && kind === "pdf" && originImg) {
        const rect = originImg.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const style = getComputedStyle(originImg);
          origin = {
            src: originImg.currentSrc || originImg.src,
            rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
            ratio: originImg.naturalWidth > 0 && originImg.naturalHeight > 0 ? originImg.naturalWidth / originImg.naturalHeight : rect.width / rect.height,
            objectFit: style.objectFit,
            objectPosition: style.objectPosition
          };
        }
      }
      mTitle.textContent = title;
      mDl.setAttribute("href", src);
      mDl.setAttribute("download", src.split("/").pop());
      if (kind === "img") {
        ++loadToken;
        mReader.hidden = true;
        mFoot.hidden = true;
        mPages.innerHTML = "";
        mStage.innerHTML = "";
        mImg.hidden = false;
        mImg.setAttribute("src", src);
      } else {
        mImg.hidden = true;
        mImg.removeAttribute("src");
        mReader.hidden = false;
        var building = buildPages(src, startPage, Boolean(origin));
      }
      modal.hidden = false;
      document.body.classList.add("dm-open");
      if (origin && building) morphIntoReader(building, origin);
      const closeBtn = modal.querySelector(".dm-x");
      if (closeBtn) closeBtn.focus();
    };

    const close = () => {
      ++loadToken;
      modal.classList.remove("dm-full");
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      modal.hidden = true;
      document.body.classList.remove("dm-open");
      document.querySelectorAll(".dm-morph").forEach((el) => el.remove());
      mPages.innerHTML = "";
      mStage.innerHTML = "";
      mStage.scrollTop = 0;
      mImg.removeAttribute("src");
      reader = { slug: "", total: 0, page: 1 };
      if (docLastFocus && docLastFocus.isConnected) docLastFocus.focus();
    };

    document.querySelectorAll("[data-doc]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        open(
          el.getAttribute("data-doc"),
          el.getAttribute("data-kind") || "pdf",
          el.getAttribute("data-title") || "document",
          Number(el.getAttribute("data-page")) || 1,
          el.querySelector("img")
        );
      });
    });
    modal.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", close));
    mPages.addEventListener("click", (e) => {
      const thumb = e.target.closest("[data-page-thumb]");
      if (thumb) showPage(Number(thumb.getAttribute("data-page-thumb")));
    });
    mPrev.addEventListener("click", () => showPage(reader.page - 1));
    mNext.addEventListener("click", () => showPage(reader.page + 1));
    mPageForm.addEventListener("submit", (e) => {
      e.preventDefault();
      showPage(Number(mPageInput.value));
    });
    mPageInput.addEventListener("change", () => showPage(Number(mPageInput.value)));

    /* bouton grand écran : plein écran natif si possible, sinon agrandissement CSS (iframes, iOS) */
    const mFs = document.getElementById("dmFs");
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
        } else modal.classList.add("dm-full");
      });
      document.addEventListener("fullscreenchange", () => {
        if (!document.fullscreenElement) modal.classList.remove("dm-full");
      });
    }

    /* zoom plein écran sur la page courante */
    const pz = document.getElementById("pageZoom");
    const pzImg = document.getElementById("pzImg");
    const closeZoom = () => {
      if (!pz || pz.hidden) return;
      pz.hidden = true;
      pzImg.removeAttribute("src");
      if (zoomLastFocus && zoomLastFocus.isConnected) zoomLastFocus.focus();
    };
    if (pz && pzImg && mStage) {
      mStage.addEventListener("click", (e) => {
        const button = e.target.closest("[data-page-zoom]");
        if (!button) return;
        const image = button.querySelector("img");
        if (!image || !image.getAttribute("src")) return;
        zoomLastFocus = button;
        pzImg.src = image.currentSrc || image.src;
        pzImg.alt = image.alt;
        pz.hidden = false;
        pz.querySelector(".pz-x").focus();
      });
      pz.addEventListener("click", closeZoom);
      pz.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          pz.querySelector(".pz-x").focus();
        }
      });
    }

    document.addEventListener("keydown", (e) => {
      if (modal.hidden || (pz && !pz.hidden)) return;
      if (e.key === "Tab") {
        const focusable = [...dmBox.querySelectorAll('button:not([disabled]), input, a[href], [tabindex]:not([tabindex="-1"])')]
          .filter((el) => el.offsetParent !== null);
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        return;
      }
      if (!reader.total || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault(); showPage(reader.page + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault(); showPage(reader.page - 1);
      } else if (e.key === "Home") {
        e.preventDefault(); showPage(1);
      } else if (e.key === "End") {
        e.preventDefault(); showPage(reader.total);
      }
    });
    addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (pz && !pz.hidden) closeZoom();
      else if (modal.classList.contains("dm-full")) exitFs();
      else if (!modal.hidden) close();
    });
  }

  /* ---------- fiches détaillées : veilles, entreprise, formation (modale) ---------- */
  const vmod = document.getElementById("veilleModal");
  if (vmod) {
    const DETAILS = {
      nis2: {
        title: "Directive NIS2 — la cybersécurité devient une obligation",
        body: `
          <div class="vm-meta">
            <span>type · veille juridique</span>
            <span>créée · octobre 2024</span>
            <span>statut · active — revue chaque semaine</span>
          </div>
          <p class="vm-why"><b>Pourquoi cette veille existe.</b> Le 17 octobre 2024, la France devait avoir transposé la directive (UE) 2022/2555 — elle a pris du retard, comme la majorité des États. Ce jour-là, le sujet est devenu concret : les télécoms passent au régime des « entités essentielles ». J'ai ouvert cette veille pour comprendre ce que NIS2 change dans le quotidien d'un service informatique, pas seulement dans les textes.</p>
          <div class="vm-cols">
            <div>
              <p class="k2">l'essentiel — obligations</p>
              <ul>
                <li>Sécuriser les systèmes d'information et les chaînes de fournisseurs</li>
                <li>Déployer l'authentification multifacteur (MFA)</li>
                <li>Surveiller les réseaux et détecter les cyberattaques</li>
                <li>Déclarer les incidents de sécurité aux autorités — l'ANSSI en France</li>
              </ul>
              <p class="k2" style="margin-top:18px">sanctions encourues</p>
              <ul>
                <li>Jusqu'à 10 M€ ou 2 % du CA mondial — entités essentielles (comme Orange)</li>
                <li>Jusqu'à 7 M€ ou 1,4 % du CA mondial — entités importantes</li>
              </ul>
            </div>
            <div>
              <p class="k2">chronologie</p>
              <ol class="vm-chrono">
                <li><b>17 oct. 2024</b>Date limite de transposition par les États membres — le périmètre des entités concernées s'élargit fortement, télécoms en tête.</li>
                <li><b>12 mars 2025</b>Le Sénat adopte en première lecture le projet de loi « résilience des infrastructures critiques et renforcement de la cybersécurité ».</li>
                <li><b>sept. 2025</b>Examen en commission spéciale à l'Assemblée nationale — la navette se poursuit, l'ANSSI se prépare au rôle d'autorité de contrôle.</li>
              </ol>
            </div>
          </div>
          <p class="k2">comment je l'applique</p>
          <p style="color:var(--ink-2); margin-bottom:4px">Chez Orange — entité essentielle au sens du texte — je vois la directive à l'œuvre : MFA généralisé, durcissement des accès, traçabilité des interventions. En intervention et comme ambassadeur digital, j'explique aux utilisateurs le <i>pourquoi</i> des consignes : verrouillage de session, mots de passe, vigilance sur les pièces jointes.</p>
          <p class="q">« Cette directive concerne directement mon futur métier : les techniciens doivent protéger les infrastructures informatiques et les données. »</p>
          <p class="k2">sources suivies</p>
          <div class="vm-src">
            <a href="https://www.cyber.gouv.fr/la-directive-nis-2" target="_blank" rel="noopener">ANSSI — la directive NIS2 ↗</a>
            <a href="https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32022L2555" target="_blank" rel="noopener">EUR-Lex — directive (UE) 2022/2555 ↗</a>
            <a href="https://www.cert.ssi.gouv.fr" target="_blank" rel="noopener">CERT-FR ↗</a>
          </div>`
      },
      mfa: {
        title: "MFA & Zero Trust — le mot de passe ne suffit plus",
        body: `
          <div class="vm-meta">
            <span>type · veille technologique</span>
            <span>créée · septembre 2024</span>
            <span>statut · active — revue chaque semaine</span>
          </div>
          <p class="vm-why"><b>Pourquoi cette veille existe.</b> Le vol d'identifiants reste une porte d'entrée majeure des cyberattaques. Le MFA — au moins deux preuves de nature différente — rend le mot de passe seul insuffisant : même volé, il ne suffit plus. C'est le point exact où ma veille juridique rejoint ma pratique technique, puisque NIS2 renforce les exigences en matière d'authentification. J'ai ouvert cette veille en entrant en BTS SIO.</p>
          <div class="vm-cols">
            <div>
              <p class="k2">l'essentiel — pourquoi ça se développe</p>
              <ul>
                <li>Augmentation constante des cyberattaques par identifiants dérobés</li>
                <li>Exigences de sécurité renforcées par la directive NIS2</li>
                <li>Protection des comptes professionnels et des données</li>
                <li>Intégration au modèle <b>Zero Trust</b> : vérifier chaque utilisateur et chaque accès, même à l'intérieur du réseau</li>
              </ul>
            </div>
            <div>
              <p class="k2">chronologie</p>
              <ol class="vm-chrono">
                <li><b>années 2010</b>Le MFA existe mais reste optionnel, réservé aux comptes sensibles — banques, administrations.</li>
                <li><b>2024 — 2026</b>Sous l'effet conjugué des cyberattaques et de NIS2, il devient la norme sur les comptes professionnels.</li>
                <li><b>à venir</b>Le Zero Trust généralise la vérification continue : plus aucun accès n'est fiable par défaut, même en interne.</li>
              </ol>
            </div>
          </div>
          <p class="k2">comment je l'applique</p>
          <p style="color:var(--ink-2); margin-bottom:4px">Chez Orange, je m'authentifie avec une clé PKI : c'est du MFA en pratique — ce que je possède, plus ce que je sais. Je déploie ces protections sur les postes, je les explique aux utilisateurs, et je les reproduis dans mes maquettes d'infrastructure.</p>
          <p class="q">« Cette technologie est utilisée dans les entreprises comme Orange pour sécuriser les comptes utilisateurs et protéger les systèmes informatiques. »</p>
          <p class="k2">sources suivies</p>
          <div class="vm-src">
            <a href="https://www.cyber.gouv.fr" target="_blank" rel="noopener">ANSSI ↗</a>
            <a href="https://www.cert.ssi.gouv.fr" target="_blank" rel="noopener">CERT-FR ↗</a>
            <a href="https://www.it-connect.fr" target="_blank" rel="noopener">IT-Connect ↗</a>
          </div>`
      },
      orange: {
        title: "Orange — alternance · technicien soutien de proximité",
        body: `
          <div class="vm-meta">
            <span>type · alternance — service informatique</span>
            <span>période · sept. 2025 — aujourd'hui</span>
            <span>périmètre · ≈ 1 200 utilisateurs</span>
          </div>
          <p class="vm-why"><b>Le contexte.</b> Orange, grand groupe français des télécommunications et du numérique : internet, informatique, réseaux, téléphonie, cybersécurité. J'y effectue mon alternance au sein du service informatique, sous la tutelle de mon maître d'apprentissage, <b>M. Franck Pouilly</b> — au poste de technicien soutien de proximité.</p>
          <div class="vm-cols">
            <div>
              <p class="k2">ce que j'y fais — au quotidien</p>
              <ul>
                <li>Support N1–N2 : diagnostic matériel et logiciel, clés PKI et migration des données</li>
                <li>Déploiement de postes Windows 11 et gestion du stock informatique</li>
                <li>Tickets INC / WO jusqu'au niveau 2, avec chaque intervention documentée</li>
                <li>Brassage réseau, positions Flex et remplacement de terminaux iSMP</li>
                <li>Ambassadeur digital : sensibilisation à la sécurité et inclusion numérique</li>
              </ul>
            </div>
            <div>
              <p class="k2">en chiffres</p>
              <ul>
                <li><b>≈ 1 200</b> salariés dans mon périmètre de support</li>
                <li><b>5–6</b> interventions par jour, sur site et en boutiques</li>
                <li><b>N1–N2</b> niveaux de support traités à l'Espace Service</li>
              </ul>
              <p class="k2" style="margin-top:18px">ce que ça produit</p>
              <ul>
                <li>L'épreuve E5 : gestion patrimoniale, tickets INC / WO, clé PKI</li>
                <li>Des procédures internes rédigées chez Orange — non publiables ici</li>
              </ul>
            </div>
          </div>
          <p class="q">« Une intervention n'est terminée que lorsqu'elle est documentée. »</p>
          <div class="vm-src">
            <a href="#projets" data-goto="#projets">voir les projets professionnels E5 →</a>
          </div>`
      },
      bts: {
        title: "BTS SIO option SISR — ce qu'on y fait vraiment",
        body: `
          <div class="vm-meta">
            <span>diplôme · BTS — bac +2</span>
            <span>option · SISR — solutions d'infrastructure, systèmes et réseaux</span>
            <span>période · 2025 — 2027 · en alternance</span>
          </div>
          <p class="vm-why"><b>C'est quoi.</b> Le BTS Services informatiques aux organisations forme des techniciens capables de gérer l'infrastructure informatique d'une organisation. L'option <b>SISR</b>, c'est la partie infrastructure : serveurs, réseaux, virtualisation, sécurité, supervision — là où l'option SLAM fait du développement.</p>
          <div class="vm-cols">
            <div>
              <p class="k2">les blocs du métier</p>
              <ul>
                <li>Administrer des serveurs — Windows Server, Active Directory</li>
                <li>Concevoir, segmenter et sécuriser des réseaux</li>
                <li>Virtualiser, superviser, masteriser</li>
                <li>Supporter les utilisateurs — et consigner chaque intervention</li>
              </ul>
            </div>
            <div>
              <p class="k2">les épreuves pratiques</p>
              <ul>
                <li><b>E5</b> — projets professionnels réalisés en entreprise, chez Orange</li>
                <li><b>E6</b> — travaux pratiques d'infrastructure, consignés en procédures</li>
              </ul>
            </div>
          </div>
          <p class="k2">concrètement, en laboratoire</p>
          <p style="color:var(--ink-2); margin-bottom:4px">Réseau segmenté, <b>Active Directory</b> redondé avec GPO, messagerie Exchange, supervision Zabbix, GLPI (ITSM), VoIP Xivo, masterisation FOG, Wi-Fi UniFi, proxy Artica — chaque maquette est consignée en procédure : c'est toute la section documentation de ce site.</p>
          <p class="q">« Le laboratoire reproduit l'entreprise : on y casse, on répare — et on écrit. »</p>
          <div class="vm-src">
            <a href="#documentation" data-goto="#documentation">voir la documentation E6 →</a>
          </div>`
      }
    };
    const vmTitle = document.getElementById("vmTitle");
    const vmBody = document.getElementById("vmBody");
    let detailLastFocus = null;
    const openV = (key) => {
      const v = DETAILS[key];
      if (!v) return;
      detailLastFocus = document.activeElement;
      vmTitle.textContent = v.title;
      vmBody.innerHTML = v.body;
      vmBody.scrollTop = 0;
      vmod.hidden = false;
      document.body.classList.add("dm-open");
      const closeBtn = vmod.querySelector(".dm-x");
      if (closeBtn) closeBtn.focus();
    };
    const closeV = () => {
      vmod.hidden = true;
      document.body.classList.remove("dm-open");
      vmBody.innerHTML = "";
      if (detailLastFocus && detailLastFocus.isConnected) detailLastFocus.focus();
    };
    document.querySelectorAll("[data-detail]").forEach((el) => {
      el.addEventListener("click", () => openV(el.getAttribute("data-detail")));
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openV(el.getAttribute("data-detail")); }
      });
    });
    /* lien interne dans une fiche : ferme la modale puis amène à la section */
    vmBody.addEventListener("click", (e) => {
      const a = e.target.closest("[data-goto]");
      if (!a) return;
      e.preventDefault();
      closeV();
      const target = document.querySelector(a.getAttribute("data-goto"));
      if (target) target.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    });
    vmod.querySelectorAll("[data-vclose]").forEach((el) => el.addEventListener("click", closeV));
    addEventListener("keydown", (e) => { if (e.key === "Escape" && !vmod.hidden) closeV(); });
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

  /* ---------- indicateur de scroll (header) ---------- */
  const hScroll = document.getElementById("hScroll");
  if (hScroll) {
    let ticking = false;
    const updScroll = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      const pct = max > 0 ? Math.round((scrollY / max) * 100) : 0;
      hScroll.textContent = `scroll — ${String(Math.min(100, Math.max(0, pct))).padStart(3, "0")}%`;
      ticking = false;
    };
    addEventListener("scroll", () => {
      if (!ticking) { ticking = true; requestAnimationFrame(updScroll); }
    }, { passive: true });
    updScroll();
  }

  /* ---------- fil d'or de progression ---------- */
  const thread = document.getElementById("thread");
  if (thread) {
    const fill = thread.querySelector(".th-fill");
    const dot = thread.querySelector(".th-dot");
    let thTick = false;
    const updThread = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
      fill.style.transform = "scaleY(" + p + ")";
      dot.style.top = (p * 100) + "%";
      thTick = false;
    };
    addEventListener("scroll", () => {
      if (!thTick) { thTick = true; requestAnimationFrame(updThread); }
    }, { passive: true });
    addEventListener("resize", updThread);
    updThread();
  }

  /* ---------- compteurs animés ---------- */
  document.querySelectorAll(".cnt").forEach((el) => {
    const target = parseInt(el.getAttribute("data-count"), 10) || 0;
    const prefix = el.getAttribute("data-prefix") || "";
    const fmt = (n) => prefix + n.toLocaleString("fr-FR");
    if (reduce || !("IntersectionObserver" in window)) { el.textContent = fmt(target); return; }
    const cio = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        cio.unobserve(el);
        const t0 = performance.now(), dur = 1300;
        const step = (t) => {
          const k = Math.min(1, (t - t0) / dur);
          const eased = 1 - Math.pow(1 - k, 3);
          el.textContent = fmt(Math.round(target * eased));
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.4 });
    cio.observe(el);
  });

  /* ---------- archive documentaire : recherche accent-insensible + filtres ---------- */
  const archive = document.getElementById("archiveTools");
  if (archive) {
    const search = document.getElementById("archiveSearch");
    const filterButtons = [...archive.querySelectorAll("[data-archive-filter]")];
    const grids = [...document.querySelectorAll(".dgrid[data-archive-group]")];
    const cards = grids.flatMap((g) => [...g.querySelectorAll(".dcard")]);
    const count = document.getElementById("archiveCount");
    const empty = document.getElementById("archiveEmpty");
    const reset = document.getElementById("archiveReset");
    const norm = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    let filter = "all";
    const kindOf = (card) => {
      const cat = norm(card.querySelector(".scat") && card.querySelector(".scat").textContent);
      if (cat.indexOf("schema") !== -1) return "schema";
      if (cat.indexOf("dossier") !== -1 || /(^|\s)tp(\s|$)/.test(cat) || cat.indexOf("tp ·") !== -1) return "dossier";
      return "procedure";
    };
    const applyArchive = () => {
      const q = norm(search.value.trim());
      let visible = 0;
      cards.forEach((card) => {
        const group = card.closest(".dgrid").dataset.archiveGroup;
        const kind = kindOf(card);
        const inFilter = filter === "all" || filter === group || filter === kind;
        const inSearch = !q || norm(card.textContent).indexOf(q) !== -1;
        card.hidden = !(inFilter && inSearch);
        if (!card.hidden) visible++;
      });
      grids.forEach((grid) => {
        const hasVisible = [...grid.querySelectorAll(".dcard")].some((c) => !c.hidden);
        grid.hidden = !hasVisible;
        const heading = grid.previousElementSibling;
        if (heading && heading.classList.contains("dsub")) heading.hidden = !hasVisible;
      });
      count.textContent = visible + (visible > 1 ? " fiches" : " fiche");
      empty.hidden = visible !== 0;
    };
    filterButtons.forEach((button) => button.addEventListener("click", () => {
      filter = button.dataset.archiveFilter;
      filterButtons.forEach((b) => {
        const on = b === button;
        b.classList.toggle("on", on);
        b.setAttribute("aria-pressed", String(on));
      });
      applyArchive();
    }));
    search.addEventListener("input", applyArchive);
    reset.addEventListener("click", () => {
      filter = "all";
      search.value = "";
      filterButtons.forEach((b) => {
        const on = b.dataset.archiveFilter === "all";
        b.classList.toggle("on", on);
        b.setAttribute("aria-pressed", String(on));
      });
      applyArchive();
      search.focus();
    });
    applyArchive();
  }

  /* ---------- moteur de preuves : index global, aperçu et navigation clavier ---------- */
  const proof = document.getElementById("proofSearch");
  if (proof) {
    const shell = proof.querySelector(".proof-shell");
    const toggle = document.getElementById("proofToggle");
    const input = document.getElementById("proofInput");
    const results = document.getElementById("proofResults");
    const preview = document.getElementById("proofPreview");
    const status = document.getElementById("proofStatus");
    const GROUP_ORDER = ["Projets", "Documents", "Certifications", "Profil & formation", "Veilles", "Portfolio"];
    const proofNorm = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
    const make = (tag, cls, value) => {
      const el = document.createElement(tag);
      if (cls) el.className = cls;
      if (value !== undefined && value !== null) el.textContent = value;
      return el;
    };
    let items = [];
    let current = [];
    let active = null;
    let lastFocus = null;
    let uid = 0;

    const buildIndex = () => {
      items = [];
      uid = 0;
      const seen = new Set();
      const add = (cfg) => {
        const key = cfg.key || [cfg.group, cfg.title, cfg.href || "", cfg.actionLabel].join("|");
        if (seen.has(key)) return;
        seen.add(key);
        const extra = clean(cfg.extra || "");
        const item = Object.assign({}, cfg, {
          uid: ++uid,
          title: clean(cfg.title),
          desc: clean(cfg.desc),
          meta: clean(cfg.meta),
          ref: clean(cfg.ref || cfg.group),
          extra,
          titleN: proofNorm(cfg.title),
          descN: proofNorm(cfg.desc),
          metaN: proofNorm(cfg.meta),
          extraN: proofNorm(extra),
          hay: proofNorm([cfg.title, cfg.desc, cfg.meta, extra].join(" ")),
        });
        item.featured = /^(dossier e5$|dossier e6$|gestion de parc glpi$|supervision zabbix$|tableau de synthese|curriculum vit|directive nis2|ccna 1)/.test(item.titleN);
        items.push(item);
      };

      /* Les deux projets ouvrent leurs dossiers réels, pas une fiche reconstituée. */
      document.querySelectorAll(".pcard").forEach((card) => {
        const actionEl = card.querySelector("[data-doc]");
        const titleEl = card.querySelector("h3");
        if (!actionEl || !titleEl) return;
        const src = actionEl.getAttribute("data-doc");
        const linkedDoc = [...document.querySelectorAll(".dcard[data-doc]")].find((d) => d.getAttribute("data-doc") === src);
        const img = linkedDoc && linkedDoc.querySelector(".thumb img");
        const paragraphs = [...card.querySelectorAll("p")].filter((p) => !p.classList.contains("ctx"));
        const meta = clean(card.querySelector(".p-meta") && card.querySelector(".p-meta").textContent);
        const exam = meta.match(/E[56]/);
        add({
          group: "Projets", key: "projet-" + src,
          title: titleEl.textContent,
          desc: paragraphs.map((p) => p.textContent).join(" "),
          meta, ref: exam ? exam[0] : "projet",
          el: card, actionEl, image: img && img.getAttribute("src"),
          imageAlt: img && img.getAttribute("alt"), actionLabel: "ouvrir le dossier du projet",
          extra: [card.getAttribute("data-proof-keywords"), card.querySelector(".tags") && card.querySelector(".tags").textContent].join(" "),
        });
      });

      /* Documents d'archive, tableau de synthèse et CV. */
      document.querySelectorAll("[data-doc]").forEach((el) => {
        if (el.closest(".pcard")) return;
        const card = el.closest(".dcard") || el.closest(".tcs");
        const title = card && card.querySelector("h4") ? card.querySelector("h4").textContent :
          card && card.querySelector("h3") ? card.querySelector("h3").textContent : el.getAttribute("data-title");
        const desc = card && card.querySelector(".body > p:not(.k)") ? card.querySelector(".body > p:not(.k)").textContent :
          card && card.querySelector("p") ? card.querySelector("p").textContent : "";
        const ref = card && card.querySelector(".sref") ? card.querySelector(".sref").textContent :
          el.closest(".tcs") ? "TCS" : "CV";
        const cat = card && card.querySelector(".scat") ? card.querySelector(".scat").textContent : "";
        const state = card && card.querySelector(".st") ? card.querySelector(".st").textContent : "";
        const img = card && card.querySelector(".thumb img");
        add({
          group: "Documents", key: "document-" + el.getAttribute("data-doc"),
          title, desc, meta: clean([cat, state].join(" ")), ref,
          el, actionEl: el, image: img && img.getAttribute("src"), imageAlt: img && img.getAttribute("alt"),
          actionLabel: el.getAttribute("data-kind") === "img" ? "ouvrir le schéma" : "ouvrir le document",
          extra: [el.getAttribute("data-title"), card && card.getAttribute("data-proof-keywords")].join(" "),
        });
      });

      /* La fiche Orange de la section À propos prime sur son rappel dans la frise. */
      document.querySelectorAll(".card[data-detail]").forEach((el) => {
        const detail = el.getAttribute("data-detail");
        if (detail !== "orange" && detail !== "bts") return;
        add({
          group: "Profil & formation", key: "detail-" + detail,
          title: el.querySelector("h3") ? el.querySelector("h3").textContent : el.textContent,
          desc: el.querySelector("p:not(.k)") ? el.querySelector("p:not(.k)").textContent : "",
          meta: el.querySelector(".k") ? el.querySelector(".k").textContent : "fiche détaillée",
          ref: detail === "orange" ? "Orange" : "BTS",
          el, actionEl: el, image: el.querySelector("img") && el.querySelector("img").getAttribute("src"),
          imageAlt: el.querySelector("img") && el.querySelector("img").getAttribute("alt"), imageType: "badge",
          actionLabel: "ouvrir la fiche", extra: el.getAttribute("data-proof-keywords"),
        });
      });

      /* Badges vérifiables, certifications obtenues et étapes du parcours. */
      document.querySelectorAll(".cert").forEach((el) => {
        const detail = el.getAttribute("data-detail");
        const title = el.querySelector(".ct b") && el.querySelector(".ct b").textContent;
        if (!title) return;
        if (detail) {
          add({
            group: "Profil & formation", key: "detail-" + detail,
            title, desc: el.querySelector(".ct i") && el.querySelector(".ct i").textContent,
            meta: "fiche détaillée", ref: detail === "orange" ? "Orange" : "BTS",
            el, actionEl: el, image: el.querySelector("img") && el.querySelector("img").getAttribute("src"),
            imageAlt: el.querySelector("img") && el.querySelector("img").getAttribute("alt"), imageType: "badge",
            actionLabel: "ouvrir la fiche", extra: el.getAttribute("data-proof-keywords"),
          });
          return;
        }
        const tl = el.closest(".tl-item");
        const year = tl && tl.querySelector(".tl-year") ? clean(tl.querySelector(".tl-year").textContent) : "";
        const yearRef = year.match(/20\d{2}/);
        add({
          group: "Certifications", key: el.getAttribute("href") ? "badge-" + el.getAttribute("href") : "cert-" + title,
          title, desc: el.querySelector(".ct i") && el.querySelector(".ct i").textContent,
          meta: clean([year, tl && tl.querySelector("h4") ? tl.querySelector("h4").textContent : ""].join(" · ")),
          ref: yearRef ? yearRef[0] : "cert.", el, href: el.getAttribute("href"),
          image: el.querySelector("img") && el.querySelector("img").getAttribute("src"),
          imageAlt: el.querySelector("img") && el.querySelector("img").getAttribute("alt"), imageType: "badge",
          actionLabel: el.getAttribute("href") ? "vérifier le badge ↗" : "voir dans le parcours",
          extra: el.getAttribute("data-proof-keywords"),
        });
      });

      /* Veilles détaillées. */
      document.querySelectorAll(".vcard[data-detail]").forEach((el) => {
        const detail = el.getAttribute("data-detail");
        add({
          group: "Veilles", key: "veille-" + detail,
          title: el.querySelector("h3") && el.querySelector("h3").textContent,
          desc: el.querySelector("p") && el.querySelector("p").textContent,
          meta: el.querySelector(".v-top") && el.querySelector(".v-top").textContent,
          ref: detail === "nis2" ? "NIS2" : "MFA", el, actionEl: el,
          actionLabel: "ouvrir la veille", extra: el.getAttribute("data-proof-keywords"),
        });
      });

      /* Journal manuel et derniers avis CERT-FR : la source reste la destination. */
      document.querySelectorAll(".journal .jrow").forEach((el) => {
        const titleEl = el.querySelector(".jbody b");
        const link = el.querySelector(".jsrc a");
        if (!titleEl || !link || /chargement du flux/i.test(titleEl.textContent)) return;
        const title = clean(titleEl.textContent);
        add({
          group: "Veilles", key: "journal-" + link.getAttribute("href") + "-" + title,
          title, desc: el.querySelector(".jbody p") && el.querySelector(".jbody p").textContent,
          meta: clean([el.querySelector(".jdate") && el.querySelector(".jdate").textContent,
            el.querySelector(".jtag") && el.querySelector(".jtag").textContent,
            link.textContent].join(" · ")),
          ref: el.querySelector(".jdate") && el.querySelector(".jdate").textContent,
          el, href: link.getAttribute("href"), actionLabel: "lire la source ↗",
        });
      });

      /* Accès directs aux sections, alimentés par leurs titres et introductions réels. */
      document.querySelectorAll("section[id]").forEach((el) => {
        const title = el.querySelector(".stitle");
        if (!title) return;
        add({
          group: "Portfolio", key: "section-" + el.id,
          title: title.textContent,
          desc: el.querySelector(".ssub") && el.querySelector(".ssub").textContent,
          meta: "section du portfolio", ref: el.querySelector(".snum") && el.querySelector(".snum").textContent,
          el, actionLabel: "aller à la section",
        });
      });
    };

    const emptyPreview = (title, desc) => {
      preview.innerHTML = "";
      const box = make("div", "proof-preview-empty");
      box.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>';
      box.appendChild(make("p", "", title || "Choisissez un résultat"));
      box.appendChild(make("span", "", desc || "Son aperçu et son accès direct apparaîtront ici."));
      preview.appendChild(box);
    };

    const renderPreview = (item) => {
      preview.innerHTML = "";
      if (!item) { emptyPreview(); return; }
      const box = make("div", "proof-preview-inner");
      box.tabIndex = 0;
      box.setAttribute("aria-label", "Aperçu du résultat — zone défilante");
      if (item.image) {
        const fig = make("figure", "proof-preview-media" + (item.imageType === "badge" ? " badge" : ""));
        const img = document.createElement("img");
        img.src = item.image;
        img.alt = item.imageAlt || "Aperçu — " + item.title;
        fig.appendChild(img);
        box.appendChild(fig);
      }
      box.appendChild(make("span", "proof-preview-ref", item.group + " · " + item.ref));
      box.appendChild(make("h3", "", item.title));
      if (item.desc) box.appendChild(make("p", "proof-preview-desc", item.desc));
      if (item.meta) box.appendChild(make("p", "proof-preview-meta", item.meta));
      const reason = make("div", "proof-reason-box");
      reason.appendChild(make("b", "", "pourquoi ce résultat"));
      reason.appendChild(make("span", "", item.reason || "accès direct au contenu du portfolio"));
      box.appendChild(reason);
      const openBtn = make("button", "btn sm pri", item.actionLabel || "ouvrir");
      openBtn.type = "button";
      openBtn.setAttribute("data-proof-open", String(item.uid));
      preview.appendChild(box);
      preview.appendChild(openBtn);
    };

    const setActive = (id, scroll) => {
      const item = current.find((it) => it.uid === Number(id));
      if (!item) return;
      active = item;
      results.querySelectorAll(".proof-result").forEach((el) => {
        const on = Number(el.getAttribute("data-uid")) === item.uid;
        el.classList.toggle("active", on);
        el.setAttribute("aria-selected", String(on));
        if (on && scroll) el.scrollIntoView({ block: "nearest" });
      });
      input.setAttribute("aria-activedescendant", "proof-option-" + item.uid);
      renderPreview(item);
    };

    const reasonFor = (item, rawQuery) => {
      const q = proofNorm(rawQuery);
      let where = "contenu associé";
      if (q && item.titleN.indexOf(q) !== -1) where = "titre";
      else if (q && item.descN.indexOf(q) !== -1) where = "description";
      else if (q && item.metaN.indexOf(q) !== -1) where = "contexte";
      else if (q && item.extraN.indexOf(q) !== -1) where = "fiche détaillée";
      return "« " + rawQuery + " » · " + where;
    };

    const render = () => {
      const rawQuery = clean(input.value);
      const q = proofNorm(rawQuery);
      const tokens = q.split(" ").filter(Boolean);
      let matched;
      if (!tokens.length) {
        matched = items.filter((item) => item.featured);
        matched.forEach((item) => { item.searchScore = 0; item.reason = "accès direct · contenu du portfolio"; });
      } else {
        matched = items.filter((item) => tokens.every((token) => item.hay.indexOf(token) !== -1));
        matched.forEach((item) => {
          let score = 0;
          if (item.titleN === q) score += 170;
          if (item.titleN.indexOf(q) === 0) score += 95;
          else if (item.titleN.indexOf(q) !== -1) score += 65;
          if (item.hay.indexOf(q) !== -1) score += 14;
          tokens.forEach((token) => {
            if (item.titleN.indexOf(token) !== -1) score += 25;
            else if (item.descN.indexOf(token) !== -1) score += 10;
            else if (item.metaN.indexOf(token) !== -1) score += 8;
            else score += 2;
          });
          /* La veille complète répond mieux à une recherche thématique qu'une entrée
             de journal isolée ; les sources datées restent dans le même groupe. */
          if (item.group === "Veilles" && item.actionEl) score += 20;
          item.searchScore = score;
          item.reason = reasonFor(item, rawQuery);
        });
      }
      const total = matched.length;
      matched.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) ||
        b.searchScore - a.searchScore || a.title.localeCompare(b.title, "fr"));
      current = matched.slice(0, 40);
      active = null;
      results.innerHTML = "";
      input.removeAttribute("aria-activedescendant");

      if (!current.length) {
        status.textContent = "aucun résultat";
        const empty = make("div", "proof-empty");
        empty.appendChild(make("p", "", "Aucune preuve trouvée."));
        empty.appendChild(make("span", "", "Essayez un terme plus court ou l’une de ces pistes."));
        const suggestions = make("div", "proof-suggestions");
        ["VLAN", "GLPI", "Orange", "NIS2"].forEach((word) => {
          const b = make("button", "", word);
          b.type = "button";
          b.setAttribute("data-proof-suggestion", word);
          suggestions.appendChild(b);
        });
        empty.appendChild(suggestions);
        results.appendChild(empty);
        emptyPreview("Aucun aperçu", "Modifiez la recherche pour retrouver un contenu du portfolio.");
        return;
      }

      status.textContent = tokens.length ? total + (total > 1 ? " résultats" : " résultat") + (total > current.length ? " · 40 affichés" : "") :
        current.length + " accès directs";
      GROUP_ORDER.forEach((group) => {
        const groupItems = current.filter((item) => item.group === group);
        if (!groupItems.length) return;
        const groupEl = make("section", "proof-group");
        groupEl.setAttribute("role", "group");
        const headingId = "proof-group-" + GROUP_ORDER.indexOf(group);
        groupEl.setAttribute("aria-labelledby", headingId);
        const heading = make("div", "proof-group-title");
        heading.id = headingId;
        heading.appendChild(make("span", "", group));
        heading.appendChild(make("b", "", String(groupItems.length).padStart(2, "0")));
        groupEl.appendChild(heading);
        groupItems.forEach((item) => {
          const btn = make("button", "proof-result");
          btn.type = "button";
          btn.id = "proof-option-" + item.uid;
          btn.setAttribute("role", "option");
          btn.setAttribute("aria-selected", "false");
          btn.setAttribute("data-uid", String(item.uid));
          btn.setAttribute("aria-label", "Prévisualiser " + item.title);
          btn.tabIndex = -1;
          btn.appendChild(make("span", "proof-result-mark", item.ref));
          const main = make("span", "proof-result-main");
          main.appendChild(make("span", "proof-result-title", item.title));
          main.appendChild(make("span", "proof-result-reason", item.reason));
          btn.appendChild(main);
          btn.appendChild(make("span", "proof-result-arrow", "→"));
          groupEl.appendChild(btn);
        });
        results.appendChild(groupEl);
      });
      setActive(current[0].uid, false);
      results.scrollTop = 0;
      preview.scrollTop = 0;
    };

    const closeProof = () => {
      if (proof.hidden) return;
      proof.hidden = true;
      document.body.classList.remove("proof-open");
      input.setAttribute("aria-expanded", "false");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
      if (lastFocus && lastFocus.isConnected) lastFocus.focus();
    };

    const openProof = (query) => {
      if (!proof.hidden) {
        input.focus();
        if (query !== undefined) { input.value = query; render(); }
        return;
      }
      const docOpen = (document.getElementById("docModal") && !document.getElementById("docModal").hidden) ||
        (document.getElementById("veilleModal") && !document.getElementById("veilleModal").hidden);
      if (docOpen) return;
      lastFocus = document.activeElement;
      document.body.classList.remove("nav-open");
      const navBtn = document.getElementById("navToggle");
      if (navBtn) {
        navBtn.setAttribute("aria-expanded", "false");
        navBtn.setAttribute("aria-label", "ouvrir le menu");
      }
      buildIndex();
      input.value = query || "";
      proof.hidden = false;
      document.body.classList.add("proof-open");
      input.setAttribute("aria-expanded", "true");
      if (toggle) toggle.setAttribute("aria-expanded", "true");
      render();
      requestAnimationFrame(() => {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      });
    };

    const goTo = (item) => {
      closeProof();
      const target = item.el;
      if (!target) return;
      target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      target.classList.add("proof-target");
      setTimeout(() => target.classList.remove("proof-target"), 1800);
      if (!target.hasAttribute("tabindex")) {
        target.setAttribute("tabindex", "-1");
        target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
      }
      setTimeout(() => target.focus({ preventScroll: true }), reduce ? 0 : 350);
    };

    const openItem = (item) => {
      if (!item) return;
      if (item.href) {
        closeProof();
        const a = document.createElement("a");
        a.href = item.href;
        a.target = "_blank";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }
      if (item.actionEl) {
        closeProof();
        item.actionEl.click();
        return;
      }
      goTo(item);
    };

    const moveActive = (delta) => {
      if (!current.length) return;
      const index = active ? current.findIndex((item) => item.uid === active.uid) : -1;
      const next = (index + delta + current.length) % current.length;
      setActive(current[next].uid, true);
    };

    input.addEventListener("input", render);
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); moveActive(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1); }
      else if (e.key === "Home" && current.length) { e.preventDefault(); setActive(current[0].uid, true); }
      else if (e.key === "End" && current.length) { e.preventDefault(); setActive(current[current.length - 1].uid, true); }
      else if (e.key === "Enter") { e.preventDefault(); openItem(active); }
    });
    results.addEventListener("click", (e) => {
      const suggestion = e.target.closest("[data-proof-suggestion]");
      if (suggestion) {
        input.value = suggestion.getAttribute("data-proof-suggestion");
        render();
        input.focus();
        return;
      }
      const btn = e.target.closest(".proof-result");
      if (btn) { setActive(btn.getAttribute("data-uid"), false); input.focus(); }
    });
    results.addEventListener("mouseover", (e) => {
      const btn = e.target.closest(".proof-result");
      if (btn) setActive(btn.getAttribute("data-uid"), false);
    });
    preview.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-proof-open]");
      if (!btn) return;
      const item = current.find((it) => it.uid === Number(btn.getAttribute("data-proof-open")));
      openItem(item);
    });
    proof.querySelectorAll("[data-proof-close]").forEach((el) => el.addEventListener("click", closeProof));
    if (toggle) toggle.addEventListener("click", () => openProof());
    document.querySelectorAll("[data-proof-query]").forEach((el) => {
      /* Les compétences restent de simples repères si JavaScript est désactivé. */
      el.disabled = false;
      el.addEventListener("click", () => openProof(el.getAttribute("data-proof-query")));
    });

    shell.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeProof();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = [...shell.querySelectorAll('button:not([disabled]):not([tabindex="-1"]), input, a[href], [tabindex]:not([tabindex="-1"])')]
        .filter((el) => el.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    document.addEventListener("keydown", (e) => {
      /* Échap reste fiable même pendant la frame qui précède la prise de focus. */
      if (e.key === "Escape" && !proof.hidden) {
        e.preventDefault();
        closeProof();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && proofNorm(e.key) === "k") {
        e.preventDefault();
        if (proof.hidden) openProof();
        else input.focus();
      }
    });
  }

  /* ---------- scrollspy léger + cellule de section (header) ---------- */
  const navLinks = [...document.querySelectorAll('#mainnav a[href^="#"]')];
  const secs = navLinks
    .map((a) => document.getElementById(a.getAttribute("href").slice(1)))
    .filter(Boolean);
  const hSect = document.getElementById("hSect");
  const SECT_LABEL = {
    apropos: "à propos", projets: "projets", tcs: "tcs",
    certifications: "certifications", veilles: "veilles",
    documentation: "documentation", contact: "contact",
  };
  const SECT_NUM = {
    apropos: "A/01", projets: "A/02", tcs: "A/03",
    certifications: "A/04", veilles: "A/05",
    documentation: "A/06", contact: "A/07",
  };
  const setSect = (id) => {
    if (!hSect) return;
    if (id && SECT_NUM[id]) hSect.innerHTML = `<b>${SECT_NUM[id]}</b> · ${SECT_LABEL[id]}`;
    else hSect.innerHTML = "<b>A/00</b> · accueil";
  };
  if (navLinks.length && secs.length) {
    /* position de lecture : la section active est la dernière dont le haut
       est passé au-dessus de la ligne de lecture (juste sous l'en-tête) */
    let current = undefined;
    const update = () => {
      const y = scrollY + 160;
      let id = null;
      secs.forEach((s) => { if (s.offsetTop <= y) id = s.id; });
      /* tout en bas de page, la dernière section gagne toujours */
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4)
        id = secs[secs.length - 1].id;
      if (id === current) return;
      current = id;
      navLinks.forEach((a) =>
        a.classList.toggle("on", a.getAttribute("href") === "#" + id)
      );
      setSect(id);
    };
    let tick = false;
    addEventListener("scroll", () => {
      if (tick) return;
      tick = true;
      requestAnimationFrame(() => { update(); tick = false; });
    }, { passive: true });
    addEventListener("resize", update);
    update();
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
      if (txt.length <= 240) return txt;
      const c = txt.slice(0, 240);
      return c.slice(0, c.lastIndexOf(" ")).trimEnd() + "…";
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
        const q = (el, s) => {
          const n = el.querySelector(s);
          return n && n.textContent ? n.textContent : "";
        };
        return items.map((it) => ({
          title: q(it, "title"),
          link: q(it, "link"),
          date: q(it, "pubDate"),
          desc: strip(q(it, "description")),
        }));
      });
    /* 1) capture locale des derniers avis : affichage immédiat, jamais hors-ligne ;
       2) tentative de mise à jour en direct par-dessus — si elle échoue, la capture reste */
    fetch("assets/data/certfr.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("snapshot"))))
      .then((j) => { if (j.items && j.items.length) render(j.items); })
      .catch(() => {});
    viaRss2Json.catch(() => viaAllOrigins).then(render).catch(() => {});
  }
})();

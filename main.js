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
        const fig = document.createElement("figure");
        const im = document.createElement("img");
        im.src = `assets/pages/${slug}-p${i}.jpg`;
        im.alt = `page ${i} du document`;
        im.decoding = "async";
        if (i <= 2) { im.loading = "eager"; im.fetchPriority = "high"; }
        else im.loading = "lazy";
        fig.appendChild(im);
        const cap = document.createElement("figcaption");
        cap.textContent = `P. ${String(i).padStart(2, "0")} / ${String(info.total).padStart(2, "0")}`;
        fig.appendChild(cap);
        if (!reduce) {
          fig.classList.add("pg");
          fig.style.transitionDelay = `${Math.min(i - 1, 12) * 45}ms`;
        }
        mPages.appendChild(fig);
      }
      if (!reduce) {
        const figs = mPages.querySelectorAll("figure.pg");
        requestAnimationFrame(() =>
          requestAnimationFrame(() => figs.forEach((f) => f.classList.add("on")))
        );
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
          <p class="q">« Cette directive impacte directement mon futur métier : les techniciens doivent protéger les infrastructures informatiques et les données. »</p>
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
          <p class="vm-why"><b>Pourquoi cette veille existe.</b> Le vol d'identifiants reste la première porte d'entrée des cyberattaques. Le MFA — mot de passe + preuve temporaire — rend le mot de passe seul inutile : même volé, il ne suffit plus. C'est le point exact où ma veille juridique rejoint ma pratique technique, puisque NIS2 le rend obligatoire. J'ai ouvert cette veille en entrant en BTS SIO.</p>
          <div class="vm-cols">
            <div>
              <p class="k2">l'essentiel — pourquoi ça se développe</p>
              <ul>
                <li>Augmentation constante des cyberattaques par identifiants dérobés</li>
                <li>Obligation légale portée par la directive NIS2</li>
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
          <p class="vm-why"><b>Le contexte.</b> Orange, grand groupe français des télécommunications et du numérique : internet, informatique, réseaux, téléphonie, cybersécurité. J'y effectue mon alternance au sein du service informatique, sous la tutelle de mon maître d'apprentissage, <b>M. Franck Pouilly</b> — au poste de technicien soutien de proximité, au cœur des infrastructures.</p>
          <div class="vm-cols">
            <div>
              <p class="k2">ce que j'y fais — au quotidien</p>
              <ul>
                <li>Gestion et déploiement du parc informatique</li>
                <li>Traitement des tickets INC / WO jusqu'au niveau 2</li>
                <li>Assistance et montée en compétence des utilisateurs</li>
                <li>Consignation méthodique de chaque intervention</li>
                <li>Ambassadeur digital : sensibilisation à la sécurité, inclusion numérique</li>
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
          <p class="vm-why"><b>C'est quoi.</b> Le BTS Services informatiques aux organisations forme des techniciens capables de gérer l'infrastructure informatique d'une organisation. L'option <b>SISR</b>, c'est le côté bâtiment : serveurs, réseaux, virtualisation, sécurité, supervision — là où l'option SLAM fait du développement.</p>
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
    const openV = (key) => {
      const v = DETAILS[key];
      if (!v) return;
      vmTitle.textContent = v.title;
      vmBody.innerHTML = v.body;
      vmBody.scrollTop = 0;
      vmod.hidden = false;
      document.body.classList.add("dm-open");
    };
    const closeV = () => {
      vmod.hidden = true;
      document.body.classList.remove("dm-open");
      vmBody.innerHTML = "";
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
    const spy = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        navLinks.forEach((a) =>
          a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id)
        );
        setSect(e.target.id);
      });
    }, { rootMargin: "-30% 0px -55% 0px" });
    secs.forEach((s) => spy.observe(s));
  }
  if (hSect) {
    addEventListener("scroll", () => {
      if (scrollY < innerHeight * 0.45) setSect(null);
    }, { passive: true });
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
        return items.map((it) => ({
          title: it.querySelector("title")?.textContent || "",
          link: it.querySelector("link")?.textContent || "",
          date: it.querySelector("pubDate")?.textContent || "",
          desc: strip(it.querySelector("description")?.textContent || ""),
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

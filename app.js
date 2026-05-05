(function () {
  "use strict";

  // ── State ──────────────────────────────────────────────────────────
  let repertoire = []; // tableau de { nom, type, tags?, fatigant? }

  // ── DOM refs ───────────────────────────────────────────────────────
  const nbSetlistsInput = document.getElementById("nb-setlists");
  const tailleSetlistInput = document.getElementById("taille-setlist");
  const cbNouveaux = document.getElementById("cb-nouveaux");
  const btnGenerer = document.getElementById("btn-generer");
  const alerteDiv = document.getElementById("alerte");
  const resultatsDiv = document.getElementById("resultats");
  const nouveauxSection = document.getElementById("nouveaux-section");
  const listeNouveauxEl = document.getElementById("liste-nouveaux");
  const nonUtilisesSection = document.getElementById("non-utilises-section");
  const listeNonUtilisesEl = document.getElementById("liste-non-utilises");

  // ── Catégories connues ─────────────────────────────────────────────
  const TYPES_CONNUS = ["debut", "teuf", "connu", "choree", "chill", "rappel", "standard"];
  const LABELS_TYPE = {
    debut: "début",
    teuf: "teuf",
    connu: "connu",
    choree: "chorée",
    chill: "tranquille",
    rappel: "rappel",
    standard: "standard",
  };
  const TAG_NOUVEAU = "nouveau";

  // ── Chargement du répertoire ───────────────────────────────────────
  async function chargerRepertoire() {
    try {
      const res = await fetch("repertoire.yml");
      if (!res.ok) throw new Error("Impossible de charger repertoire.yml");
      const texte = await res.text();
      const data = jsyaml.load(texte);
      if (!data || !Array.isArray(data.morceaux)) {
        throw new Error("Format invalide : 'morceaux' doit être un tableau");
      }
      repertoire = data.morceaux.map(normaliserMorceau);
      btnGenerer.disabled = false;
    } catch (err) {
      afficherAlerte("Erreur au chargement du répertoire : " + err.message);
      btnGenerer.disabled = true;
    }
  }

  function normaliserMorceau(m) {
    return {
      nom: m.nom,
      type: m.type || "standard",
      tags: Array.isArray(m.tags) ? m.tags : [],
      fatigant: typeof m.fatigant === "string" ? m.fatigant : "",
      tricote: typeof m.tricote === "string" ? m.tricote : "",
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function afficherAlerte(msg) {
    alerteDiv.textContent = msg;
    alerteDiv.hidden = false;
  }

  function cacherAlerte() {
    alerteDiv.hidden = true;
    alerteDiv.textContent = "";
  }

  // Un morceau « est » d'une catégorie si c'est son type OU s'il en a le tag.
  function aCategorie(m, cat) {
    return m.type === cat || (m.tags && m.tags.includes(cat));
  }

  function estFatigant(m) {
    return typeof m.fatigant === "string" && m.fatigant.trim() !== "";
  }

  function estTricote(m) {
    return typeof m.tricote === "string" && m.tricote.trim() !== "";
  }

  // Un morceau ne doit pas être en position 1 s'il a le tag "pas-debut".
  function estPasDebut(m) {
    return Array.isArray(m.tags) && m.tags.includes("pas-debut");
  }

  // Interdit en 2e moitié = fatigant uniquement.
  function interditEnFinDeSet(m) {
    return estFatigant(m);
  }

  function estNouveau(m) {
    return Array.isArray(m.tags) && m.tags.includes(TAG_NOUVEAU);
  }

  // Trie un tableau pour mettre les nouveaux morceaux en tête (préférence).
  function prioriserNouveaux(arr) {
    return [...arr].sort((a, b) => Number(estNouveau(b)) - Number(estNouveau(a)));
  }

  // ── Génération d'une set-list ──────────────────────────────────────
  function genererSetlist(morceauxDispo, morceauxUtilises, taille, prefererNouveaux) {
    const avertissements = [];
    const nonUtilises = (m) => !morceauxUtilises.has(m.nom);

    const dispo = (cat, extraFiltre) =>
      morceauxDispo.filter(
        (m) => aCategorie(m, cat) && nonUtilises(m) && (!extraFiltre || extraFiltre(m))
      );

    // Si on préfère les nouveaux, on filtre d'abord sur les nouveaux ; sinon repli
    // sur l'ensemble des candidats.
    const choisirAvecPref = (candidats) => {
      if (candidats.length === 0) return null;
      if (prefererNouveaux) {
        const nouveaux = candidats.filter(estNouveau);
        if (nouveaux.length > 0) return pickRandom(nouveaux);
      }
      return pickRandom(candidats);
    };

    // Position 1 : début (exclure les morceaux taggés "pas-debut")
    let debuts = dispo("debut", (m) => !estPasDebut(m));
    if (debuts.length === 0) {
      avertissements.push("Pas assez de morceaux « debut » disponibles.");
      debuts = morceauxDispo.filter((m) => aCategorie(m, "debut") && !estPasDebut(m));
      if (debuts.length === 0) {
        debuts = morceauxDispo.filter((m) => aCategorie(m, "debut"));
      }
    }
    const mDebut = choisirAvecPref(debuts);

    // Dernière position : teuf, de préférence aussi rappel
    const teufRappels = dispo("teuf", (m) => aCategorie(m, "rappel"));
    let teufs = teufRappels.length > 0 ? teufRappels : dispo("teuf");
    if (teufs.length === 0) {
      avertissements.push("Pas assez de morceaux « teuf » disponibles.");
      teufs = morceauxDispo.filter((m) => aCategorie(m, "teuf"));
    }
    const mTeuf = choisirAvecPref(teufs);

    // Morceaux déjà placés dans cette set-list
    const places = new Set();
    if (mDebut) places.add(mDebut.nom);
    if (mTeuf) places.add(mTeuf.nom);

    // Pool restant
    let pool = morceauxDispo.filter(
      (m) => !places.has(m.nom) && nonUtilises(m)
    );

    const nbMilieu = Math.max(0, taille - (mDebut ? 1 : 0) - (mTeuf ? 1 : 0));
    if (pool.length < nbMilieu) {
      pool = morceauxDispo.filter((m) => !places.has(m.nom));
    }

    // Indice de la « 2e moitié » : positions strictement > taille/2
    // (positions 1-indexées). Ex : taille 10 → 2e moitié = positions 6..10.
    const seuilDeuxiemeMoitie = Math.floor(taille / 2);

    // Remplir le milieu (positions 2..taille-1)
    const milieu = [];
    let poolMelange = shuffle(pool);
    if (prefererNouveaux) poolMelange = prioriserNouveaux(poolMelange);
    let dernierType = mDebut ? mDebut.type : null;
    let dernierEtaitChoree = mDebut ? aCategorie(mDebut, "choree") : false;
    let dernierEtaitTricote = mDebut ? estTricote(mDebut) : false;

    for (let pos = 2; pos <= taille - 1; pos++) {
      if (poolMelange.length === 0) break;

      const enDeuxiemeMoitie = pos > seuilDeuxiemeMoitie;

      // Préférence : type différent + pas choree/tricote consécutif + pas fatigant en 2e moitié
      const preferences = [
        (m) =>
          m.type !== dernierType &&
          !(dernierEtaitChoree && aCategorie(m, "choree")) &&
          !(dernierEtaitTricote && estTricote(m)) &&
          (!enDeuxiemeMoitie || !interditEnFinDeSet(m)),
        (m) =>
          !(dernierEtaitChoree && aCategorie(m, "choree")) &&
          !(dernierEtaitTricote && estTricote(m)) &&
          (!enDeuxiemeMoitie || !interditEnFinDeSet(m)),
        (m) => !enDeuxiemeMoitie || !interditEnFinDeSet(m),
        () => true,
      ];

      let idx = -1;
      for (const pred of preferences) {
        idx = poolMelange.findIndex(pred);
        if (idx !== -1) break;
      }
      if (idx === -1) idx = 0;

      const choisi = poolMelange.splice(idx, 1)[0];

      // Avertir si on a dû enfreindre une contrainte forte
      if (enDeuxiemeMoitie && interditEnFinDeSet(choisi)) {
        avertissements.push(
          `Morceau fatigant placé en 2e moitié faute d'alternative : « ${choisi.nom} »`
        );
      }
      if (dernierEtaitChoree && aCategorie(choisi, "choree")) {
        avertissements.push(
          `Deux morceaux « chorée » consécutifs faute d'alternative : « ${choisi.nom} »`
        );
      }
      if (dernierEtaitTricote && estTricote(choisi)) {
        avertissements.push(
          `Deux morceaux « tricoté » consécutifs faute d'alternative : « ${choisi.nom} »`
        );
      }

      milieu.push(choisi);
      dernierType = choisi.type;
      dernierEtaitChoree = aCategorie(choisi, "choree");
      dernierEtaitTricote = estTricote(choisi);
    }

    // Assemblage
    const setlist = [];
    if (mDebut) setlist.push(mDebut);
    setlist.push(...milieu);
    if (mTeuf) setlist.push(mTeuf);

    for (const m of setlist) morceauxUtilises.add(m.nom);

    return { setlist, avertissements };
  }

  // ── Orchestration ──────────────────────────────────────────────────
  function genererToutesSetlists() {
    cacherAlerte();
    resultatsDiv.innerHTML = "";

    const nbSetlists = Math.max(
      1,
      Math.min(10, parseInt(nbSetlistsInput.value, 10) || 1)
    );
    const taille = Math.max(
      3,
      Math.min(30, parseInt(tailleSetlistInput.value, 10) || 10)
    );
    const inclureNouveaux = cbNouveaux.checked;

    if (repertoire.length === 0) {
      afficherAlerte("Le répertoire est vide.");
      afficherSectionsAnnexes(new Set(), inclureNouveaux);
      return;
    }

    // Pool éligible aux set-lists : sans les nouveaux si la case n'est pas cochée.
    const repertoireEligible = inclureNouveaux
      ? repertoire
      : repertoire.filter((m) => !estNouveau(m));

    if (repertoireEligible.length === 0) {
      afficherAlerte(
        "Aucun morceau éligible (tout le répertoire est marqué « nouveau »). " +
          "Cochez « Inclure les nouveaux morceaux »."
      );
      afficherSectionsAnnexes(new Set(), inclureNouveaux);
      return;
    }

    const morceauxUtilises = new Set();
    const tousAvertissements = [];

    const totalNecessaire = nbSetlists * taille;
    if (totalNecessaire > repertoireEligible.length) {
      tousAvertissements.push(
        `Répertoire éligible (${repertoireEligible.length} morceaux) insuffisant pour ` +
          `${nbSetlists} set-list(s) de ${taille} morceaux sans répétition. ` +
          `Des morceaux sont réutilisés.`
      );
    }

    const setlists = [];
    for (let i = 0; i < nbSetlists; i++) {
      if (morceauxUtilises.size >= repertoireEligible.length) {
        morceauxUtilises.clear();
      }
      const { setlist, avertissements } = genererSetlist(
        repertoireEligible,
        morceauxUtilises,
        taille,
        inclureNouveaux
      );
      setlists.push(setlist);
      tousAvertissements.push(...avertissements);
    }

    const avertissementsUniques = [...new Set(tousAvertissements)];
    if (avertissementsUniques.length > 0) {
      afficherAlerte(avertissementsUniques.join(" — "));
    }

    // Noms réellement placés dans une des set-lists affichées.
    const nomsPlaces = new Set();
    for (const sl of setlists) for (const m of sl) nomsPlaces.add(m.nom);

    for (let i = 0; i < setlists.length; i++) {
      resultatsDiv.appendChild(creerCarteSetlist(i + 1, setlists[i]));
    }

    afficherSectionsAnnexes(nomsPlaces, inclureNouveaux);
  }

  // ── Sections annexes (nouveaux / non utilisés) ─────────────────────
  function afficherSectionsAnnexes(nomsPlaces, inclureNouveaux) {
    // Nouveaux morceaux : toujours listés s'il en existe.
    listeNouveauxEl.innerHTML = "";
    const nouveaux = repertoire.filter(estNouveau);
    if (nouveaux.length > 0) {
      for (const m of nouveaux) {
        listeNouveauxEl.appendChild(creerLigneMorceau(m));
      }
      nouveauxSection.hidden = false;
    } else {
      nouveauxSection.hidden = true;
    }

    // Morceaux non utilisés (absents des set-lists générées), groupés par type.
    listeNonUtilisesEl.innerHTML = "";
    let nonUtilises = repertoire.filter((m) => !nomsPlaces.has(m.nom));
    // Si les nouveaux ne sont pas inclus, on les retire de cette section
    // pour éviter les doublons avec la section dédiée ci-dessus.
    if (!inclureNouveaux) {
      nonUtilises = nonUtilises.filter((m) => !estNouveau(m));
    }

    if (nonUtilises.length === 0) {
      nonUtilisesSection.hidden = true;
      return;
    }

    // Regrouper par type
    const groupes = new Map();
    for (const m of nonUtilises) {
      const t = TYPES_CONNUS.includes(m.type) ? m.type : "standard";
      if (!groupes.has(t)) groupes.set(t, []);
      groupes.get(t).push(m);
    }

    // Affichage dans l'ordre des TYPES_CONNUS
    for (const t of TYPES_CONNUS) {
      if (!groupes.has(t)) continue;
      const groupe = groupes.get(t);
      const h3 = document.createElement("h3");
      h3.className = "groupe-titre";
      h3.textContent = `${LABELS_TYPE[t]} (${groupe.length})`;
      listeNonUtilisesEl.appendChild(h3);

      const ul = document.createElement("ul");
      ul.className = "liste-extra";
      for (const m of groupe) {
        ul.appendChild(creerLigneMorceau(m));
      }
      listeNonUtilisesEl.appendChild(ul);
    }
    nonUtilisesSection.hidden = false;
  }

  function creerLigneMorceau(m) {
    const li = document.createElement("li");

    const nomSpan = document.createElement("span");
    nomSpan.className = "nom";
    nomSpan.textContent = m.nom;
    li.appendChild(nomSpan);

    const typeKnown = TYPES_CONNUS.includes(m.type) ? m.type : "standard";
    const badge = document.createElement("span");
    badge.className = `badge badge-${typeKnown}`;
    badge.textContent = LABELS_TYPE[typeKnown] || m.type;
    li.appendChild(badge);

    for (const t of m.tags || []) {
      if (t === TAG_NOUVEAU) {
        const b = document.createElement("span");
        b.className = "badge badge-nouveau";
        b.textContent = "nouveau";
        li.appendChild(b);
      } else if (t === "pas-debut") {
        const b = document.createElement("span");
        b.className = "badge badge-pas-debut";
        b.title = "Ne doit pas être en première position";
        b.textContent = "⚡ pas en 1er";
        li.appendChild(b);
      } else if (TYPES_CONNUS.includes(t) && t !== m.type) {
        const b = document.createElement("span");
        b.className = `badge badge-${t} badge-tag`;
        b.textContent = LABELS_TYPE[t] || t;
        li.appendChild(b);
      }
    }

    if (estFatigant(m)) {
      const fat = document.createElement("span");
      fat.className = "badge badge-fatigant";
      fat.title = `Fatigant : ${m.fatigant}`;
      fat.textContent = `💤 ${m.fatigant}`;
      li.appendChild(fat);
    }
    if (estTricote(m)) {
      const tri = document.createElement("span");
      tri.className = "badge badge-tricote";
      tri.title = `Tricoté (difficile au sax) : ${m.tricote}`;
      tri.textContent = `🎷 ${m.tricote}`;
      li.appendChild(tri);
    }
    return li;
  }

  // ── Rendu ──────────────────────────────────────────────────────────
  function creerCarteSetlist(numero, setlist) {
    const article = document.createElement("article");

    const titre = document.createElement("header");
    titre.textContent = `Set-list ${numero}`;
    article.appendChild(titre);

    const ol = document.createElement("ol");
    for (const m of setlist) {
      const li = document.createElement("li");

      const nomSpan = document.createElement("span");
      nomSpan.className = "nom";
      nomSpan.textContent = m.nom;
      li.appendChild(nomSpan);

      // Badge du type principal
      const typeKnown = TYPES_CONNUS.includes(m.type) ? m.type : "standard";
      const badge = document.createElement("span");
      badge.className = `badge badge-${typeKnown}`;
      badge.textContent = LABELS_TYPE[typeKnown] || m.type;
      li.appendChild(badge);

      // Badges pour chaque tag connu
      for (const t of m.tags || []) {
        if (t === TAG_NOUVEAU) {
          const b = document.createElement("span");
          b.className = "badge badge-nouveau";
          b.textContent = "nouveau";
          li.appendChild(b);
        } else if (t === "pas-debut") {
          const b = document.createElement("span");
          b.className = "badge badge-pas-debut";
          b.title = "Ne doit pas être en première position";
          b.textContent = "⚡ pas en 1er";
          li.appendChild(b);
        } else if (TYPES_CONNUS.includes(t) && t !== m.type) {
          const tagBadge = document.createElement("span");
          tagBadge.className = `badge badge-${t} badge-tag`;
          tagBadge.textContent = LABELS_TYPE[t] || t;
          li.appendChild(tagBadge);
        }
      }

      // Marqueur fatigant
      if (estFatigant(m)) {
        const fat = document.createElement("span");
        fat.className = "badge badge-fatigant";
        fat.title = `Fatigant : ${m.fatigant}`;
        fat.textContent = `💤 ${m.fatigant}`;
        li.appendChild(fat);
      }

      // Marqueur tricoté
      if (estTricote(m)) {
        const tri = document.createElement("span");
        tri.className = "badge badge-tricote";
        tri.title = `Tricoté (difficile au sax) : ${m.tricote}`;
        tri.textContent = `🎷 ${m.tricote}`;
        li.appendChild(tri);
      }

      ol.appendChild(li);
    }
    article.appendChild(ol);

    return article;
  }

  // ── Init ───────────────────────────────────────────────────────────
  btnGenerer.disabled = true;
  btnGenerer.addEventListener("click", genererToutesSetlists);
  chargerRepertoire();
})();

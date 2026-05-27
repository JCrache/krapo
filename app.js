(function () {
  "use strict";

  // ── State (état de la dernière génération pour la copie) ────────────────
  let repertoire = []; // tableau de { nom, type, tags?, fatigant?, discord? }
  let dernieresSetlists = []; // stocke les set-lists générées pour la copie

  // ── DOM refs ───────────────────────────────────────────────────────
  const nbSetlistsInput = document.getElementById("nb-setlists");
  const tailleSetlistInput = document.getElementById("taille-setlist");
  const cbNouveaux = document.getElementById("cb-nouveaux");
  const cbUneBasse = document.getElementById("cb-une-basse");
  const easterEggBasse = document.getElementById("easter-basse");
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
  const EMOJIS_TYPE = {
    debut: "🏁",
    teuf: "🔥",
    connu: "⭐",
    choree: "💃",
    chill: "🌿",
    rappel: "🔔",
    standard: "♟️",
  };
  const TAG_NOUVEAU = "nouveau";

  // ── État d'affichage (compact / complet) ───────────────────────────
  let affichageCompact = false;

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
      nomComplet: typeof m.nom_complet === "string" ? m.nom_complet : "",
      type: m.type || "standard",
      tags: Array.isArray(m.tags) ? m.tags : [],
      fatigant: typeof m.fatigant === "string" ? m.fatigant : "",
      tricote: typeof m.tricote === "string" ? m.tricote : "",
      deuxBasses: !!m["deux-basses"],
      discord: typeof m.discord === "string" ? m.discord : "",
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────
  function creerBadge(className, emoji, texte, title) {
    const span = document.createElement("span");
    span.className = className;
    if (title) span.title = title;

    const emojiSpan = document.createElement("span");
    emojiSpan.className = "badge-emoji";
    emojiSpan.textContent = emoji;
    span.appendChild(emojiSpan);

    const texteSpan = document.createElement("span");
    texteSpan.className = "badge-texte";
    texteSpan.textContent = texte;
    span.appendChild(texteSpan);

    return span;
  }

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

  // Interdit en 2e moitié = fatigant, ou type principal "debut".
  function interditEnFinDeSet(m) {
    return estFatigant(m) || m.type === "debut";
  }

  // Interdit en 1re moitié = type principal "teuf".
  function interditEnDebutDeSet(m) {
    return m.type === "teuf";
  }

  // Un morceau de type principal "rappel" ne peut être qu'en dernière position.
  function estRappelExclusif(m) {
    return m.type === "rappel";
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

    // places grandit au fur et à mesure des choix ; dispo l'exclut dès le début.
    const places = new Set();

    const dispo = (cat, extraFiltre) =>
      morceauxDispo.filter(
        (m) =>
          aCategorie(m, cat) &&
          nonUtilises(m) &&
          !places.has(m.nom) &&
          (!extraFiltre || extraFiltre(m))
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
      debuts = morceauxDispo.filter(
        (m) => aCategorie(m, "debut") && !places.has(m.nom) && !estPasDebut(m)
      );
      if (debuts.length === 0) {
        debuts = morceauxDispo.filter((m) => aCategorie(m, "debut") && !places.has(m.nom));
      }
    }
    const mDebut = choisirAvecPref(debuts);
    if (mDebut) places.add(mDebut.nom); // exclu dès maintenant pour le choix de mTeuf

    // Dernière position : teuf, de préférence aussi rappel
    const teufRappels = dispo("teuf", (m) => aCategorie(m, "rappel"));
    let teufs = teufRappels.length > 0 ? teufRappels : dispo("teuf");
    if (teufs.length === 0) {
      avertissements.push("Pas assez de morceaux « teuf » disponibles.");
      teufs = morceauxDispo.filter((m) => aCategorie(m, "teuf") && !places.has(m.nom));
    }
    const mTeuf = choisirAvecPref(teufs);
    if (mTeuf) places.add(mTeuf.nom);

    // Pool restant : exclure aussi les morceaux de type "rappel" (réservés à la dernière position)
    let pool = morceauxDispo.filter(
      (m) => !places.has(m.nom) && nonUtilises(m) && !estRappelExclusif(m)
    );

    const nbMilieu = Math.max(0, taille - (mDebut ? 1 : 0) - (mTeuf ? 1 : 0));
    if (pool.length < nbMilieu) {
      pool = morceauxDispo.filter((m) => !places.has(m.nom) && !estRappelExclusif(m));
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
      const enPremiereMotie = pos <= seuilDeuxiemeMoitie;

      // Contrainte de placement par type principal :
      //   - type "debut" → uniquement en 1re moitié
      //   - type "teuf"  → uniquement en 2e moitié
      //   - fatigant     → uniquement en 1re moitié
      const respectePlacement = (m) =>
        (!enDeuxiemeMoitie || !interditEnFinDeSet(m)) &&
        (!enPremiereMotie || !interditEnDebutDeSet(m));

      // Préférence : type différent + pas choree/tricote consécutif + placement respecté
      const preferences = [
        (m) =>
          m.type !== dernierType &&
          !(dernierEtaitChoree && aCategorie(m, "choree")) &&
          !(dernierEtaitTricote && estTricote(m)) &&
          respectePlacement(m),
        (m) =>
          !(dernierEtaitChoree && aCategorie(m, "choree")) &&
          !(dernierEtaitTricote && estTricote(m)) &&
          respectePlacement(m),
        (m) => respectePlacement(m),
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
          `Morceau interdit en 2e moitié placé faute d'alternative : « ${choisi.nom} »`
        );
      }
      if (enPremiereMotie && interditEnDebutDeSet(choisi)) {
        avertissements.push(
          `Morceau interdit en 1re moitié placé faute d'alternative : « ${choisi.nom} »`
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
    // Retirer les boutons globaux de la passe précédente
    const ancienGlobal = document.getElementById("copie-globale");
    if (ancienGlobal) ancienGlobal.remove();

    const nbSetlists = Math.max(
      1,
      Math.min(10, parseInt(nbSetlistsInput.value, 10) || 1)
    );
    const taille = Math.max(
      3,
      Math.min(30, parseInt(tailleSetlistInput.value, 10) || 10)
    );
    const inclureNouveaux = cbNouveaux.checked;
    const uneSeuleBasse = cbUneBasse.checked;

    if (repertoire.length === 0) {
      afficherAlerte("Le répertoire est vide.");
      afficherSectionsAnnexes(new Set(), inclureNouveaux);
      return;
    }

    // Pool éligible aux set-lists : sans les nouveaux si la case n'est pas cochée,
    // sans les morceaux deux-basses si une seule basse.
    let repertoireEligible = inclureNouveaux
      ? repertoire
      : repertoire.filter((m) => !estNouveau(m));
    if (uneSeuleBasse) {
      repertoireEligible = repertoireEligible.filter((m) => !m.deuxBasses);
    }

    if (repertoireEligible.length === 0) {
      afficherAlerte(
        "Aucun morceau éligible avec la configuration actuelle."
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
      // Pause bière entre les sets (>4 set-lists)
      if (nbSetlists > 4 && i > 0) {
        const pause = document.createElement("div");
        pause.className = "easter-pause";
        pause.textContent = `🍺 Pause bière n°${i}`;
        resultatsDiv.appendChild(pause);
      }
      resultatsDiv.appendChild(creerCarteSetlist(i + 1, setlists[i]));
    }

    // Easter eggs selon taille / nombre
    if (nbSetlists === 1 && taille <= 3) {
      resultatsDiv.appendChild(creerEasterEgg(" P'tite journée hein"));
    }
    if (nbSetlists === 1 && taille > 15) {
      resultatsDiv.appendChild(creerEasterEgg(" Allez courage les trompettes, c'est pas bientôt fini 🎺"));
    }
    if (taille >= 10 && setlists.some((sl) => sl.filter((m) => aCategorie(m, "chill")).length === 0)) {
      resultatsDiv.appendChild(creerEasterEgg(" Tant pis pour le set chill!"));
    }

    // Stocker pour la copie globale et afficher les boutons globaux
    dernieresSetlists = setlists;
    afficherBoutonsGlobaux(setlists);

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
    li.appendChild(creerBadge(`badge badge-${typeKnown}`, EMOJIS_TYPE[typeKnown] || "▪️", LABELS_TYPE[typeKnown] || m.type));

    for (const t of m.tags || []) {
      if (t === TAG_NOUVEAU) {
        li.appendChild(creerBadge("badge badge-nouveau", "🆕", "nouveau"));
      } else if (t === "pas-debut") {
        li.appendChild(creerBadge("badge badge-pas-debut", "⚡", "pas en 1er", "Ne doit pas être en première position"));
      } else if (TYPES_CONNUS.includes(t) && t !== m.type) {
        li.appendChild(creerBadge(`badge badge-${t} badge-tag`, EMOJIS_TYPE[t] || "▪️", LABELS_TYPE[t] || t));
      }
    }

    if (estFatigant(m)) {
      li.appendChild(creerBadge("badge badge-fatigant", "💤", m.fatigant, `Fatigant : ${m.fatigant}`));
    }
    if (estTricote(m)) {
      li.appendChild(creerBadge("badge badge-tricote", "🎷", m.tricote, `Tricoté (difficile au sax) : ${m.tricote}`));
    }
    if (m.deuxBasses) {
      li.appendChild(creerBadge("badge badge-deux-basses", "🎸🎸", "2 basses", "Nécessite 2 basses"));
    }
    return li;
  }

  // ── Copie dans le presse-papiers ─────────────────────────────────
  function copierTexte(texte, bouton) {
    navigator.clipboard.writeText(texte).then(() => {
      const ancien = bouton.textContent;
      bouton.textContent = "✓";
      bouton.classList.add("copie-ok");
      setTimeout(() => {
        bouton.textContent = ancien;
        bouton.classList.remove("copie-ok");
      }, 1500);
    });
  }

  function texteSetlistNoms(setlist) {
    return setlist.map((m) => m.nom).join("\n");
  }

  function texteSetlistDiscord(setlist) {
    return setlist.map((m) => m.discord ? `<#${m.discord}>` : m.nom).join("\n");
  }

  function texteToutesNoms(setlists) {
    return setlists
      .map((sl, i) => `Set ${i + 1}\n${texteSetlistNoms(sl)}`)
      .join("\n\n");
  }

  function texteToutesDiscord(setlists) {
    return setlists
      .map((sl, i) => `Set ${i + 1}\n${texteSetlistDiscord(sl)}`)
      .join("\n\n");
  }

  function afficherBoutonsGlobaux(setlists) {
    // Retirer les anciens boutons globaux s'ils existent
    const ancien = document.getElementById("copie-globale");
    if (ancien) ancien.remove();

    if (setlists.length === 0) return;

    const div = document.createElement("div");
    div.id = "copie-globale";
    div.className = "copie-globale";

    const btnNoms = document.createElement("button");
    btnNoms.className = "btn-copier btn-copier-noms";
    btnNoms.title = "Copier toutes les set-lists (noms)";
    btnNoms.textContent = "📋 Copier tout";
    btnNoms.addEventListener("click", () => copierTexte(texteToutesNoms(setlists), btnNoms));
    div.appendChild(btnNoms);

    const btnDiscord = document.createElement("button");
    btnDiscord.className = "btn-copier btn-copier-discord";
    btnDiscord.title = "Copier toutes les set-lists (liens Discord #)";
    btnDiscord.textContent = "# Copier tout";
    btnDiscord.addEventListener("click", () => copierTexte(texteToutesDiscord(setlists), btnDiscord));
    div.appendChild(btnDiscord);

    // Insérer juste avant la section résultats
    resultatsDiv.parentNode.insertBefore(div, resultatsDiv);
  }

  // ── Rendu ──────────────────────────────────────────────────────────
  function creerEasterEgg(texte) {
    const div = document.createElement("div");
    div.className = "easter-note";
    div.textContent = texte;
    return div;
  }

  function creerCarteSetlist(numero, setlist) {
    const article = document.createElement("article");

    const headerEl = document.createElement("header");

    const titreSpan = document.createElement("span");
    titreSpan.textContent = `Set-list ${numero}`;
    headerEl.appendChild(titreSpan);

    const btnsDiv = document.createElement("span");
    btnsDiv.className = "carte-btns";

    const btnCopierNoms = document.createElement("button");
    btnCopierNoms.className = "btn-copier btn-copier-noms";
    btnCopierNoms.title = "Copier les noms des morceaux";
    btnCopierNoms.textContent = "📋";
    btnCopierNoms.addEventListener("click", () =>
      copierTexte(texteSetlistNoms(setlist), btnCopierNoms)
    );
    btnsDiv.appendChild(btnCopierNoms);

    const btnCopierDiscord = document.createElement("button");
    btnCopierDiscord.className = "btn-copier btn-copier-discord";
    btnCopierDiscord.title = "Copier les liens Discord (#)";
    btnCopierDiscord.textContent = "#";
    btnCopierDiscord.addEventListener("click", () =>
      copierTexte(texteSetlistDiscord(setlist), btnCopierDiscord)
    );
    btnsDiv.appendChild(btnCopierDiscord);

    headerEl.appendChild(btnsDiv);
    article.appendChild(headerEl);

    const ol = document.createElement("ol");
    for (const m of setlist) {
      const li = document.createElement("li");

      const nomSpan = document.createElement("span");
      nomSpan.className = "nom";
      nomSpan.textContent = m.nom;
      li.appendChild(nomSpan);

      // Badge du type principal
      const typeKnown = TYPES_CONNUS.includes(m.type) ? m.type : "standard";
      li.appendChild(creerBadge(`badge badge-${typeKnown}`, EMOJIS_TYPE[typeKnown] || "▪️", LABELS_TYPE[typeKnown] || m.type));

      // Badges pour chaque tag connu
      for (const t of m.tags || []) {
        if (t === TAG_NOUVEAU) {
          li.appendChild(creerBadge("badge badge-nouveau", "🆕", "nouveau"));
        } else if (t === "pas-debut") {
          li.appendChild(creerBadge("badge badge-pas-debut", "⚡", "pas en 1er", "Ne doit pas être en première position"));
        } else if (TYPES_CONNUS.includes(t) && t !== m.type) {
          li.appendChild(creerBadge(`badge badge-${t} badge-tag`, EMOJIS_TYPE[t] || "▪️", LABELS_TYPE[t] || t));
        }
      }

      // Marqueur fatigant
      if (estFatigant(m)) {
        li.appendChild(creerBadge("badge badge-fatigant", "💤", m.fatigant, `Fatigant : ${m.fatigant}`));
      }

      // Marqueur tricoté
      if (estTricote(m)) {
        li.appendChild(creerBadge("badge badge-tricote", "🎷", m.tricote, `Tricoté (difficile au sax) : ${m.tricote}`));
      }

      // Marqueur deux basses
      if (m.deuxBasses) {
        li.appendChild(creerBadge("badge badge-deux-basses", "🎸🎸", "2 basses", "Nécessite 2 basses"));
      }

      ol.appendChild(li);
    }
    article.appendChild(ol);

    // Easter egg : compteur teuf
    const nbTeuf = setlist.filter((m) => aCategorie(m, "teuf")).length;
    if (nbTeuf < 2) {
      const note = document.createElement("footer");
      note.className = "easter-note";
      note.textContent = " C'est pas trop la teuf !";
      article.appendChild(note);
    } else if (nbTeuf > 6) {
      const note = document.createElement("footer");
      note.className = "easter-note easter-note-teuf";
      note.textContent = "Ça, c'est la teuf ! 🔥🔥🔥";
      article.appendChild(note);
    }

    // Easter egg : Chirouble
    if (setlist.some((m) => m.nom === "Chirouble")) {
      const note = document.createElement("footer");
      note.className = "easter-note";
      note.textContent = " Et un verre de chiiiiirouuuble 🍷";
      article.appendChild(note);
    }

    // Easter egg : trop de chorée
    const nbChoree = setlist.filter((m) => aCategorie(m, "choree")).length;
    if (nbChoree > 6) {
      const note = document.createElement("footer");
      note.className = "easter-note";
      note.textContent = " Oh le set faaatigant !";
      article.appendChild(note);
    }

    return article;
  }

  // ── Init ───────────────────────────────────────────────────────────
  const btnToggleCompact = document.getElementById("btn-toggle-compact");
  const btnCopierRepertoire = document.getElementById("btn-copier-repertoire");

  btnGenerer.disabled = true;
  btnGenerer.addEventListener("click", genererToutesSetlists);
  cbUneBasse.addEventListener("change", () => {
    easterEggBasse.hidden = !cbUneBasse.checked;
  });

  btnToggleCompact.addEventListener("click", () => {
    affichageCompact = !affichageCompact;
    btnToggleCompact.textContent = affichageCompact ? "🏷️ Émojis" : "🏷️ Détails";
    btnToggleCompact.title = affichageCompact
      ? "Affichage détaillé (types et tags en texte)"
      : "Affichage compact (émojis uniquement)";
    document.body.classList.toggle("compact-badges", affichageCompact);
  });

  btnCopierRepertoire.addEventListener("click", () => {
    const texte = repertoire
      .slice()
      .map((m) => m.nomComplet || m.nom)
      .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }))
      .join("\n");
    copierTexte(texte, btnCopierRepertoire);
  });

  chargerRepertoire();
})();

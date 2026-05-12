# Set-lists — Les Krapos

Générateur de set-lists pour la fanfare **Les Krapos**.
Une set-list est une liste ordonnée de morceaux à jouer.

## Lancer le projet

`fetch('repertoire.yml')` impose un serveur HTTP local :

```bash
cd setlist-krapos
python -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Format du répertoire (`repertoire.yml`)

```yaml
morceaux:
  - nom: "Nom du morceau"
    type: debut         # voir catégories ci-dessous
    tags: [rappel]      # optionnel, liste de tags additionnels
    fatigant: "trompette"  # optionnel, string : instrument(s) pour qui c'est fatigant
    tricote: "sax"        # optionnel, string : difficile au saxophone
    deux-basses: true     # optionnel, booléen : nécessite 2 personnes à la basse
```

### Catégories (`type`)

Un morceau a **un seul** `type` principal, qui détermine également les contraintes de placement :

- `debut` : idéal pour démarrer un set — **uniquement en 1ʳᵉ moitié**
- `teuf` : morceau qui envoie / énergique — **uniquement en 2ᵉ moitié**
- `connu` : connu du public
- `choree` : a une chorégraphie
- `chill` : morceau plus posé / tranquille
- `rappel` : sert de rappel — **uniquement en dernière position**
- `standard` : morceau « neutre » (par défaut si non précisé)

### Tags

Un morceau peut porter des `tags` additionnels (liste). Exemple : un morceau de type `teuf` qui peut aussi servir de `rappel` →

```yaml
- nom: "Mon Teuf-Rappel"
  type: teuf
  tags: [rappel]
```

Les règles de génération considèrent qu'un morceau « est » d'une catégorie si c'est son `type` **ou** si elle figure dans ses `tags`.

#### Tag spécial `nouveau`

Le tag `nouveau` marque un morceau récemment ajouté, encore peu maîtrisé.

- Si la case **« Inclure les nouveaux morceaux »** est cochée, ces morceaux sont privilégiés (placés au maximum) dans les set-lists.
- Sinon, ils sont totalement exclus des set-lists, mais affichés dans une section dédiée en bas de page pour pouvoir piocher dedans à la main si besoin.

#### Tag `pas-debut`

Le tag `pas-debut` indique qu'un morceau ne doit **pas** être placé en première position d'un set (il faut être échauffé).

Il peut être combiné avec n'importe quel `type` :

```yaml
- nom: "Mon Morceau"
  type: teuf
  tags: [pas-debut]
```

### Attribut `fatigant`

`fatigant` est une **chaîne de caractères** :
- absente ou vide ⇒ aucune contrainte
- non vide (ex. `"trompette"`, `"trompette, saxo"`) ⇒ le morceau ne sera **pas** placé dans la deuxième moitié du set.

La valeur indique l'instrument concerné, à titre informatif.

### Attribut `tricote`

`tricote` est une **chaîne de caractères** :
- absente ou vide ⇒ aucune contrainte
- non vide (ex. `"sax"`) ⇒ le morceau peut être placé n'importe où dans le set, mais **pas deux morceaux tricotés consécutifs**.

La valeur indique l'instrument concerné, à titre informatif.

### Attribut `deux-basses`

`deux-basses` est un **booléen** optionnel :
- absent ou `false` ⇒ aucune contrainte
- `true` ⇒ le morceau nécessite 2 personnes à la basse.

Si la case **« Une seule basse »** est cochée, ces morceaux sont totalement exclus des set-lists.

## Configuration de génération

- **Nombre de set-lists** à générer en une fois.
- **Taille de set-list** (par défaut 10).
- **Inclure les nouveaux morceaux** (case à cocher).
- **Une seule basse** (case à cocher) : si cochée, exclut les morceaux nécessitant 2 basses.

Pas de distinction « jeunes / vieux » : tout le monde connaît tout le monde.

## Sections annexes affichées sous les set-lists

- **Nouveaux morceaux** : liste complète des morceaux taggés `nouveau` (toujours visible s'il en existe).
- **Morceaux non utilisés** : morceaux du répertoire absents des set-lists générées, regroupés par catégorie.

## Règles de génération

Chaque set-list :
- commence par un morceau de catégorie `debut`, qui n'a **pas** le tag `pas-debut`,
- se termine par un morceau de catégorie `teuf` (de préférence aussi `rappel`),
- contient le nombre de morceaux configuré,
- les morceaux de type principal `debut` ne sont placés qu'en **1ʳᵉ moitié**,
- les morceaux de type principal `teuf` ne sont placés qu'en **2ᵉ moitié**,
- les morceaux de type principal `rappel` ne sont placés qu'en **dernière position**,
- n'a pas deux morceaux `choree` consécutifs,
- n'a pas deux morceaux `tricote` consécutifs,
- n'a aucun morceau `fatigant` au-delà de la moitié du set,
- alterne les types autant que possible.

Lors de la génération de plusieurs set-lists simultanément, un morceau n'est pas réutilisé d'une set-list à l'autre — sauf si le répertoire est trop petit, auquel cas un avertissement est affiché.

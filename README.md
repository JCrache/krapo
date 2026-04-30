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
```

### Catégories (`type`)

Un morceau a **un seul** `type` principal :

- `debut` : idéal pour démarrer un set
- `teuf` : morceau qui envoie / énergique
- `connu` : connu du public
- `choree` : a une chorégraphie
- `chill` : morceau plus posé / tranquille
- `rappel` : sert de rappel
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

### Attribut `fatigant`

`fatigant` est une **chaîne de caractères** :
- absente ou vide ⇒ aucune contrainte
- non vide (ex. `"trompette"`, `"trompette, saxo"`) ⇒ le morceau ne sera **pas** placé dans la deuxième moitié du set.

La valeur indique l'instrument concerné, à titre informatif.

## Configuration de génération

- **Nombre de set-lists** à générer en une fois.
- **Taille de set-list** (par défaut 10).
- **Inclure les nouveaux morceaux** (case à cocher).

Pas de distinction « jeunes / vieux » : tout le monde connaît tout le monde.

## Sections annexes affichées sous les set-lists

- **Nouveaux morceaux** : liste complète des morceaux taggés `nouveau` (toujours visible s'il en existe).
- **Morceaux non utilisés** : morceaux du répertoire absents des set-lists générées, regroupés par catégorie.

## Règles de génération

Chaque set-list :
- commence par un morceau de catégorie `debut`,
- se termine par un morceau de catégorie `teuf` (de préférence aussi `rappel`),
- contient le nombre de morceaux configuré,
- n'a pas deux morceaux `choree` consécutifs,
- n'a aucun morceau `fatigant` au-delà de la moitié du set,
- alterne les types autant que possible.

Lors de la génération de plusieurs set-lists simultanément, un morceau n'est pas réutilisé d'une set-list à l'autre — sauf si le répertoire est trop petit, auquel cas un avertissement est affiché.

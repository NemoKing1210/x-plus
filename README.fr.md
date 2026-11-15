# X Plus

<!-- xp:readme -->
[![CI](https://github.com/NemoKing1210/x-plus/actions/workflows/ci.yml/badge.svg)](https://github.com/NemoKing1210/x-plus/actions/workflows/ci.yml)
[![Installer le userscript](https://img.shields.io/badge/Install-userscript-0f1419?style=for-the-badge&labelColor=1d9bf0)](https://raw.githubusercontent.com/NemoKing1210/x-plus/main/x-plus.user.js)
[![Licence : MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](https://github.com/NemoKing1210/x-plus/blob/main/LICENSE)
[![Version](https://img.shields.io/badge/version-0.14.0-green?style=for-the-badge)](https://github.com/NemoKing1210/x-plus/blob/main/CHANGELOG.md)

[English](https://github.com/NemoKing1210/x-plus/blob/main/README.md) · [Русский](https://github.com/NemoKing1210/x-plus/blob/main/README.ru.md) · [中文](https://github.com/NemoKing1210/x-plus/blob/main/README.zh.md) · [Español](https://github.com/NemoKing1210/x-plus/blob/main/README.es.md) · [Português](https://github.com/NemoKing1210/x-plus/blob/main/README.pt.md) · [Deutsch](https://github.com/NemoKing1210/x-plus/blob/main/README.de.md) · **Français** · [日本語](https://github.com/NemoKing1210/x-plus/blob/main/README.ja.md)
<!-- /xp:readme -->

Un userscript pour [X](https://x.com) (x.com / twitter.com) qui ajoute la
**traduction des posts sur place** (un port du projet voisin x-translator), le
**téléchargement des médias** (vidéos, GIF, photos) et un ensemble de
**nettoyages de l’interface** — le tout configurable depuis un seul panneau qui
suit le thème clair, atténué et sombre de X.

> Non affilié à X Corp. / Twitter.

## Installation

1. Installez un gestionnaire de userscripts : [Tampermonkey](https://www.tampermonkey.net/),
   [Violentmonkey](https://violentmonkey.github.io/) ou
   [ScriptCat](https://scriptcat.org/).
2. Installez-le depuis l’URL brute (le script se met à jour tout seul depuis
   `main`) :

```
https://raw.githubusercontent.com/NemoKing1210/x-plus/main/x-plus.user.js
```

| Gestionnaire | Chemin |
|--------------|--------|
| Tampermonkey | Tableau de bord → **Utilitaires** → **Installer depuis une URL** |
| Violentmonkey | Tableau de bord → **+** → **Installer depuis une URL** |
| ScriptCat | **Installer depuis une URL** avec l’URL brute |
| Manuellement | Ouvrez `x-plus.user.js`, copiez-le, créez un script et collez-le |

Ouvrez les réglages depuis l’entrée **X Plus** du menu de gauche de X ou depuis
le menu du gestionnaire de userscripts.

## Fonctionnalités

### Traduction

Le même moteur que [x-translator](https://github.com/NemoKing1210/x-translator) :

- Contrôle **Traduire** dans l’en-tête de chaque post, réponse et post cité
- **Articles X** : le bouton Traduire de l’en-tête de l’article (à côté de Grok)
  le traduit paragraphe par paragraphe (titre, listes et légendes compris) — les
  liens, les retours à la ligne et les sous-titres en gras sont conservés ; la
  traduction s’affiche sous chaque paragraphe ou à sa place
- Modes — au clic sur le bouton, ou **automatique** dès qu’un post est visible
  (éventuellement seulement pour certains comptes)
- Affichage — **remplacer** le texte sur place (par défaut), ou un panneau
  séparé avec *Afficher l’original*, *apercevoir l’original au survol* ou une vue
  *partagée* original + traduction
- Fournisseurs — Google (sans clé), DeepL, Microsoft, compatible OpenAI, Yandex,
  LibreTranslate
- Liste de blocage par compte, listes de langues sources autorisées / bloquées,
  ignorer les posts que X a déjà traduits, entrées dans le menu ⋮ du post
- Les erreurs de traduction (« Échec de la traduction. Réessayez. ») sont
  masquées par défaut — un interrupteur les réaffiche
- Liens et emojis préservés : les URL et les hashtags survivent à la traduction
- Cache local avec TTL, compteur d’utilisation et limite de taille souple

### Captures

- Bouton appareil photo à côté de **Traduire** dans l’en-tête du post : un clic
  copie le post — tel qu’il apparaît sur la page, thème actuel, texte traduit,
  médias, citation et barre d’actions compris — dans le presse-papiers au format
  PNG
- Le fond est configurable : le thème de la page (par défaut, pour que le PNG ne
  soit jamais transparent), blanc, noir, transparent ou n’importe quelle couleur
  CSS
- Échelle de l’image (automatique, 1×, 2×, 3×), conserver ou rogner la barre
  d’actions, et copier dans le presse-papiers ou enregistrer le fichier
- Les vidéos et GIF sont capturés sur leur image de couverture
- Quand le navigateur ne peut pas placer d’image dans le presse-papiers
  (Firefox), le PNG est enregistré comme fichier
- Désactivé par défaut

### Téléchargement de médias

- Bouton dans la barre d’actions du post et (en option) sur chaque vidéo / photo
- Vidéos, GIF et photos ; posts cités compris
- Qualité vidéo : la meilleure, jusqu’à 1080 / 720 / 480p, le plus petit
  fichier, ou **demander à chaque fois** (le sélecteur liste toutes les versions
  avec leur débit)
- Photos en qualité originale ou grande ; plusieurs fichiers → demander ou tout
  télécharger
- Modèle de nom de fichier : `{user}` `{id}` `{date}` `{time}` `{n}` `{quality}`
  `{type}` `{text}`
- Notification de progression ; fonctionne sans connexion via le point d’accès
  public de syndication de X et se rabat sur votre session pour les posts qu’il
  ne renvoie pas
- Photos plus grandes en parcourant la timeline (en option) ; revenir à
  « par défaut » (ou désactiver les médias) restaure les versions propres à X
- Galerie de photos (en option) : un clic sur une photo du post ouvre une galerie
  plein écran rapide au lieu de la page photo de X — sans réponses ni timeline ;
  toutes les photos du post avec vignettes, `←` / `→`, balayage, zoom,
  téléchargement et ouverture de l’original (Ctrl / Cmd / Maj + clic ouvrent
  toujours la visionneuse de X)
- Zoom de la visionneuse : molette, glisser, double clic, `+` / `-` / `0`,
  pincement sur écran tactile

### Mode Shorts

Parcourez le fil une publication à la fois, comme sur YouTube Shorts (en option).

- La molette ou `↑` / `↓` (ainsi que `J` / `K`) passent à la publication
  précédente / suivante et la centrent (`Espace` avance, `Maj` + `Espace`
  recule)
- La traduction automatique (Traduction → mode automatique) peut être limitée à
  la publication courante — elle démarre quand la publication est restée un
  moment au centre, donc les publications que vous dépassez ne coûtent aucune
  requête API ; la suivante peut être traduite à l’avance (une requête, rien ne
  s’affiche avant votre arrivée) pour que le changement soit instantané (activé
  par défaut ; le bouton Traduire fonctionne partout)
- Les vidéos ne se lisent que dans la publication courante : celles des
  publications voisines restent en pause, et une vidéo est mise en pause quand
  vous quittez sa publication (elle reprend quand vous revenez)
- Des boutons ronds ↑ / ↓ à côté de la publication courante permettent de
  passer à la précédente / suivante à la souris
- Les publications reliées par une ligne de fil (une réponse sous son post, un
  fil personnel) comptent comme une seule : elles sont surlignées, centrées et
  parcourues ensemble
- La publication courante grandit un peu, celles autour sont floutées ; taille,
  flou, opacité de la précédente / suivante et vitesse de transition sont
  réglables
- Défilement automatique (en option) : passe seul à la publication suivante
  après un délai défini (1–60 s) ; une vidéo plus longue retient sa publication
  jusqu’à ce qu’elle ait réellement été lue jusqu’au bout (un démarrage tardif,
  la mise en tampon ou un saut ne peuvent pas provoquer un passage anticipé), et
  le compte à rebours attend tant que le pointeur est sur les boutons fléchés.
  Mettre la vidéo en pause met le compte à rebours en pause, et mettre le
  défilement en pause met la vidéo en pause ; reprendre rétablit les deux. La
  progression est un anneau autour du bouton « suivant », ou une barre en haut de
  la publication quand les boutons sont masqués ; l’indicateur se change dans les
  réglages ; le bouton lecture / pause se trouve sous les flèches, et une touche
  (`P` par défaut, modifiable dans les réglages) met le défilement en pause et le
  reprend — à côté de la barre, une petite étiquette affiche la touche ; la pause
  est mémorisée, elle reste donc après l’ouverture d’une publication et le
  retour ou un rechargement de la page (désactiver puis réactiver le défilement
  automatique le relance)
- Activez-le dans les réglages (onglet Shorts) ou avec l’interrupteur à côté du
  rappel `Ctrl + M` en bas à gauche
- Fonctionne dans les fils (Accueil, profils, recherche, listes), pas sur la page
  d’une publication ; une publication plus haute que l’écran défile normalement
  jusqu’à son bord

### Interface

Règles de nettoyage par interrupteurs : posts promus, compteurs de vues, badges
de vérification, boutons Grok, la zone de publication et les onglets du fil, le
bloc *Qui suivre* que X insère dans la timeline, la colonne de droite (recherche,
offre Premium, tendances, *Qui suivre*, liens de pied de page), les entrées du
menu de gauche (logo, Explorer, Notifications, Chat, Appels, Grok, Historique,
Creator Studio, Premium, bouton de publication, menu du compte…) et les panneaux
flottants Grok / Chat. Survolez un réglage pour le prévisualiser : l’assombrissement
et le flou s’estompent et l’élément concerné sur la page derrière le panneau est
surligné (affiché même s’il est masqué).

Au démarrage, une brève introduction fige la page pendant l’application des
réglages, puis les publications visibles apparaissent l’une après l’autre — le
nettoyage et les contrôles injectés n’arrivent jamais d’un coup. Elle respecte la
préférence `prefers-reduced-motion`.

Une section **Post** distincte met en forme un post et ses parties : posts en
cartes (contour, remplissage ou ombre, rayon des coins réglable), espace entre
les posts, marge intérieure, absence de séparateurs, taille du texte, forme de
l’avatar (cercle, arrondi ou carré) et masquage des avatars, posts cités, images,
vidéos, aperçus de liens, articles, de l’avis « Langue source », des @pseudos, de
la barre d’actions, des compteurs de vues, des badges de vérification et du
bouton Grok.

### Filtrage

Un constructeur de règles pour masquer les posts que vous ne voulez pas voir,
séparé du nettoyage de l’interface.

- Un post est masqué lorsqu’il correspond à **n’importe quelle** règle ; dans une
  règle, les conditions sont combinées avec **toutes** (ET) ou **n’importe
  laquelle** (OU)
- Conditions sur le nom de l’auteur, le @pseudo, le texte, la langue, les médias
  (photo, vidéo ou GIF), les pièces jointes (carte de lien, post cité, sondage,
  article) et les marqueurs (promu, auteur vérifié, contexte de repost / épinglé)
- Opérateurs de texte : contient / ne contient pas, mot entier, commence par /
  se termine par, exactement / pas exactement, vide / non vide, expression
  régulière
- Compatible avec les emojis : un drapeau ou un emoji dans le nom de l’auteur ou
  le texte est comparé tel que vous le voyez
- **Tester sur cette page** souligne et compte les posts correspondants — y
  compris ceux déjà masqués — avant d’enregistrer
- Le masquage se fait en direct pendant le défilement et retire toute la cellule
  du post, sans laisser de vide ; le post mis en avant sur sa page n’est jamais
  masqué
- Interrupteur principal et un interrupteur par règle

### Réglages

- Ouvrez-les et fermez-les avec **Ctrl + M** (un rappel discret se trouve en bas
  à gauche ; désactivable dans Général), depuis l’entrée du menu de gauche ou le
  menu du gestionnaire de userscripts
- Onglets : **Général · Traduction (fournisseur inclus) · Médias · Shorts ·
  Interface · Filtrage · Cache · Sauvegarde · À propos** ; les modifications sont
  préparées et appliquées avec **Enregistrer**
- Langues de l’interface : English, Русский, 中文, Español, Português, Deutsch,
  Français, 日本語 (ou automatique)
- Notifications : activées / désactivées, coin, durée
- **Sauvegarde :** exporter / importer tous les réglages en JSON, réinitialiser
  les valeurs par défaut

## Limitations

- La traduction des articles conserve les liens, les retours à la ligne et les
  **lignes** en gras / italique ; les mots en gras ou italique au milieu d’une
  phrase apparaissent en texte normal dans la traduction.
- Seules les versions **MP4** peuvent être enregistrées. Les vidéos que X ne
  publie qu’en flux HLS sont signalées comme non téléchargeables.
- La solution de repli GraphQL pour les posts restreints dépend de l’API interne
  de X et peut cesser de fonctionner quand X la modifie ; le chemin principal
  (syndication) non.
- X modifie souvent son balisage. Si un bouton, une règle de masquage ou un
  emplacement cesse de fonctionner, les sélecteurs à ajuster sont listés dans
  [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#verifying-x-selectors).
- Les requêtes de traduction partent de votre navigateur vers le fournisseur
  choisi (Google par défaut). Les clés d’API restent dans le stockage du
  userscript — elles sont incluses dans l’export JSON, gardez donc ce fichier
  privé.

## Développement

```bash
npm install
npm run build      # build + mise à jour de x-plus.user.js / x-plus.meta.js à la racine
npm run ci         # vérification i18n et README + build + vérification des artefacts
npm run harness    # page x.com simulée pour les tests manuels
```

Architecture, ajout d’une fonctionnalité / d’un fournisseur / d’une règle de
nettoyage et liste de publication : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md), [AGENTS.md](AGENTS.md).

## Licence

[MIT](LICENSE)

# ChordsMaster

SPA statique en français pour explorer des accords de guitare et de piano. Aucun serveur applicatif, compte, base de données, bibliothèque JavaScript ni installation de dépendances.

La publication autorisée est GitHub Pages. Ne pas publier ni synchroniser sur ChatGPT Sites.

## Démarrage

Avec Node.js 20 ou plus récent :

```sh
npm run dev
```

Ouvrir l'adresse affichée, par défaut `http://localhost:4173`. Les fichiers de `dist/` peuvent être publiés tels quels chez tout hébergeur statique (Cloudflare Pages, Netlify, GitHub Pages…). Le lancement par HTTP est nécessaire pour les modules JavaScript ; ne pas ouvrir `index.html` directement avec `file://`.

## Fonctionnalités

- Manche 24 cases, six cordes, une note par corde, cordes à vide et muettes.
- Standard, Drop D/C, Open D/G/E/A, DADGAD, standard abaissé et accordage personnalisé avec octaves explicites.
- Piano interactif, jusqu'à six notes, mêmes hauteurs et octaves que la guitare.
- Triades, suspensions, sixièmes, septièmes, extensions et altérations ; lectures alternatives et renversements.
- Transposition exacte et recherche d'une répartition sur six cordes lorsque le déplacement direct n'est pas possible.
- Écoute avec Web Audio, La4 = 440 Hz.
- Carnet local persistant, noms personnalisés, suppression annulable, sauvegarde/import JSON.
- Carnet compact, détails repliables, réorganisation par glisser-déposer ou flèches depuis la poignée. L'ordre est sauvegardé et utilisé dans le PDF.
- Sélection et téléchargement PDF vectoriel paginé, avec manche, clavier, notes et intervalles.
- Interface responsive, navigation clavier, états accessibles et respect des mouvements réduits.

## Théorie et limites explicites

Les classes de hauteur servent à reconnaître une formule exacte ; les valeurs MIDI déterminent la basse. Les doublures sont conservées pour les instruments et la transposition. Aucune fondamentale absente n'est supposée. L'option de quinte omise ne permet d'omettre que la quinte juste et l'indique à l'écran et dans le PDF. Le catalogue n'est pas exhaustif : des combinaisons inconnues sont affichées comme notes libres, et les interprétations concurrentes sont proposées sans prétendre connaître le contexte harmonique.

Le moteur conserve l'orthographe diatonique des degrés (Cdim7 : C E♭ G♭ B♭♭). L'interface, les instruments, le carnet et les PDF affichent les noms chromatiques usuels : Fa plutôt que Mi♯, Ré plutôt que Do♯♯. Le choix dièses/bémols détermine les noms des touches altérées. Les degrés continuent d'indiquer leur rôle harmonique exact. Les symboles 13 incluent ici la neuvième et omettent conventionnellement la onzième naturelle. Les hauteurs utilisent les octaves scientifiques : C4 = MIDI 60. Le PDF utilise `b` et `#` pour les altérations, avec des polices PDF standard.

La recherche de position garantit les notes et une note par corde ; elle ne garantit pas un doigté humain confortable. Une combinaison de touches impossible dans l'accordage donné reste au piano, avec un message explicite. Changer l'accordage conserve les cases et recalcule les hauteurs. Les données restent dans `localStorage`, propres au navigateur et à l'origine du site. Exporter le JSON permet une sauvegarde et un transfert. Google Fonts améliore la typographie ; des polices de repli assurent le fonctionnement sans réseau.

## Publication GitHub Pages

Le workflow `.github/workflows/pages.yml` vérifie les tests puis publie uniquement `dist/` à chaque push sur `main` ou `master`. Dans les paramètres du dépôt, sélectionner **Pages → Source → GitHub Actions**. Aucun serveur ni processus de compilation n'est nécessaire. Les chemins relatifs fonctionnent à la racine d'un domaine comme dans un sous-dossier GitHub Pages.

Un domaine personnalisé peut être ajouté dans **Settings → Pages → Custom domain**, puis relié avec les enregistrements DNS demandés par GitHub. Activer HTTPS une fois le certificat disponible.

Le carnet reste propre à chaque navigateur et adresse de site. Pour transférer le carnet de l'aperçu local au site publié, utiliser **Sauvegarde JSON**, puis **Importer** sur le site.

## Vérification

```sh
npm test
```

Tests du catalogue dans les douze fondamentales et ses renversements, orthographe, ambiguïtés, quintes omises, accordages, assignation des cordes, limites/transposition et structure PDF.

Références : [Open Music Theory : symboles](https://viva.pressbooks.pub/openmusictheory/chapter/chord-symbols/), [renversements](https://viva.pressbooks.pub/openmusictheory/chapter/inversion/), [Fender : accordages](https://www.fender.com/online-guitar-tuner/acoustic-guitar-tuning/).

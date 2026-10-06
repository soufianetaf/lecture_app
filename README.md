# Lecture

Application web pour **lire des livres en français et en anglais** (PDF, EPUB, TXT), avec suivi de lecture,
surlignage, dictionnaire bilingue et révision du vocabulaire. Elle s’installe comme une application et fonctionne
hors ligne. Toutes les données restent dans le navigateur : aucun compte, aucun serveur.

👉 Mode d’emploi : [docs/GUIDE.md](docs/GUIDE.md)

## Fonctionnalités

| Domaine      | Ce que fait l’application                                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bibliothèque | Import PDF, EPUB et TXT (glisser-déposer), couverture, détection de la langue, recherche et tri                                                               |
| Lecture      | Pagination, sommaire, clavier et gestes tactiles ; thèmes clair / sépia / sombre ; police, taille, interligne, marges (EPUB) et zoom (PDF)                    |
| Progression  | Reprise exacte de la lecture, pourcentage, temps de lecture actif                                                                                             |
| Surlignage   | 4 couleurs, notes, liste triée, export Markdown                                                                                                               |
| Dictionnaire | Double-clic sur un mot : définition dans la langue du livre, traduction dans l’autre ; formes fléchies ramenées à leur forme de base ; traduction de passages |
| Vocabulaire  | Mots enregistrés avec la phrase du livre, révision par cartes avec répétition espacée, export CSV pour Anki                                                   |
| Données      | Sauvegarde et restauration (JSON), stockage protégé, application hors ligne (PWA)                                                                             |
| Interface    | Français ou anglais, accessible au clavier et aux lecteurs d’écran                                                                                            |

## Démarrer

Prérequis : [Node.js](https://nodejs.org/) 22 ou plus récent.

```bash
npm install
npm run dev
```

Puis ouvrir <http://localhost:5173>. Des livres de test sont dans [`fixtures/`](fixtures/).

## Commandes

| Commande                         | Rôle                                                           |
| -------------------------------- | -------------------------------------------------------------- |
| `npm run dev`                    | Serveur de développement avec rechargement à chaud             |
| `npm run build`                  | Version de production dans `dist/` (avec service worker)       |
| `npm run preview`                | Sert la version de production (pour tester le mode hors ligne) |
| `npm test`                       | Tests unitaires (Vitest)                                       |
| `npm run lint`                   | Analyse du code (oxlint)                                       |
| `npm run format`                 | Mise en forme (Prettier)                                       |
| `npm run check`                  | Types + lint + format + tests : à lancer avant chaque commit   |
| `node scripts/make-fixtures.mjs` | Régénère les livres de test                                    |
| `node scripts/make-icons.mjs`    | Régénère les icônes de l’application                           |

## Architecture

React 19 + TypeScript (strict) + Vite, Tailwind CSS, IndexedDB via Dexie, pdf.js et epub.js.

```text
src/
  db/          schéma IndexedDB (Dexie) et migrations versionnées
  services/    logique métier sans interface, testée unitairement
    dictionary/  Wiktionnaires, MyMemory, cache, lemmatisation
    vocabulary/  répétition espacée, phrases de contexte, export Anki
    txt/         conversion TXT → EPUB
  reader/      écran de lecture : vues PDF et EPUB, panneaux, menus
  vocabulary/  pages Vocabulaire et Révision
  settings/    page Paramètres (sauvegarde, stockage, langue)
  i18n/        textes de l’interface (fr = référence, en typé à l’identique)
  components/  composants partagés (bibliothèque, barres, limites d’erreur)
scripts/       génération des fixtures et des icônes, évaluation du dictionnaire
fixtures/      livres de test (PDF, EPUB, TXT en Windows-1252)
```

Principes suivis :

- **Logique séparée de l’interface** : les services ne produisent ni texte ni HTML (codes d’erreur, données
  structurées) ; l’interface traduit et affiche.
- **Tests sans réseau** : les analyseurs du dictionnaire sont testés sur des extraits réels des réponses
  Wiktionary, enregistrés dans `__fixtures__/`.
- **Chargement à la demande** : pdf.js et epub.js (≈ 1 Mo) ne sont chargés qu’à l’ouverture d’un livre.
- **Données versionnées** : chaque changement de schéma est une migration Dexie testée.
- **Pas de page blanche** : des limites d’erreur React isolent le lecteur et le dictionnaire.

## Données et confidentialité

Tout est stocké localement dans le navigateur (IndexedDB) : livres, progression, surlignages, vocabulaire.
Seuls les **mots ou passages recherchés** quittent l’appareil, vers :

- [Wiktionary](https://en.wiktionary.org/) et [Wiktionnaire](https://fr.wiktionary.org/) — contenu sous licence
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), source indiquée sous chaque résultat ;
- [MyMemory](https://mymemory.translated.net/) — traduction des passages et secours pour les mots (quota gratuit
  quotidien limité).

Les résultats sont mis en cache localement : un mot déjà consulté reste disponible hors ligne.

## Qualité

- 212 tests unitaires (`npm test`)
- Lighthouse (version de production) : performance 98–99, accessibilité 100, bonnes pratiques 100
- axe-core : aucune violation WCAG 2 A/AA sur l’écran de lecture et ses panneaux
- Dictionnaire évalué sur 100 mots réels (50 par langue) : 100 % de résultats utiles
  (`scripts/dictionaryEval.ts`, voir l’en-tête du fichier)

## Déploiement

L’application est statique : le contenu de `dist/` peut être servi par n’importe quel hébergeur.
Les chemins sont relatifs (`base: './'`), elle fonctionne donc aussi dans un sous-dossier.

Sur GitHub, le workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) publie automatiquement
sur GitHub Pages à chaque push sur `main` (activer _Settings › Pages › Source : GitHub Actions_).
Le workflow [`ci.yml`](.github/workflows/ci.yml) vérifie chaque push et chaque pull request.

## Limites connues

- Les PDF scannés (images sans texte) ne sont pas pris en charge (pas d’OCR).
- Pas de synchronisation entre appareils : utiliser la sauvegarde / restauration.
- La première recherche d’un mot peut prendre 1 à 3 s quand Wikimedia n’a pas la page en cache.
- Les livres protégés par DRM ne peuvent pas être ouverts.

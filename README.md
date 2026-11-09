# Le Vestiaire — coaching d’Aya et Camélia

Deux pages autonomes, une par athlète, avec programme sport, nutrition, suivi du poids et coach.

| Dossier | Projet Vercel | Contenu |
|---|---|---|
| `aya/` | `vestiaire-aya` | page d’Aya |
| `camelia/` | `vestiaire-camelia` | page de Camélia |
| `questionnaire/` | `vestiaire-questionnaire` | bilan d'inscription client (`/`) et espace coach (`/coach`) |
| `src/` | — | modèle commun et script de génération |
| `supabase/` | — | base de données (migration) et fonction `coach` |

## Contenus

- `src/guides.js` : fiches « Comment faire » de chaque exercice (`GUIDES`), correspondance exercice → fiche (`GUIDE_OF`) et questions/réponses communes (`FAQ_COMMON`).
- `src/faq-perso.js` : questions/réponses propres à chaque athlète (affichées en premier).
- Le coach répond hors ligne grâce à ces réponses (recherche par mots-clés), enregistre les pesées (« je fais 74,8 ») et les séances (« j’ai fait la séance 2 »).

## Modifier le programme

1. Modifier les données dans `src/template.html` (objet `const P = {...}`).
2. Régénérer les pages : `node src/build.js`.
3. Commit + push : Vercel redéploie automatiquement les deux pages.

## Supabase

- Table `coaching_suivi` : une ligne par athlète, protégée par un code PIN (hash bcrypt). Aucune lecture directe possible : tout passe par `coaching_get` / `coaching_save`.
- Fonction Edge `coach` : vérifie le code puis interroge l’API Anthropic.
  Pour activer le coach en direct, ajouter le secret `ANTHROPIC_API_KEY` dans
  Supabase → Edge Functions → Secrets. Optionnel : `COACH_MODEL` (par défaut `claude-haiku-5-5`).
  Sans clé, le coach répond avec les réponses préparées.
- Changer un code : voir le commentaire en bas de `supabase/migrations/001_coaching_suivi.sql`.

## Questionnaire client

- `questionnaire/index.html` : le bilan à envoyer aux clients (7 étapes, sauvegarde automatique sur le téléphone).
- `questionnaire/coach.html` (`/coach`) : liste des bilans reçus, protégée par le code coach. Bouton « Copier la fiche pour Claude » pour générer le programme, statut, notes, export Excel.
- Les questions sont toutes dans `questionnaire/questions.js` : pour en ajouter une, modifier ce fichier puis push.
- Supabase : table `questionnaire_reponses` (aucune lecture publique). Envoi via `questionnaire_envoyer`, lecture via `questionnaire_liste` / `questionnaire_maj` avec le code coach. Changer le code : voir le bas de `supabase/migrations/002_questionnaire.sql`.

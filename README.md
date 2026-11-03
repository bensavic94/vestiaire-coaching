# Le Vestiaire — coaching d’Aya et Camélia

Deux pages autonomes, une par athlète, avec programme sport, nutrition, suivi du poids et coach.

| Dossier | Projet Vercel | Contenu |
|---|---|---|
| `aya/` | `vestiaire-aya` | page d’Aya |
| `camelia/` | `vestiaire-camelia` | page de Camélia |
| `src/` | — | modèle commun et script de génération |
| `supabase/` | — | base de données (migration) et fonction `coach` |

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

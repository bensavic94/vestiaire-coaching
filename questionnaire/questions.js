/* Le Vestiaire : questions du bilan d'inscription.
   Pour ajouter / modifier une question : changer ce fichier, commit, push. Vercel redéploie tout seul.
   type : text | email | tel | number | date | textarea | choix (une réponse) | multi (plusieurs) | echelle (1 à 10)
   si : la question n'apparaît que si la condition est vraie. autre : ajoute un champ « Précise ». */
const SB_URL = "https://cmnsivebunxyscohsfdp.supabase.co";
const SB_KEY = "sb_publishable_SktPKMvnU1Qk0SV4VK97Cg_S5Idojyk";

const SECTIONS = [
  {
    id: "toi", titre: "Toi", sous: "Les bases pour te connaître.",
    champs: [
      { k: "prenom", label: "Prénom", type: "text", requis: true, auto: "given-name" },
      { k: "nom", label: "Nom", type: "text", auto: "family-name" },
      { k: "email", label: "E-mail", type: "email", requis: true, auto: "email" },
      { k: "tel", label: "Téléphone (WhatsApp)", type: "tel", auto: "tel", aide: "Pour t'envoyer ton programme et faire le point." },
      { k: "sexe", label: "Tu es", type: "choix", requis: true, options: ["Une femme", "Un homme"] },
      { k: "age", label: "Âge", type: "number", unite: "ans", requis: true, min: 14, max: 90 },
      { k: "taille", label: "Taille", type: "number", unite: "cm", requis: true, min: 120, max: 230, placeholder: "165" },
      { k: "poids", label: "Poids actuel", type: "number", unite: "kg", requis: true, min: 30, max: 300, step: 0.1 },
      { k: "tour_taille", label: "Tour de taille (au nombril)", type: "number", unite: "cm", min: 40, max: 200, aide: "Facultatif, mais c'est un super repère pour suivre tes progrès." },
      { k: "metier", label: "Ton quotidien au travail", type: "choix", requis: true,
        options: ["Assis la plupart du temps", "Debout / je marche pas mal", "Travail physique", "Étudiant(e)", "Sans emploi / à la maison"] },
      { k: "pas", label: "Combien de pas par jour environ ?", type: "choix",
        options: ["Moins de 3 000", "3 000 à 6 000", "6 000 à 10 000", "Plus de 10 000", "Je ne sais pas"] },
    ]
  },
  {
    id: "objectif", titre: "Ton objectif", sous: "Ce que tu veux vraiment, avec tes mots.",
    champs: [
      { k: "objectif", label: "Ton objectif principal", type: "choix", requis: true,
        options: ["Perdre du gras / du poids", "Prendre du muscle", "Les deux : affiner et tonifier", "Retrouver la forme et l'énergie", "Préparer un événement (mariage, vacances…)", "Améliorer une performance sportive"] },
      { k: "poids_vise", label: "Poids visé (si tu en as un)", type: "number", unite: "kg", min: 30, max: 300, step: 0.1 },
      { k: "zones", label: "Les zones que tu veux travailler en priorité", type: "multi",
        options: ["Ventre", "Fessiers", "Cuisses", "Bras", "Dos", "Épaules", "Pectoraux", "Silhouette en général"] },
      { k: "a_eviter", label: "Ce que tu ne veux surtout PAS", type: "textarea",
        placeholder: "Ex. : ne pas trop développer les cuisses, ne pas perdre ma poitrine…" },
      { k: "evenement", label: "As-tu une date importante en tête ?", type: "choix", options: ["Oui", "Non"] },
      { k: "evenement_quoi", label: "Laquelle ?", type: "text", si: d => d.evenement === "Oui", placeholder: "Ex. : essayage de robe, mariage, vacances" },
      { k: "evenement_date", label: "Date", type: "date", si: d => d.evenement === "Oui" },
      { k: "resultat", label: "Décris le résultat physique que tu imagines", type: "textarea", requis: true,
        placeholder: "Ex. : perdre du ventre, avoir des fessiers plus galbés, retrouver un corps équilibré…" },
      { k: "pourquoi", label: "Pourquoi maintenant ?", type: "textarea", placeholder: "Ce qui t'a donné envie de te lancer." },
      { k: "motivation", label: "Ta motivation aujourd'hui", type: "echelle", requis: true, bas: "Bof", haut: "À fond" },
    ]
  },
  {
    id: "parcours", titre: "Ton parcours", sous: "D'où tu pars, pour aller au bon rythme.",
    champs: [
      { k: "experience", label: "Ton expérience en sport", type: "choix", requis: true,
        options: ["Jamais vraiment pratiqué", "Débutant(e) : moins de 6 mois", "Intermédiaire : 6 mois à 2 ans", "Confirmé(e) : plus de 2 ans"] },
      { k: "sports", label: "Ce que tu pratiques ou as pratiqué", type: "text", placeholder: "Ex. : muscu 3 ans, danse, course à pied…" },
      { k: "poids_max", label: "Ton poids le plus élevé (adulte)", type: "number", unite: "kg", min: 30, max: 300, step: 0.1 },
      { k: "poids_min", label: "Ton poids le plus bas (adulte)", type: "number", unite: "kg", min: 30, max: 300, step: 0.1 },
      { k: "regimes", label: "Régimes ou programmes déjà essayés", type: "textarea", placeholder: "Ce qui a marché, ce qui n'a pas marché, et pourquoi." },
      { k: "difficultes", label: "Tes plus grosses difficultés", type: "multi", autre: true,
        options: ["Rester régulier(e)", "Grignotage", "Manque de temps", "Manque d'énergie", "Fringales le soir", "Week-ends / sorties", "Essoufflement", "Je ne sais pas quoi faire à la salle"] },
    ]
  },
  {
    id: "sante", titre: "Santé & récupération", sous: "Pour que le programme soit sûr pour toi.",
    champs: [
      { k: "blessures", label: "Blessures, douleurs ou opérations", type: "textarea", placeholder: "Ex. : genou fragile, mal de dos, épaule opérée… Écris « aucune » si rien." , requis: true },
      { k: "pathologies", label: "Problèmes de santé", type: "multi", autre: true,
        options: ["Aucun", "Diabète", "Hypertension", "Asthme", "Problème cardiaque", "Thyroïde", "SOPK", "Endométriose", "Cholestérol"] },
      { k: "medicaments", label: "Traitement ou médicaments en cours", type: "text", placeholder: "Facultatif" },
      { k: "grossesse", label: "Es-tu enceinte, ou as-tu accouché / allaites-tu depuis moins d'un an ?", type: "choix",
        options: ["Non", "Enceinte", "Post-partum / allaitement"], si: d => d.sexe === "Une femme" },
      { k: "avis_medical", label: "Un médecin t'a-t-il déjà déconseillé le sport ?", type: "choix", requis: true, options: ["Non", "Oui"] },
      { k: "sommeil_h", label: "Tu dors combien d'heures par nuit ?", type: "choix", requis: true,
        options: ["Moins de 6 h", "6 à 7 h", "7 à 8 h", "Plus de 8 h"] },
      { k: "sommeil_q", label: "Qualité de ton sommeil", type: "echelle", bas: "Mauvaise", haut: "Excellente" },
      { k: "stress", label: "Ton niveau de stress en ce moment", type: "echelle", bas: "Zen", haut: "Très stressé(e)" },
    ]
  },
  {
    id: "sport", titre: "Entraînement", sous: "Comment, où et quand tu peux t'entraîner.",
    champs: [
      { k: "seances", label: "Combien de séances par semaine ?", type: "choix", requis: true, options: ["2", "3", "4", "5", "6"] },
      { k: "duree", label: "Durée possible par séance", type: "choix", requis: true, options: ["30 min", "45 min", "1 h", "1 h 30"] },
      { k: "lieu", label: "Où vas-tu t'entraîner ?", type: "multi", requis: true, options: ["En salle", "À la maison", "Dehors"] },
      { k: "materiel", label: "Le matériel que tu as à la maison", type: "multi", si: d => (d.lieu || []).includes("À la maison"), autre: true,
        options: ["Rien du tout", "Tapis", "Haltères", "Élastiques", "Kettlebell", "Banc", "Barre de traction", "Vélo / tapis de course"] },
      { k: "jours", label: "Tes jours disponibles", type: "multi", requis: true, options: ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] },
      { k: "moment", label: "Le moment de la journée", type: "choix", options: ["Matin", "Midi", "Après-midi", "Soir", "Ça varie"] },
      { k: "aime", label: "Ce que tu aimes faire", type: "multi", autre: true,
        options: ["Musculation", "Cardio sur machine", "Tapis incliné", "HIIT / circuits", "Course à pied", "Cours collectifs", "Natation", "Vélo", "Pilates / yoga", "Pas de préférence"] },
      { k: "deteste", label: "Ce que tu détestes (on évitera)", type: "text", placeholder: "Ex. : les burpees, courir…" },
    ]
  },
  {
    id: "nutrition", titre: "Nutrition", sous: "Pour un plan que tu peux vraiment suivre, avec ton budget.",
    champs: [
      { k: "repas", label: "Combien de repas par jour aujourd'hui ?", type: "choix", requis: true, options: ["1", "2", "3", "4 ou plus"] },
      { k: "petit_dej", label: "Prends-tu un petit-déjeuner ?", type: "choix", options: ["Oui, toujours", "Parfois", "Jamais"] },
      { k: "journee_type", label: "Décris ce que tu manges sur une journée type", type: "textarea", requis: true,
        placeholder: "Matin : …\nMidi : …\nSoir : …\nEntre les repas : …" },
      { k: "regime", label: "Ton régime alimentaire", type: "multi", requis: true, autre: true,
        options: ["Je mange de tout", "Halal", "Sans porc", "Végétarien", "Végan", "Pescétarien", "Casher", "Sans gluten (choix)"] },
      { k: "allergies", label: "Allergies ou intolérances", type: "multi", requis: true, autre: true,
        options: ["Aucune", "Lactose", "Gluten", "Arachides", "Fruits à coque", "Œufs", "Poisson", "Crustacés / fruits de mer", "Soja", "Sésame"] },
      { k: "aime_manger", label: "Les aliments ou plats que tu adores", type: "textarea", placeholder: "On s'en servira pour tes repas." },
      { k: "deteste_manger", label: "Les aliments que tu ne manges pas / n'aimes pas", type: "textarea" },
      { k: "budget", label: "Ton budget courses par semaine (pour toi seul(e))", type: "choix", requis: true,
        options: ["Moins de 30 €", "30 à 50 €", "50 à 70 €", "70 à 100 €", "Plus de 100 €"] },
      { k: "foyer", label: "Tu cuisines pour combien de personnes ?", type: "choix", options: ["Juste moi", "2", "3", "4 ou plus"] },
      { k: "courses_ou", label: "Où fais-tu tes courses ?", type: "multi", options: ["Discount (Lidl, Aldi…)", "Supermarché classique", "Marché", "Bio", "Drive / livraison", "Boucherie halal"] },
      { k: "cuisine_temps", label: "Le temps que tu peux passer en cuisine", type: "choix", requis: true,
        options: ["Moins de 15 min par repas", "15 à 30 min", "30 min et plus, j'aime cuisiner", "Je préfère tout préparer le dimanche (batch cooking)"] },
      { k: "exterieur", label: "Repas pris à l'extérieur / livrés par semaine", type: "choix", options: ["0", "1 à 2", "3 à 5", "Plus de 5"] },
      { k: "grignotage", label: "Tu grignotes ?", type: "choix", options: ["Jamais", "Parfois", "Souvent", "Tous les jours"] },
      { k: "sucre", label: "Boissons sucrées / sodas", type: "choix", options: ["Jamais", "Parfois", "Tous les jours"] },
      { k: "alcool", label: "Alcool", type: "choix", options: ["Jamais", "Occasionnellement", "Chaque week-end", "Plusieurs fois par semaine"] },
      { k: "eau", label: "Eau bue par jour", type: "choix", options: ["Moins de 1 L", "1 à 1,5 L", "1,5 à 2 L", "Plus de 2 L"] },
      { k: "complements", label: "Compléments que tu prends", type: "text", placeholder: "Ex. : whey, créatine, vitamines… ou aucun" },
      { k: "rapport_nourriture", label: "Ton rapport à la nourriture en ce moment", type: "choix",
        options: ["Serein", "Je mange mes émotions parfois", "Je culpabilise souvent", "C'est compliqué"], aide: "Aucune bonne ou mauvaise réponse : ça nous aide à adapter le plan." },
    ]
  },
  {
    id: "fin", titre: "Dernière étape", sous: "Presque fini !",
    champs: [
      { k: "remarques", label: "Autre chose à nous dire ?", type: "textarea", placeholder: "Contraintes, horaires décalés, Ramadan, questions…" },
      { k: "source", label: "Comment as-tu connu Le Vestiaire ?", type: "choix", options: ["Instagram", "TikTok", "Bouche-à-oreille", "Ben ou Kevin directement", "Autre"] },
      { k: "consentement", label: "J'accepte que Ben et Kevin utilisent ces informations, y compris celles sur ma santé, uniquement pour construire et suivre mon programme. Je peux demander leur suppression à tout moment.",
        type: "accord", requis: true },
    ]
  },
];

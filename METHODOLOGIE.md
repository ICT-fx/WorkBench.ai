# Méthodologie du hub d'évaluations métier

**Dernière mise à jour : 30 septembre 2026** · premier benchmark exécuté le 27/09/2026

Ce document décrit comment un benchmark est construit, comment une réponse de modèle
est vérifiée, ce qui a été mesuré, et **les erreurs commises qu'il ne faut pas
reproduire**. Il est destiné autant à Fantin qu'à toute session d'assistant qui
reprendrait ce projet.

---

# 1. Le protocole, en une phrase

On envoie un document réel à plusieurs modèles, on leur demande de remplir des cases
précises, et on compare leurs réponses à des réponses de référence écrites par des
humains — jamais par une IA.

## Le premier benchmark : lecture de factures

| | |
|---|---|
| **Jeu de données** | DeepForm — factures publicitaires télévisées déposées auprès du régulateur américain (FCC), étiquetées à la main par des journalistes |
| **Licence** | Dépôt distributeur sous licence MIT, documents sources issus d'archives publiques |
| **Documents** | 39 téléchargés, **19 retenus** dans le périmètre final |
| **Modèles** | **27**, de 0,0002 $ à 0,11 $ par facture |
| **Appels notés** | 513 (19 × 27) |
| **Coût réel** | 20,47 $, tentatives ratées comprises |
| **Run** | `data/runs/2026-09-27_facture-fcc/` |

## Comment un appel se déroule

1. Le PDF est converti en **une image par page** (MuPDF, niveaux de gris, JPEG qualité 82).
2. Les pages sont envoyées au modèle avec un prompt identique pour tous, via OpenRouter.
3. Le modèle répond en JSON. On extrait l'objet même s'il l'encadre de commentaires.
4. On enregistre la réponse **brute**, la version exacte du modèle, l'hébergeur qui a
   servi l'appel, les jetons consommés, le coût et la latence.
5. Le fichier de réponse n'est **jamais** réécrit. La notation est une étape séparée.

Cette séparation est essentielle : changer le barème six mois plus tard ne coûte aucun
appel, et les scores restent comparables dans le temps.

---

# 2. Comment on vérifie une réponse

C'est la question centrale. Demander quelque chose à une IA est facile ; savoir si elle
a raison est tout le problème.

## La vérité terrain ne vient jamais d'une IA

Les réponses de référence proviennent des étiquettes de DeepForm, saisies à la main par
des journalistes à partir des documents. **Aucun modèle n'évalue un autre modèle.** Si un
jour une tâche l'exige — résumé, rédaction — il faudra une grille écrite et une revue
humaine, et le dire explicitement.

## Chaque champ a sa règle de comparaison

| Type | Règle |
|---|---|
| `number` | Au centime. Lit `1 234,56`, `1.234,56 €`, `$1,880.00`. Un groupe de milliers ne commence jamais par zéro : `0,125` vaut 0,125, pas 125 |
| `date` | Normalisée en AAAA-MM-JJ. **La convention suit le pays du document** : `02/03` est le 3 février sur une facture américaine, le 2 mars sur une française. Une seule lecture est admise, sinon une inversion jour/mois deviendrait indétectable |
| `exact` | Identité après suppression des espaces, accents et ponctuation, et passage en minuscules |
| `lines` | Appariement des lignes, ordre indifférent, reformulation admise si les chiffres concordent. Score F1, correct au-delà de 0,9 |
| `text` | Tous les termes porteurs de sens doivent s'y retrouver, une abréviation valant le mot entier (`art.` ↔ `article`) |

Ces comparateurs sont couverts par une trentaine de tests unitaires
(`packages/eval/src/compare.test.ts`). Ils sont le cœur du projet : une erreur ici
fausse un classement entier sans jamais lever d'exception.

## Trois verdicts, pas deux

Pour chaque case :

- **correct**
- **faux ou manquant**
- **halluciné** — le modèle a produit une valeur là où le document n'en contient aucune

Le troisième est ce qui distingue ce hub des benchmarks classiques. Un chiffre inventé
coûte plus cher qu'un chiffre manquant : il passe la relecture.

## Les quatre mesures publiées

Jamais fondues en une note unique.

1. **Factures sans relecture** — part des documents dont aucun champ critique n'est faux
2. **Exactitude pondérée** — points obtenus / points possibles, chaque champ pesé par sa criticité métier
3. **Hallucinations** — champs inventés / champs réellement absents
4. **Coût et latence** — par document, latence en médiane et non en moyenne (un seul appel lent fausserait la moyenne)

## Les vérifications faites au-delà de la notation

La notation seule ne suffit pas. Ce qui a été contrôlé, et qu'il faut refaire :

- **Inspection visuelle des documents rendus.** Ouvrir plusieurs images et vérifier que le
  texte fin est lisible. Une conversion ratée produirait des scores catastrophiques pour
  tout le monde sans qu'on sache pourquoi.
- **Vérification de l'hypothèse du champ sonde.** Avant d'affirmer qu'aucune facture ne
  porte de numéro de TVA, la couche texte des 39 PDF a été fouillée : zéro occurrence de
  « VAT », « TVA », « IBAN », « SIRET ». Une hypothèse vérifiée, pas supposée.
- **Répartition des erreurs par champ.** C'est ce contrôle qui a révélé que le classement
  initial était un artefact (voir § 4).
- **Comparaison de deux classements.** Calculer le classement sur tous les champs, puis
  sur les seuls champs non ambigus. S'ils diffèrent, c'est qu'on mesure la question posée
  et non la compétence.
- **Contrôle des totaux facturés.** Comparer le coût suivi par le pipeline au solde réel
  du fournisseur. Un écart signale des dépenses invisibles.

---

# 3. Les résultats du 27 septembre 2026

## Ce qui est solide

**Sur les trois champs non ambigus — montant total, date de fin, numéro de TVA —
vingt modèles sur vingt-sept font un sans-faute sur les 19 factures.**

Quatre modèles décrochent :

| Modèle | Exactitude (champs fiables) | Coût par facture |
|---|---:|---:|
| `amazon/nova-pro-v1` | 64,0 % | 0,0056 $ |
| `amazon/nova-lite-v1` | 79,8 % | 0,0004 $ |
| `google/gemma-4-31b-it` | 86,8 % | 0,0002 $ |
| `mistralai/mistral-large-2512` | 89,5 % | 0,0040 $ |

**Aucune hallucination : 513 occasions, zéro invention.** Sur un champ clairement absent
du document, les modèles testés s'abstiennent correctement. L'hypothèse de départ —
« beaucoup vont inventer » — est fausse pour cette génération de modèles.

**L'écart de prix ne se retrouve pas dans les résultats.** `gpt-6-astra` à 0,1092 $ la
facture et `gemini-3.5-flash-lite` à 0,0017 $ sont tous deux à 100 % sur les champs
fiables. Un facteur 64 en prix, aucun écart mesurable en qualité sur cette tâche.

## Ce qui ne l'est pas

Le classement calculé sur les six champs plaçait Qwen et GLM devant Claude et GPT.
**C'est un artefact**, et il ne doit pas être publié. Explication au paragraphe suivant.

## Répartition des erreurs par champ

| Champ | Taux d'erreur | Diagnostic |
|---|---:|---|
| `contract_num` | 47,4 % | **Ambigu** : ces factures portent six identifiants (Contract #, Order #, Invoice #, Estimate #, Alt Order #, Agency Order #) |
| `flight_from` | 24,2 % | **Ambigu** : le document affiche « Flight Dates » et « Invoice Period » |
| `advertiser` | 21,1 % | **Partiellement ambigu** : « Advertiser » et « Product » se ressemblent |
| `flight_to` | 6,2 % | Fiable |
| `gross_amount` | 3,5 % | Fiable |
| `vat_number` | 0 % | Fiable (champ sonde) |

---

# 4. Les erreurs commises, à ne pas reproduire

Chacune a coûté du temps ou de l'argent. Elles sont listées avec la règle qui en découle.

## Sur la méthode

**Un prompt ambigu mesure la devinette, pas la compétence.**
Demander « le numéro de contrat » sur un document qui en porte six revient à mesurer si
le modèle devine ce qu'on voulait. → **Nommer l'étiquette exacte imprimée sur le
document.** Avant de lancer, ouvrir trois documents et vérifier qu'un humain trouverait
une seule réponse possible pour chaque champ demandé.

**Un `null` produit par notre code est un piège imaginaire.**
Cinq dates que le code ne savait pas lire (`February 12, 2020`, `May12/20`) étaient
devenues `null`, donc « absent du document ». Un modèle lisant correctement la date
aurait été accusé d'hallucination. → **Une valeur présente mais illisible arrête la
préparation.** Elle ne devient jamais un `null` silencieux.

**Vérifier une hypothèse avant de bâtir dessus.**
L'angle « qui invente » supposait des champs absents. Il n'y en avait aucun une fois les
dates correctement lues. → **Compter les cas avant de promettre un résultat.**

**Comparer deux classements avant de publier.**
Calculer le classement sur tous les champs puis sur les seuls champs non ambigus. S'ils
divergent, le benchmark mesure autre chose que ce qu'on croit.

## Sur les données

**Les images doivent être de poids comparable.**
Certains PDF ont des pages de 11,4 millions de pixels contre 1,4 pour les autres, soit
huit fois plus cher pour tous les modèles, et au-delà des limites de certains
fournisseurs. → **Plafonner la taille de page au rendu**, et pas seulement filtrer après
coup.

**Les limites des fournisseurs s'appliquent à tout le monde.**
Mistral refuse plus de 8 images par requête ; Cohere plafonne à 20 millions de pixels.
→ **Écarter les documents concernés pour tous les modèles**, jamais pour un seul. Un
classement compare des modèles, pas des sous-ensembles de documents.

**Ne pas commiter d'images sans les regarder.**
156 Mo de PNG sont entrés dans l'historique git d'un coup. → **Rendre en JPEG niveaux de
gris**, et vérifier le poids avant de commiter.

## Sur l'exécution et l'argent

**Deux appels simultanés au maximum.**
À huit, OpenRouter réserve d'avance plus de crédit que le compte n'en a de disponible et
refuse tout : **419 appels perdus** sur un premier run. Un seul appel à la fois lorsque
les quotas par minute se déclenchent.

**Les échecs sont facturés.**
Un modèle qui réfléchit puis rend une réponse vide a consommé des jetons, facturés. Ne
pas les enregistrer a produit un écart de 1,27 $ entre le compteur et la réalité.
→ **Enregistrer le coût même en cas d'échec.**

**Un refus 402 recouvre deux situations opposées.**
« Les appels en cours réservent le crédit » se règle en patientant. « Le coût maximal de
cette requête dépasse le crédit disponible » ne se règle qu'en rechargeant. Les confondre
a fait tourner un run **une heure à vide**. → Ne réessayer que le premier.

**L'ordre des filtres de périmètre compte.**
`--limit` désigne les N premiers documents du tirage, `--max-pages` et `--max-pixels`
écartent ensuite les trop lourds. Dans l'autre sens, **treize documents hors périmètre**
sont entrés dans un run payant. → Le périmètre est calculé par une fonction unique,
partagée par le run et la notation.

**Chiffrer avant de dépenser, et annoncer le chiffre.**
`npm run eval:run -- --estimate` ne passe aucun appel. Le coût réel a dérivé de 13,92 $ à
16,23 $ puis 19,15 $ au fil des mesures : chaque révision doit être annoncée avant de
lancer.

---

# 5. Limites du benchmark, à afficher sur le site

- Factures publicitaires américaines, pas des factures fournisseurs françaises.
- **19 documents** : deux modèles séparés par quelques points ne sont pas départageables.
- Documents envoyés en **images** alors que les PDF ont une couche texte : le test est
  plus difficile que la réalité d'un PDF natif.
- Vérité terrain héritée des annotateurs de DeepForm, avec leurs erreurs éventuelles.
  Les 73 documents qu'ils ont eux-mêmes signalés sont écartés.
- Documents de plus de 8 pages ou de plus de 20 millions de pixels écartés, à cause de
  limites de fournisseurs.
- Un seul prompt par modèle, aucun ajustement fin, aucun OCR spécialisé en amont.

---

# 6. Ce qu'il faut faire ensuite

1. **Durcir la tâche.** L'extraction de cinq champs d'en-tête est trop facile : vingt
   modèles sont à égalité parfaite. La difficulté réelle est dans les **lignes de
   facturation**, ce tableau détaillé que DeepForm n'annote pas. Il faudra construire
   notre propre vérité terrain.
2. **Reprendre le prompt** en nommant les étiquettes exactes, si l'on veut réutiliser les
   champs ambigus.
3. **Étape d'arbitrage humain** (`npm run eval:review`), jamais exécutée à ce jour. Elle
   soumet les hallucinations, les écarts d'écriture et un échantillon de contrôle.
4. **Épingler l'hébergeur** une fois qu'on sait lesquels servent bien chaque modèle.
   L'hébergeur est déjà enregistré à chaque appel.

---

# 7. Commandes

```bash
npm run key:check                    # la clé OpenRouter fonctionne-t-elle, et reste-t-il du crédit
npm run deepform:prepare -- --n 40   # télécharger et préparer les documents
npm run eval:run -- --task facture-fcc --estimate          # coût prévu, sans aucun appel
npm run eval:run -- --task facture-fcc --run <id> --limit 25 --max-pages 8 --max-pixels 20000000
npm run eval:score -- --task facture-fcc --run <id> --limit 25 --max-pages 8 --max-pixels 20000000
npm run eval:review -- --run <id>    # arbitrage humain
npm run eval:publish -- --run <id>   # fige le classement publié
```

Le run se reprend avec `--resume` : aucun appel déjà payé n'est repayé.

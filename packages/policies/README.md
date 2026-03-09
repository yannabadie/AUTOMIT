# packages/policies/ -- Fichiers de politiques AutomIT

Politiques YAML chargees par le policy engine du control plane TypeScript.
Elles definissent les regles de securite et de gouvernance appliquees a chaque
action demandee par l'agent LLM.

## Fichiers

### tier-definitions.yml

Definit les 4 niveaux d'action (Tier 0-3), chacun mappe sur un droit GLPI
et un type d'approbation :

- **Tier 0** : Lecture seule (read_ticket, search_kb) -- aucune approbation
- **Tier 1** : Operations reversibles sur tickets (add_followup, create_task) -- approbation simple
- **Tier 2** : Actions externes bornees (restart_erp_job, send_mail) -- approbation simple + politique
- **Tier 3** : Actions destructives (disable_ad_user, offboard_user) -- double approbation

### cooldown-rules.yml

Regles anti-repetition pour empecher l'execution en rafale d'une meme action.
Chaque type d'action a un intervalle minimum et un plafond par heure, scopes
par `target.id`. Exemples : `restart_erp_job` limite a 3/h avec 15 min minimum,
`disable_ad_user` limite a 1/h.

### redaction-rules.yml

Patterns de redaction appliques avant toute reponse publique dans GLPI.
Filtre les adresses IP, credentials, hostnames internes, stack traces et
mots-cles d'infrastructure (docker.sock, sa_password, .env, etc.).

## Chargement

Le control plane charge ces fichiers au demarrage via le module policy engine.
Chaque appel d'outil est valide contre les tier definitions, les cooldowns,
et les reponses sont filtrees par les regles de redaction avant publication.

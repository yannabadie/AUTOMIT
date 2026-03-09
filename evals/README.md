# evals/ -- Evaluation et tests AutomIT

## e2e-test.sh

Script de test d'integration end-to-end en 4 etapes :

1. **Health checks** : Verifie que Kestra, le control plane et le tool gateway repondent
2. **Tool Gateway endpoints** : Teste les routes ERP (liste des jobs, statut d'un job)
3. **Control Plane HMAC** : Envoie une requete signee HMAC-SHA256 au endpoint `/analyze`
4. **Emergency stop** : Teste le kill switch via `/kill` avec token admin

Le script sort en `exit 1` si un test echoue. Variables configurables :
`AUTOMIT_HMAC_SECRET` et `AUTOMIT_ADMIN_TOKEN`.

## datasets/

Repertoire reserve pour les jeux de donnees d'evaluation (scenarios de tickets,
metriques de qualite des reponses agent).

## red-team/

Repertoire reserve pour les tests adversariaux (prompt injection, escalade
de privileges, contournement des politiques de securite).

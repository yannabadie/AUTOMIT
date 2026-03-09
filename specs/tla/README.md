# ActionLifecycle -- Specification formelle TLA+

Specification formelle de la machine a etats du cycle de vie des actions AutomIT, verifiable par le model checker TLC.

## Ce que le modele specifie

La specification `ActionLifecycle.tla` modelise le cycle de vie complet d'une action d'automatisation IT, depuis sa proposition jusqu'a sa completion, son echec, son rollback ou son expiration. Elle encode les regles d'approbation par tiers (L0-L3), le verrouillage exclusif des cibles et l'arret d'urgence.

## Diagramme de transitions

```
                          +---> expired
                          |
   idle ---> proposed ----+---> approved ---> executing ---> completed ---> rolled_back
                  |                               |
                  |                               +-------> failed
                  |
                  +--- [Tier 0-1] AutoApprove
                  +--- [Tier 2-3] HumanApprove (approbateur != demandeur)
                        [Tier 3]  DualApprove  (second approbateur distinct)
```

### Etats

| Etat | Signification |
|------|---------------|
| `idle` | Aucune action en cours pour cet identifiant |
| `proposed` | Action soumise par un technicien, en attente d'approbation |
| `approved` | Action approuvee (auto pour T0-T1, humaine pour T2-T3), prete a s'executer |
| `executing` | Action en cours d'execution, cible verrouilles |
| `completed` | Execution terminee avec succes |
| `failed` | Execution echouee, verrou de cible libere |
| `rolled_back` | Action annulee apres completion (retour arriere) |
| `expired` | Action proposee mais jamais approuvee dans le delai imparti |

### Regles d'approbation par tier

| Tier | Approbation | Exemple AutomIT |
|------|-------------|-----------------|
| 0 | Automatique, sans approbation | Collecte de metriques, health-check |
| 1 | Automatique, pre-approuvee | Redemarrage de job ERP echoue (L1) |
| 2 | Approbation humaine simple (approbateur != demandeur) | Desactivation compte AD compromis (L2) |
| 3 | Double approbation humaine (deux approbateurs distincts du demandeur) | Operations break-glass, modifications critiques (L3) |

## Invariants de surete verifies

1. **TypeInvariant** -- Toutes les variables restent dans leurs domaines attendus.
2. **NoUnapprovedTier2** -- Aucune action de Tier 2 ou superieur ne peut etre en execution sans approbation par une personne differente du demandeur.
3. **NoTargetConflict** -- Deux actions ne peuvent pas s'executer simultanement sur la meme cible (verrouillage exclusif).

## Execution du model checker TLC

### Prerequis

Installer les outils TLA+ :
- [TLA+ Toolbox](https://lamport.azurewebsites.net/tla/toolbox.html) (GUI)
- Ou directement le JAR TLC : `tla2tools.jar`

### Ligne de commande

```bash
# Depuis ce repertoire
java -jar /chemin/vers/tla2tools.jar -config ActionLifecycle.cfg ActionLifecycle.tla
```

Ou avec le script `tlc` si installe :

```bash
tlc ActionLifecycle.tla
```

### Depuis TLA+ Toolbox

1. Ouvrir `ActionLifecycle.tla` dans le Toolbox
2. Creer un nouveau modele (Model > New Model)
3. Configurer les constantes comme dans `ActionLifecycle.cfg`
4. Cocher les invariants `TypeInvariant`, `NoUnapprovedTier2`, `NoTargetConflict`
5. Lancer le model checker (TLC)

### Configuration du modele

Le fichier `ActionLifecycle.cfg` definit un modele reduit pour la verification :
- **2 actions** (`a1`, `a2`) -- suffisant pour detecter les conflits de cibles
- **1 cible** (`t1`) -- verifie le verrouillage exclusif
- **2 techniciens** (`tech1`, `tech2`) -- couvre les cas demandeur/approbateur
- **2 approbateurs** (`app1`, `app2`) -- necessaire pour la double approbation Tier 3

Augmenter ces ensembles accroit l'espace d'etats de maniere exponentielle. Le modele reduit est suffisant pour verifier les proprietes de surete.

## Correspondance avec l'architecture AutomIT

| Concept TLA+ | Implementation AutomIT |
|---------------|------------------------|
| `Propose` | ZeroClaw detecte un incident et propose une action |
| `AutoApprove` | Actions L1 pre-approuvees dans `config.toml` allowlist |
| `HumanApprove` | Kestra Pause + validation GLPI CommonITILValidation |
| `DualApprove` | Kestra break-glass avec second approbateur |
| `BeginExecute` | Kestra declenche l'execution Docker isolee |
| `Complete` / `Fail` | Resultat de l'execution du flow Kestra |
| `Rollback` | Flow de rollback Kestra declenche manuellement |
| `EmergencyStop` | Kill switch global (coupe toute nouvelle execution) |
| `target_locks` | Mutex Kestra sur les cibles (evite les conflits) |

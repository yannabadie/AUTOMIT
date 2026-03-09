# Plugin GLPI AutomIT

Panneau IA integre dans la vue ticket GLPI. Le plugin ajoute un onglet **AutomIT** sur chaque ticket de l'interface centrale, permettant l'analyse automatique, la redaction de brouillons de reponse et la proposition d'actions de remediation via le control plane AutomIT.

## Compatibilite

- **GLPI** 10.0.14+ (migration 11.0.6 prevue)
- **PHP** 8.1+
- **MySQL/MariaDB** avec InnoDB et `utf8mb4`

## Fonctionnalites

### Lane A — Analyse et redaction

- **Analyze ticket** : envoie le contexte du ticket au control plane, retourne une analyse structuree
- **Draft response** : genere un brouillon de note privee et/ou de reponse publique, editable avant insertion

### Lane B — Action cards

- **Propose actions** : le control plane renvoie des cartes d'action (restart service, disable account, etc.) avec tier, cible, justification et rollback
- Les actions Tier 0-1 sont executables directement ; Tier 2+ necessite la gouvernance Phase 5

### Droits (3 niveaux)

| Droit | Champ profil | Perimetre |
|-------|-------------|-----------|
| **use** | `plugin_automit_use` | Voir l'onglet, lancer analyse et draft |
| **execute** | `plugin_automit_execute` | Proposer et executer des actions Tier 1-2 |
| **critical** | `plugin_automit_critical` | Executer des actions Tier 3 (critique) |

### Configuration admin

Accessible via **Configuration > AutomIT** (`front/config.form.php`) :

- **Control Plane URL** : endpoint du backend AutomIT (defaut `http://localhost:3001`)
- **HMAC Secret** : cle partagee pour signer les requetes
- **Emergency Stop** : coupe-circuit — desactive toutes les actions, conserve l'analyse seule

## Installation

1. Copier le dossier `automit/` dans `<GLPI_ROOT>/plugins/`
2. Dans GLPI : **Configuration > Plugins** — installer puis activer **AutomIT**
3. Configurer l'URL du control plane et le secret HMAC dans **Configuration > AutomIT**
4. Attribuer les droits par profil dans **Administration > Profils > AutomIT**

## Arborescence

```
automit/
├── setup.php              # Enregistrement plugin, version, hooks CSS/JS/tab
├── hook.php               # Install (creation tables SQL) / uninstall (drop)
├── front/
│   └── config.form.php    # Page admin : sauvegarde config
├── inc/
│   ├── config.class.php   # Modele config (URL, HMAC, emergency stop)
│   ├── profile.class.php  # 3 droits : use, execute, critical
│   └── ticketpanel.class.php  # Onglet ticket : boutons + rendu panel
├── ajax/
│   └── analyze.php        # Endpoint AJAX : proxy signe vers control plane
├── js/
│   └── automit.js         # Frontend : appels fetch, rendu draft + action cards
├── css/
│   └── automit.css        # Styles du panneau
└── install/
    └── sql/
        └── install.sql    # Tables : glpi_plugin_automit_actions, _configs
```

## Authentification HMAC

Chaque requete AJAX vers le control plane est signee cote serveur :

1. Le payload JSON inclut `ticket_id`, `mode`, `user_id`, `profile`, `entity`, `timestamp` et un `ticket_hash`
2. La signature HMAC-SHA256 est calculee avec le secret stocke en base (`glpi_plugin_automit_configs`)
3. Le header `X-AutomIT-Signature` est envoye avec la requete POST
4. Le control plane verifie la signature avant traitement

Le secret HMAC n'est jamais expose cote client — toute communication passe par `ajax/analyze.php` (server-side).

## Licence

GPLv3+ — Yann Abadie, Motherson Aerospace.

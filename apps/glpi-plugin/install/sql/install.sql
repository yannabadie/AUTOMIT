CREATE TABLE IF NOT EXISTS `glpi_plugin_automit_actions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `tickets_id` int unsigned NOT NULL,
  `action_id` varchar(255) NOT NULL,
  `tier` tinyint NOT NULL DEFAULT 0,
  `target_type` varchar(100) NOT NULL,
  `target_id` varchar(255) NOT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'proposed',
  `requestor_id` int unsigned NOT NULL,
  `approver_id` int unsigned DEFAULT NULL,
  `approval_type` varchar(50) DEFAULT NULL,
  `approved_at` TIMESTAMP NULL DEFAULT NULL,
  `justification` text DEFAULT NULL,
  `idempotency_key` varchar(36) NOT NULL,
  `receipt_json` text DEFAULT NULL,
  `date_creation` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `date_mod` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idempotency_key` (`idempotency_key`),
  KEY `tickets_id` (`tickets_id`),
  KEY `idx_action_id` (`action_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `glpi_plugin_automit_configs` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `control_plane_url` varchar(500) NOT NULL DEFAULT 'http://localhost:3001',
  `hmac_secret` varchar(255) NOT NULL DEFAULT '',
  `emergency_stop` tinyint NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `glpi_plugin_automit_configs` (`id`, `control_plane_url`, `hmac_secret`)
VALUES (1, 'http://localhost:3001', '')
ON DUPLICATE KEY UPDATE `id` = `id`;

<?php
include('../../../inc/includes.php');

header('Content-Type: application/json');

Session::checkLoginUser();

// CSRF mitigation: require JSON content type (browsers don't send application/json in simple CORS requests)
$content_type = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($content_type, 'application/json') === false) {
    http_response_code(400);
    echo json_encode(['error' => 'Content-Type must be application/json']);
    exit;
}

// Central interface only
if (Session::getCurrentInterface() !== 'central') {
    http_response_code(403);
    echo json_encode(['error' => 'Central interface required']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !isset($input['action_id'], $input['ticket_id'], $input['tier'])) {
    http_response_code(400);
    echo json_encode(['error' => 'action_id, ticket_id, and tier required']);
    exit;
}

$ticket_id = intval($input['ticket_id']);
if ($ticket_id <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid ticket_id']);
    exit;
}

$tier = intval($input['tier']);

// Generate idempotency key once and reuse everywhere
$idempotency_key = $input['idempotency_key'] ?? sprintf('%s-%s', uniqid('', true), bin2hex(random_bytes(4)));

// Rights check based on tier
if ($tier >= 1 && !Session::haveRight('plugin_automit_execute', READ)) {
    http_response_code(403);
    echo json_encode(['error' => 'Missing plugin_automit_execute right']);
    exit;
}
if ($tier >= 2 && !Session::haveRight('plugin_automit_critical', READ)) {
    http_response_code(403);
    echo json_encode(['error' => 'Missing plugin_automit_critical right for Tier 2+']);
    exit;
}

// Declare $DB once at outer scope
global $DB;

// For Tier 2+, check GLPI validation status on the ticket
if ($tier >= 2) {
    $validation_ok = false;

    $iterator = $DB->request([
        'FROM' => 'glpi_ticketvalidations',
        'WHERE' => [
            'tickets_id' => $ticket_id,
            'status' => CommonITILValidation::ACCEPTED,
        ],
    ]);
    if (count($iterator) > 0) {
        $validation_ok = true;
    }

    if (!$validation_ok) {
        http_response_code(403);
        echo json_encode([
            'error' => 'Tier 2+ requires GLPI ticket validation (CommonITILValidation ACCEPTED)',
            'action' => 'Request validation on this ticket before executing',
        ]);
        exit;
    }
}

// Record action in plugin table
$DB->insert('glpi_plugin_automit_actions', [
    'tickets_id' => $ticket_id,
    'action_id' => $input['action_id'],
    'tier' => $tier,
    'target_type' => $input['target_type'] ?? '',
    'target_id' => $input['target_id'] ?? '',
    'status' => 'executing',
    'requestor_id' => Session::getLoginUserID(),
    'idempotency_key' => $idempotency_key,
    'justification' => $input['justification'] ?? '',
]);

// Forward to control plane with HMAC
$config_row = $DB->request(['FROM' => 'glpi_plugin_automit_configs', 'LIMIT' => 1])->current();
if (!$config_row) {
    http_response_code(500);
    echo json_encode(['error' => 'Plugin not configured']);
    exit;
}

$cp_url = $config_row['control_plane_url'] ?? 'http://localhost:3001';
$hmac_secret = $config_row['hmac_secret'] ?? '';
if (empty($hmac_secret)) {
    http_response_code(500);
    echo json_encode(['error' => 'HMAC secret not configured']);
    exit;
}

$payload = json_encode([
    'action' => [
        'action_id' => $input['action_id'],
        'tier' => $tier,
        'target' => [
            'type' => $input['target_type'] ?? 'glpi_ticket',
            'id' => strval($ticket_id),
            'display_name' => 'Ticket #' . $ticket_id,
        ],
        'requestor' => [
            'glpi_user_id' => Session::getLoginUserID(),
            'profile' => $_SESSION['glpiactiveprofile']['name'] ?? '',
            'entity' => $_SESSION['glpiactive_entity_name'] ?? '',
            'interface' => 'central',
            'right' => $tier >= 2 ? 'plugin_automit_critical' : 'plugin_automit_execute',
        ],
        'idempotency_key' => $idempotency_key,
        'ttl_seconds' => 300,
        'issued_at' => time(),
        'justification' => $input['justification'] ?? '',
    ],
    'timestamp' => time(),
]);

$signature = hash_hmac('sha256', $payload, $hmac_secret);

$ch = curl_init("$cp_url/execute");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        "X-AutomIT-Signature: $signature",
    ],
    CURLOPT_TIMEOUT => 30,
]);
$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_error = curl_error($ch);
curl_close($ch);

if ($response === false) {
    $response = json_encode(['error' => 'Control plane unreachable: ' . $curl_error]);
    $http_code = 502;
}

$result = json_decode($response, true) ?? ['error' => 'Control plane unreachable'];

// Update action status in DB
$status = ($http_code >= 200 && $http_code < 300) ? 'completed' : 'failed';
$DB->update('glpi_plugin_automit_actions', [
    'status' => $status,
    'receipt_json' => $response,
], ['action_id' => $input['action_id'], 'tickets_id' => $ticket_id]);

http_response_code($http_code ?: 500);
echo json_encode($result);

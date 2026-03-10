<?php
include('../../../inc/includes.php');
header('Content-Type: application/json');

Session::checkLoginUser();

if (Session::getCurrentInterface() !== 'central') {
    http_response_code(403);
    echo json_encode(['error' => 'Central interface required']);
    exit;
}
if (!Session::haveRight('plugin_automit_use', READ)) {
    http_response_code(403);
    echo json_encode(['error' => 'Missing plugin_automit_use right']);
    exit;
}

$ticket_id = (int)($_POST['ticket_id'] ?? 0);
$mode = $_POST['mode'] ?? 'analyze';

if (!in_array($mode, ['analyze', 'draft', 'propose_actions'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid mode']);
    exit;
}

if ($mode === 'propose_actions' && !Session::haveRight('plugin_automit_execute', READ)) {
    http_response_code(403);
    echo json_encode(['error' => 'Missing plugin_automit_execute right']);
    exit;
}

$ticket = new Ticket();
if (!$ticket->getFromDB($ticket_id)) {
    http_response_code(404);
    echo json_encode(['error' => 'Ticket not found']);
    exit;
}

$config = new PluginAutomitConfig();
if (!$config->getFromDB(1)) {
    http_response_code(500);
    echo json_encode(['error' => 'Plugin not configured']);
    exit;
}

$payload = [
    'ticket_id'   => $ticket_id,
    'mode'        => $mode,
    'user_id'     => Session::getLoginUserID(),
    'profile'     => $_SESSION['glpiactiveprofile']['name'] ?? '',
    'entity'      => $_SESSION['glpiactive_entity_name'] ?? '',
    'interface'   => 'central',
    'ticket_hash' => hash('sha256', json_encode($ticket->fields)),
    'timestamp'   => time(),
];

$payload_json = json_encode($payload);
$signature = hash_hmac('sha256', $payload_json, $config->fields['hmac_secret']);

$ch = curl_init($config->fields['control_plane_url'] . '/' . $mode);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload_json,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 120,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'X-AutomIT-Signature: ' . $signature,
    ],
]);
$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($http_code !== 200) {
    http_response_code(502);
    echo json_encode(['error' => 'Control plane error', 'status' => $http_code]);
    exit;
}

$decoded = json_decode($response, true);
if ($decoded === null && $response !== 'null') {
    http_response_code(502);
    echo json_encode(['error' => 'Invalid response from control plane']);
} else {
    echo json_encode($decoded);
}

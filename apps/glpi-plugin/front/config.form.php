<?php
include('../../../inc/includes.php');
Session::checkRight('config', UPDATE);

$config = new PluginAutomitConfig();

if (isset($_POST['update'])) {
    $url = $_POST['control_plane_url'] ?? '';
    if (!empty($url) && !filter_var($url, FILTER_VALIDATE_URL)) {
        Session::addMessageAfterRedirect(__('Invalid URL', 'automit'), false, ERROR);
        Html::back();
    }
    // Also block file:// and other dangerous schemes
    if (!empty($url) && !preg_match('#^https?://#i', $url)) {
        Session::addMessageAfterRedirect(__('Only HTTP/HTTPS URLs allowed', 'automit'), false, ERROR);
        Html::back();
    }
    $input = ['id' => 1, 'control_plane_url' => $url];
    if (!empty($_POST['hmac_secret'])) {
        $input['hmac_secret'] = $_POST['hmac_secret'];
    }
    $input['emergency_stop'] = isset($_POST['emergency_stop']) ? 1 : 0;
    $config->update($input);
    Html::back();
}

Html::header(__('AutomIT Configuration', 'automit'), $_SERVER['PHP_SELF'], 'config', 'PluginAutomitConfig');
$config->showConfigForm();
Html::footer();

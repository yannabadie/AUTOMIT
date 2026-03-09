<?php
include('../../../inc/includes.php');
Session::checkRight('config', UPDATE);

$config = new PluginAutomitConfig();

if (isset($_POST['update'])) {
    $input = ['id' => 1, 'control_plane_url' => $_POST['control_plane_url']];
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

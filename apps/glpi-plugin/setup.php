<?php
define('PLUGIN_AUTOMIT_VERSION', '1.0.0');
define('PLUGIN_AUTOMIT_MIN_GLPI', '10.0.14');

function plugin_init_automit() {
    global $PLUGIN_HOOKS;
    $PLUGIN_HOOKS['csrf_compliant']['automit'] = true;

    $plugin = new Plugin();
    if ($plugin->isInstalled('automit') && $plugin->isActivated('automit')) {
        $PLUGIN_HOOKS['add_css']['automit'] = 'css/automit.css';
        $PLUGIN_HOOKS['add_javascript']['automit'] = 'js/automit.js';
        Plugin::registerClass('PluginAutomitTicketPanel', ['addtabon' => ['Ticket']]);
        $PLUGIN_HOOKS['config_page']['automit'] = 'front/config.form.php';
        $PLUGIN_HOOKS['change_profile']['automit'] = ['PluginAutomitProfile', 'changeProfile'];
    }
}

function plugin_version_automit() {
    return [
        'name'         => 'AutomIT',
        'version'      => PLUGIN_AUTOMIT_VERSION,
        'author'       => 'Yann Abadie — Motherson Aerospace',
        'license'      => 'GPLv3+',
        'homepage'     => '',
        'requirements' => [
            'glpi' => ['min' => PLUGIN_AUTOMIT_MIN_GLPI],
            'php'  => ['min' => '8.1'],
        ],
    ];
}

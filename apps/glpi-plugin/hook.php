<?php
function plugin_automit_install() {
    global $DB;
    if (!$DB->tableExists('glpi_plugin_automit_actions')) {
        $DB->runFile(__DIR__ . '/install/sql/install.sql');
    }
    PluginAutomitProfile::createFirstAccess($_SESSION['glpiactiveprofile']['id']);
    return true;
}

function plugin_automit_uninstall() {
    global $DB;
    $tables = ['glpi_plugin_automit_actions', 'glpi_plugin_automit_configs'];
    foreach ($tables as $table) {
        if ($DB->tableExists($table)) {
            $DB->query("DROP TABLE `$table`");
        }
    }
    return true;
}

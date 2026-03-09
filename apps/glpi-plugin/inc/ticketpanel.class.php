<?php
class PluginAutomitTicketPanel extends CommonDBTM {
    static function getTypeName($nb = 0) {
        return __('AutomIT Copilot', 'automit');
    }

    function getTabNameForItem(CommonGLPI $item, $withtemplate = 0) {
        if (!($item instanceof Ticket)) return '';
        if (!Session::haveRight('plugin_automit_use', READ)) return '';
        if (Session::getCurrentInterface() !== 'central') return '';
        return __('AutomIT', 'automit');
    }

    static function displayTabContentForItem(CommonGLPI $item, $tabnum = 1, $withtemplate = 0) {
        if (!($item instanceof Ticket)) return false;
        $panel = new self();
        $panel->showForTicket($item);
        return true;
    }

    function showForTicket(Ticket $ticket) {
        $config = new PluginAutomitConfig();
        $config->getFromDB(1);

        $canAnalyze  = Session::haveRight('plugin_automit_use', READ);
        $canExecute  = Session::haveRight('plugin_automit_execute', READ);
        $canCritical = Session::haveRight('plugin_automit_critical', READ);
        $emergencyStop = (bool)($config->fields['emergency_stop'] ?? false);

        echo '<div id="automit-panel" data-ticket-id="' . $ticket->getID() . '">';

        if ($emergencyStop) {
            echo '<div class="alert alert-danger mb-3">';
            echo __('AutomIT is in emergency mode — analysis only, no actions.', 'automit');
            echo '</div>';
        }

        echo '<div class="automit-actions mb-3">';
        if ($canAnalyze) {
            echo '<button class="btn btn-outline-primary me-2" id="automit-analyze">';
            echo '<i class="fas fa-search"></i> ' . __('Analyze ticket', 'automit') . '</button>';
            echo '<button class="btn btn-outline-secondary me-2" id="automit-draft">';
            echo '<i class="fas fa-reply"></i> ' . __('Draft response', 'automit') . '</button>';
        }
        if ($canExecute && !$emergencyStop) {
            echo '<button class="btn btn-outline-warning" id="automit-propose-actions">';
            echo '<i class="fas fa-bolt"></i> ' . __('Propose actions', 'automit') . '</button>';
        }
        echo '</div>';

        echo '<div id="automit-results" class="d-none">';
        echo '<div id="automit-loading" class="text-center d-none"><div class="spinner-border"></div>';
        echo '<span class="ms-2">' . __('Analysis in progress...', 'automit') . '</span></div>';
        echo '<div id="automit-draft-output" class="d-none"></div>';
        echo '<div id="automit-action-cards" class="d-none"></div>';
        echo '</div>';
        echo '</div>';
    }
}

<?php
class PluginAutomitProfile extends Profile {
    static function getTypeName($nb = 0) {
        return __('AutomIT', 'automit');
    }

    static function getAllRights($all = false) {
        return [
            ['itemtype' => 'PluginAutomitTicketPanel',
             'label'    => __('Use AutomIT analysis', 'automit'),
             'field'    => 'plugin_automit_use'],
            ['itemtype' => 'PluginAutomitTicketPanel',
             'label'    => __('Execute actions (Tier 1-2)', 'automit'),
             'field'    => 'plugin_automit_execute'],
            ['itemtype' => 'PluginAutomitTicketPanel',
             'label'    => __('Execute critical actions (Tier 3)', 'automit'),
             'field'    => 'plugin_automit_critical'],
        ];
    }

    static function createFirstAccess($profiles_id) {
        $rights = ['plugin_automit_use' => READ];
        self::addDefaultProfileInfos($profiles_id, $rights);
    }

    static function changeProfile() {}
}

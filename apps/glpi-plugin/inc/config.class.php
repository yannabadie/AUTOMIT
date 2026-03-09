<?php
class PluginAutomitConfig extends CommonDBTM {
    static function getTypeName($nb = 0) {
        return __('AutomIT Configuration', 'automit');
    }

    function showConfigForm() {
        $this->getFromDB(1);
        echo '<form method="post" action="' . static::getFormURL() . '">';
        echo '<table class="tab_cadre_fixe">';
        echo '<tr class="tab_bg_1"><th colspan="2">' . __('AutomIT Settings', 'automit') . '</th></tr>';
        echo '<tr class="tab_bg_1"><td>' . __('Control Plane URL', 'automit') . '</td>';
        echo '<td><input type="text" name="control_plane_url" value="' . htmlspecialchars($this->fields['control_plane_url']) . '" size="60"></td></tr>';
        echo '<tr class="tab_bg_1"><td>' . __('HMAC Secret', 'automit') . '</td>';
        echo '<td><input type="password" name="hmac_secret" value="" size="60" placeholder="' . __('Leave empty to keep current', 'automit') . '"></td></tr>';
        echo '<tr class="tab_bg_1"><td>' . __('Emergency Stop', 'automit') . '</td>';
        echo '<td><input type="checkbox" name="emergency_stop" ' . ($this->fields['emergency_stop'] ? 'checked' : '') . '></td></tr>';
        echo '<tr class="tab_bg_2"><td colspan="2" class="center"><input type="submit" name="update" value="' . __('Save') . '" class="btn btn-primary"></td></tr>';
        echo '</table>';
        Html::closeForm();
    }
}

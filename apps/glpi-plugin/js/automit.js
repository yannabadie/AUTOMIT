(function() {
    'use strict';

    document.addEventListener('DOMContentLoaded', function() {
        var panel = document.getElementById('automit-panel');
        if (!panel) return;

        var ticketId = panel.dataset.ticketId;
        var rootDoc = (typeof CFG_GLPI !== 'undefined') ? CFG_GLPI.root_doc : '';

        function callAutomit(mode) {
            var loading = document.getElementById('automit-loading');
            var results = document.getElementById('automit-results');
            var output = document.getElementById('automit-draft-output');
            var cards = document.getElementById('automit-action-cards');

            results.classList.remove('d-none');
            loading.classList.remove('d-none');
            output.classList.add('d-none');
            cards.classList.add('d-none');

            var formData = new FormData();
            formData.append('ticket_id', ticketId);
            formData.append('mode', mode);

            fetch(rootDoc + '/plugins/automit/ajax/analyze.php', {
                method: 'POST',
                body: formData,
            })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                loading.classList.add('d-none');
                if (data.error) {
                    output.classList.remove('d-none');
                    output.innerHTML = '<div class="alert alert-danger">' + data.error + '</div>';
                    return;
                }
                if (mode === 'analyze' || mode === 'draft') {
                    renderDraft(output, data);
                } else if (mode === 'propose_actions') {
                    renderActionCards(cards, data);
                }
            })
            .catch(function(err) {
                loading.classList.add('d-none');
                output.classList.remove('d-none');
                output.innerHTML = '<div class="alert alert-danger">Error: ' + err.message + '</div>';
            });
        }

        function renderDraft(container, data) {
            var html = '<div class="card"><div class="card-body">';
            if (data.analysis) {
                html += '<h5>Analyse</h5><div class="mb-3">' + escapeHtml(data.analysis) + '</div>';
            }
            if (data.draft_private) {
                html += '<h6>Note privee (draft)</h6>';
                html += '<textarea class="form-control mb-2" id="automit-private-text" rows="4">' + escapeHtml(data.draft_private) + '</textarea>';
                html += '<button class="btn btn-sm btn-success me-2" onclick="window.automitAcceptDraft(\'private\')">Accepter (note privee)</button>';
            }
            if (data.draft_public) {
                html += '<h6>Reponse publique (draft)</h6>';
                html += '<textarea class="form-control mb-2" id="automit-public-text" rows="4">' + escapeHtml(data.draft_public) + '</textarea>';
                html += '<button class="btn btn-sm btn-primary" onclick="window.automitAcceptDraft(\'public\')">Accepter (reponse)</button>';
            }
            if (data.citations && data.citations.length > 0) {
                html += '<hr><small class="text-muted">Sources: ' + data.citations.map(escapeHtml).join(', ') + '</small>';
            }
            html += '</div></div>';
            container.classList.remove('d-none');
            container.innerHTML = html;
        }

        function renderActionCards(container, data) {
            if (!data.actions || data.actions.length === 0) {
                container.classList.remove('d-none');
                container.innerHTML = '<div class="alert alert-info">Aucune action proposee.</div>';
                return;
            }
            var html = '<h5>Actions proposees</h5><div class="row g-3">';
            data.actions.forEach(function(action) {
                var tierBadge = ['bg-info', 'bg-success', 'bg-warning', 'bg-danger'][action.tier] || 'bg-secondary';
                html += '<div class="col-md-6"><div class="card">';
                html += '<div class="card-header d-flex justify-content-between">';
                html += '<span>' + escapeHtml(action.action_id) + '</span>';
                html += '<span class="badge ' + tierBadge + '">Tier ' + action.tier + '</span></div>';
                html += '<div class="card-body">';
                html += '<p><strong>Cible:</strong> ' + escapeHtml(action.target.display_name) + ' (' + escapeHtml(action.target.id) + ')</p>';
                html += '<p><strong>Justification:</strong> ' + escapeHtml(action.justification) + '</p>';
                html += '<p><strong>Rollback:</strong> ' + escapeHtml(action.rollback_notes) + '</p>';
                if (action.tier <= 1) {
                    html += '<button class="btn btn-sm btn-primary" onclick="window.automitExecuteAction(\'' + escapeHtml(action.idempotency_key) + '\')">Executer</button>';
                } else {
                    html += '<span class="text-muted">Requires Phase 5 governance</span>';
                }
                html += '</div></div></div>';
            });
            html += '</div>';
            container.classList.remove('d-none');
            container.innerHTML = html;
        }

        function escapeHtml(text) {
            var div = document.createElement('div');
            div.textContent = text || '';
            return div.innerHTML;
        }

        var btnAnalyze = document.getElementById('automit-analyze');
        var btnDraft = document.getElementById('automit-draft');
        var btnPropose = document.getElementById('automit-propose-actions');

        if (btnAnalyze) btnAnalyze.addEventListener('click', function() { callAutomit('analyze'); });
        if (btnDraft) btnDraft.addEventListener('click', function() { callAutomit('draft'); });
        if (btnPropose) btnPropose.addEventListener('click', function() { callAutomit('propose_actions'); });
    });
})();

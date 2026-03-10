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
                    output.innerHTML = '<div class="alert alert-danger">' + escapeHtml(data.error || '') + '</div>';
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
                output.innerHTML = '<div class="alert alert-danger">Error: ' + escapeHtml(err.message || '') + '</div>';
            });
        }

        function renderDraft(container, data) {
            // Store draft data globally for automitAcceptDraft
            window._automitDraftData = {
                ticket_id: ticketId,
                private_followup: data.draft_private || '',
                public_followup: data.draft_public || '',
            };

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

        function executeAction(action) {
            var resultPanel = document.getElementById('automit-draft-output');
            resultPanel.classList.remove('d-none');
            resultPanel.innerHTML = '<div class="automit-executing"><div class="spinner-border spinner-border-sm me-2"></div>Execution en cours...</div>';

            fetch(rootDoc + '/plugins/automit/ajax/execute.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Glpi-Csrf-Token': getAjaxCsrf(),
                },
                body: JSON.stringify({
                    action_id: action.action_id,
                    ticket_id: ticketId,
                    tier: action.tier,
                    target_type: action.target ? action.target.type : 'glpi_ticket',
                    target_id: action.target ? action.target.id : String(ticketId),
                    idempotency_key: action.idempotency_key || crypto.randomUUID(),
                    justification: action.justification || '',
                }),
            })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.error) {
                    var html = '<div class="automit-error">' + escapeHtml(data.error) + '</div>';
                    if (data.action) {
                        html += '<p class="automit-hint">' + escapeHtml(data.action) + '</p>';
                    }
                    resultPanel.innerHTML = html;
                } else {
                    var receiptId = (data.receipt && data.receipt.receipt_id) ? data.receipt.receipt_id : 'N/A';
                    resultPanel.innerHTML = '<div class="automit-success">Action executee. Receipt: ' + escapeHtml(receiptId) + '</div>';
                }
            })
            .catch(function(err) {
                resultPanel.innerHTML = '<div class="automit-error">Erreur: ' + escapeHtml(err.message) + '</div>';
            });
        }

        function getAjaxCsrf() {
            // Try meta tag first
            var meta = document.querySelector('meta[name="csrf-token"]');
            if (meta) return meta.getAttribute('content') || '';
            // Try GLPI's hidden input
            var input = document.querySelector('input[name="_glpi_csrf_token"]');
            if (input) return input.value || '';
            // Try global
            if (typeof CFG_GLPI !== 'undefined' && CFG_GLPI.csrf_token) return CFG_GLPI.csrf_token;
            return '';
        }

        // Expose executeAction globally so inline onclick handlers can call it
        window.automitExecuteAction = function(actionIndex) {
            if (window._automitActions && window._automitActions[actionIndex]) {
                executeAction(window._automitActions[actionIndex]);
            }
        };

        // Accept a draft (private or public) and post it as a followup
        window.automitAcceptDraft = function(type) {
            var draft = window._automitDraftData;
            if (!draft || !draft.ticket_id) {
                alert('Aucun brouillon disponible');
                return;
            }
            var content = (type === 'private') ? draft.private_followup : draft.public_followup;
            if (!content) {
                alert('Contenu ' + type + ' non disponible');
                return;
            }
            if (confirm('Poster le followup ' + type + ' sur le ticket #' + draft.ticket_id + ' ?')) {
                var panel = document.getElementById('automit-result') || document.getElementById('automit-draft-output');
                if (panel) {
                    panel.innerHTML = '<p>Publication en cours...</p>';
                }

                var formData = new FormData();
                formData.append('ticket_id', draft.ticket_id);
                formData.append('action', 'post_followup');
                formData.append('followup_type', type);
                formData.append('content', content);

                fetch(rootDoc + '/plugins/automit/ajax/analyze.php', {
                    method: 'POST',
                    body: formData
                })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    if (!panel) return;
                    if (data.error) {
                        panel.innerHTML = '<div class="automit-error">' + escapeHtml(data.error) + '</div>';
                    } else {
                        panel.innerHTML = '<div class="automit-success">Followup ' + escapeHtml(type) + ' publie avec succes</div>';
                    }
                })
                .catch(function(err) {
                    if (!panel) return;
                    panel.innerHTML = '<div class="automit-error">Erreur: ' + escapeHtml(err.message || '') + '</div>';
                });
            }
        };

        function renderActionCards(container, data) {
            if (!data.actions || data.actions.length === 0) {
                container.classList.remove('d-none');
                container.innerHTML = '<div class="alert alert-info">Aucune action proposee.</div>';
                return;
            }
            // Store actions globally for onclick access
            window._automitActions = data.actions;

            var html = '<h5>Actions proposees</h5><div class="row g-3">';
            data.actions.forEach(function(action, index) {
                var tierBadge = ['bg-info', 'bg-success', 'bg-warning', 'bg-danger'][action.tier] || 'bg-secondary';
                html += '<div class="col-md-6"><div class="card">';
                html += '<div class="card-header d-flex justify-content-between">';
                html += '<span>' + escapeHtml(action.action_id) + '</span>';
                html += '<span class="badge ' + tierBadge + '">Tier ' + action.tier + '</span></div>';
                html += '<div class="card-body">';
                var targetName = action.target ? escapeHtml(action.target.display_name) : 'N/A';
                var targetId = action.target ? escapeHtml(action.target.id) : '';
                html += '<p><strong>Cible:</strong> ' + targetName + ' (' + targetId + ')</p>';
                html += '<p><strong>Justification:</strong> ' + escapeHtml(action.justification) + '</p>';
                html += '<p><strong>Rollback:</strong> ' + escapeHtml(action.rollback_notes) + '</p>';
                if (action.tier <= 1) {
                    html += '<button class="btn btn-sm btn-primary" onclick="window.automitExecuteAction(' + index + ')">Executer</button>';
                } else {
                    html += '<button class="btn btn-sm btn-outline-warning" onclick="alert(\'Demandez une validation GLPI sur ce ticket avant d\\\'executer.\')">Validation requise</button>';
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

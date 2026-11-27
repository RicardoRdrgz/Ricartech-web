/* ============================================================
   Ricartech — calculadora y hoja de entrada (albarán)
   Sin dependencias. El envío usa la tabla tickets existente.
   ============================================================ */
(function () {
  'use strict';

  var cfgEl = document.getElementById('rt-config');
  var cfg = cfgEl ? JSON.parse(cfgEl.textContent) : {};
  var S = cfg.strings || {};
  var CAT = cfg.catalog || {};
  var WHATSAPP = cfg.whatsapp || window.SITE_WHATSAPP || '34607066690';
  var DRAFT_KEY = 'rt-ticket-draft';
  var PHYSICAL = [1, 4, 5, 8, 9];
  var VALIDATED = ['equipo', 'sintomas', 'modalidad', 'urgencia', 'localidad',
    'nombre', 'telefono', 'email', 'rgpd'];

  function q(sel, root) { return (root || document).querySelector(sel); }
  function qa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function tx(key, vars) {
    var value = S[key] || key;
    if (!vars) return value;
    Object.keys(vars).forEach(function (k) {
      value = value.split('{' + k + '}').join(vars[k]);
    });
    return value;
  }
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function money(n) {
    var value = Math.round(Number(n) * 100) / 100;
    return (value % 1 ? String(value).replace('.', ',') : String(value)) + ' €';
  }
  function isDemo() {
    var host = (location.hostname || '').toLowerCase();
    return location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1';
  }
  function digits(value) { return String(value || '').replace(/\D/g, ''); }

  /* ---------- Calculadora ---------- */
  function initCalculator() {
    var items = qa('.calc-item');
    if (!items.length) return;
    var totalEl = q('[data-calc-total]');
    var noteEl = q('[data-calc-from-note]');
    if (!totalEl) return;

    function update() {
      var total = 0;
      var count = 0;
      var from = false;
      items.forEach(function (btn) {
        var on = btn.getAttribute('aria-pressed') === 'true';
        var mark = q('.calc-box', btn);
        if (mark) mark.textContent = on ? '✓' : '';
        if (!on) return;
        total += parseFloat(btn.getAttribute('data-price')) || 0;
        count += 1;
        if (btn.getAttribute('data-from') === 'true') from = true;
      });
      totalEl.textContent = count ? (from ? 'Desde ' : '') + money(total) : (S.calc_empty || '— €');
      if (noteEl) noteEl.hidden = !from;
    }

    items.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var on = btn.getAttribute('aria-pressed') === 'true';
        btn.setAttribute('aria-pressed', on ? 'false' : 'true');
        update();
      });
    });
    update();
  }

  /* ---------- Formulario ---------- */
  function initTicketForm() {
    var form = q('[data-form="ticket"]');
    if (!form) return;

    var steps = qa('.form-step', form);
    var tabs = qa('.form-tabs [data-goto]', form);
    var title = q('[data-step-title]', form);
    var summaryList = q('[data-summary-list]', form);
    var done = q('.ticket-done', form);
    var doneTicket = q('[data-ticket-id]', form);
    var demoNote = q('[data-demo-note]', form);
    var formError = q('[data-form-error]', form);
    var waLink = q('[data-wa-link]', form);
    var ticketPreview = q('[data-ticket-preview]', form);
    var suggestionBox = q('[data-suggestion]', form);
    var suggestionName = q('[data-suggestion-name]', form);
    var suggestionPrice = q('[data-suggestion-price]', form);
    var priceLine = q('[data-price-line]', form);
    var backupBox = q('[data-backup]', form);
    var backupWarn = q('[data-backup-warn]', form);
    var remoteWarn = q('[data-remote-warning]', form);
    var homeFields = q('[data-home-fields]', form);
    var meetNote = q('[data-meet-note]', form);
    var counter = q('[data-counter]', form);
    var remoteInput = q('input[name="modalidad"][value="remoto"]', form);

    var current = 1;
    var state = {
      equipo: '', sintomas: [], descripcion: '', marca: '', modelo: '', anio: '',
      so: '', serie: '', direccion: '', localidad: '', modalidad: '', urgencia: '',
      franjas: [], copia: '', nombre: '', telefono: '', email: '', primera: '',
      rgpd: false, website: '', sugCleared: false, ticket: ''
    };
    var suggestion = null;

    function readState() {
      var fd = new FormData(form);
      state.equipo = fd.get('equipo') || '';
      state.sintomas = fd.getAll('sintomas');
      state.descripcion = fd.get('descripcion') || '';
      ['marca', 'modelo', 'anio', 'so', 'serie', 'direccion', 'localidad',
        'nombre', 'telefono', 'email', 'copia', 'primera'].forEach(function (k) {
        state[k] = fd.get(k) || '';
      });
      state.modalidad = fd.get('modalidad') || '';
      state.urgencia = fd.get('urgencia') || '';
      state.franjas = fd.getAll('franjas');
      state.rgpd = !!fd.get('rgpd');
      state.website = fd.get('website') || '';
    }

    function persist() {
      try {
        var saved = {};
        Object.keys(state).forEach(function (k) {
          if (k !== 'rgpd' && k !== 'website') saved[k] = state[k];
        });
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ step: current, values: saved }));
      } catch (e) { /* modo privado: sin borrador */ }
    }

    function restore() {
      var raw;
      try { raw = sessionStorage.getItem(DRAFT_KEY); } catch (e) { return; }
      if (!raw) return;
      try {
        var saved = JSON.parse(raw);
        var values = saved.values || {};
        Object.keys(values).forEach(function (k) {
          var field = qa('[name="' + k + '"]', form);
          if (!field.length) return;
          field.forEach(function (el) {
            if (el.type === 'radio' || el.type === 'checkbox') {
              var wanted = values[k];
              el.checked = Array.isArray(wanted)
                ? wanted.indexOf(el.value) > -1 : wanted === el.value;
            } else {
              el.value = values[k];
            }
          });
        });
        current = Math.min(3, Math.max(1, parseInt(saved.step, 10) || 1));
      } catch (e) { /* borrador corrupto: se ignora */ }
    }

    function setError(name, msg) {
      var box = q('[data-error-for="' + name + '"]', form);
      if (box) box.textContent = msg || '';
      qa('[name="' + name + '"]', form).forEach(function (el) {
        if (msg) {
          el.setAttribute('aria-invalid', 'true');
          if (box && box.id) el.setAttribute('aria-describedby', box.id);
        } else {
          el.removeAttribute('aria-invalid');
          if (box && box.id && el.getAttribute('aria-describedby') === box.id) {
            el.removeAttribute('aria-describedby');
          }
        }
      });
      return !msg;
    }

    function symptomIds() {
      return state.sintomas.map(function (value) {
        var label = qa('.symptom-choice', form).filter(function (el) {
          return q('input', el) && q('input', el).value === value;
        })[0];
        return label ? parseInt(label.getAttribute('data-id'), 10) : 0;
      });
    }

    function hasAny(ids, list) {
      return ids.some(function (id) { return list.indexOf(id) > -1; });
    }

    function computeSuggestion() {
      if (state.sugCleared) return null;
      var ids = symptomIds();
      var key = null;
      if (state.equipo === 'console') key = 'consola';
      else if (ids.indexOf(7) > -1 && !hasAny(ids, PHYSICAL)) key = 'remoto';
      else if (ids.indexOf(6) > -1 || ids.indexOf(10) > -1) key = 'virus';
      else if (ids.indexOf(3) > -1) key = 'pack';
      else if (ids.indexOf(9) > -1) key = 'clonacion';
      else if (ids.indexOf(2) > -1) key = 'instalacion';
      else if (hasAny(ids, [1, 4, 5, 8])) key = 'pieza';
      if (!key || !CAT[key]) return null;
      var service = CAT[key];
      return {
        key: key,
        name: service.name,
        price: state.equipo === 'laptop' ? service.laptop : service.desktop,
        risk: !!service.risk || ids.indexOf(9) > -1
      };
    }

    function labelFor(name, value) {
      if (!value) return '';
      var input = qa('[name="' + name + '"]', form).filter(function (el) {
        return el.value === value;
      })[0];
      if (!input) return value;
      var label = input.closest('label');
      if (!label) return value;
      return label.textContent.replace(/\s+/g, ' ').trim();
    }

    function updateChoiceStates() {
      qa('.big-choice, .symptom-choice, .slot-choice', form).forEach(function (label) {
        var input = q('input', label);
        label.classList.toggle('is-checked', !!(input && input.checked));
      });
    }

    function updateSymptoms() {
      qa('.symptom-choice', form).forEach(function (label) {
        var allowed = (label.getAttribute('data-devices') || '').split(' ');
        var show = !state.equipo || allowed.indexOf(state.equipo) > -1;
        label.hidden = !show;
        var input = q('input', label);
        if (!show && input && input.checked) input.checked = false;
      });
    }

    function updateRemote() {
      if (!remoteInput) return;
      var ids = symptomIds();
      var available = !hasAny(ids, PHYSICAL);
      remoteInput.disabled = !available;
      var label = remoteInput.closest('label');
      if (label) label.setAttribute('aria-disabled', available ? 'false' : 'true');
      if (remoteWarn) remoteWarn.hidden = available;
      if (!available && remoteInput.checked) remoteInput.checked = false;
    }

    function updateSuggestionUI() {
      suggestion = computeSuggestion();
      var show = !!suggestion;
      if (suggestionBox) suggestionBox.hidden = !show;
      if (priceLine) priceLine.hidden = !show;
      if (!show) {
        if (backupBox) backupBox.hidden = true;
        return;
      }
      if (suggestionName) suggestionName.textContent = suggestion.name;
      if (suggestionPrice) suggestionPrice.textContent = suggestion.price;
      if (priceLine) {
        priceLine.textContent = (S.form_price_line || 'Precio orientativo') + ': ' + suggestion.price;
      }
      var risky = suggestion.risk;
      if (backupBox) backupBox.hidden = !risky;
      if (backupWarn) {
        backupWarn.hidden = !(risky && (state.copia === 'no' || state.copia === 'ns'));
      }
    }

    function updateConditional() {
      if (homeFields) homeFields.hidden = state.modalidad !== 'domicilio';
      if (meetNote) meetNote.hidden = state.modalidad !== 'mano';
      if (state.modalidad !== 'domicilio') setError('localidad', '');
    }

    function updateCounter() {
      if (counter) counter.textContent = String(state.descripcion.length);
    }

    function rowsForSummary() {
      var rows = [];
      rows.push([S.summary_device, labelFor('equipo', state.equipo), 1]);
      if (state.sintomas.length) rows.push([S.summary_symptoms, state.sintomas.join(', '), 1]);
      if (state.descripcion.trim()) rows.push([S.summary_description, state.descripcion.trim(), 1]);
      if (suggestion) rows.push([S.summary_suggestion, suggestion.name + ' · ' + suggestion.price, 1]);
      if (suggestion && suggestion.risk && state.copia) {
        rows.push([S.summary_backup, labelFor('copia', state.copia), 1]);
      }
      rows.push([S.summary_mode, labelFor('modalidad', state.modalidad) ||
        (S.form_suggestion_none || '—'), 2]);
      if (state.modalidad === 'domicilio') {
        if (state.direccion.trim()) rows.push([S.summary_address, state.direccion.trim(), 2]);
        rows.push([S.summary_locality, state.localidad || '—', 2]);
      }
      if (state.modalidad === 'mano') rows.push([S.summary_address, S.form_meet || '—', 2]);
      rows.push([S.summary_urgency, labelFor('urgencia', state.urgencia) || '—', 2]);
      if (state.franjas.length) rows.push([S.summary_slots, state.franjas.join(', '), 2]);
      rows.push([S.summary_name, state.nombre.trim() || '—', 3]);
      rows.push([S.summary_phone, state.telefono.trim() || '—', 3]);
      if (state.email.trim()) rows.push([S.summary_email, state.email.trim(), 3]);
      if (state.primera) rows.push([S.summary_first, labelFor('primera', state.primera), 3]);
      return rows;
    }

    function updateSummary() {
      if (!summaryList) return;
      var rows = rowsForSummary();
      summaryList.innerHTML = rows.map(function (row) {
        return '<div><dt>' + esc(row[0]) + '</dt><dd>' + esc(row[1]) + '</dd>' +
          '<button type="button" data-goto="' + row[2] + '">' +
          esc(S.form_edit || 'Editar') + '</button></div>';
      }).join('');
    }

    function refresh() {
      readState();
      updateSymptoms();
      updateRemote();
      readState();
      updateChoiceStates();
      updateSuggestionUI();
      updateConditional();
      updateCounter();
      updateSummary();
      if (ticketPreview && state.ticket) ticketPreview.textContent = state.ticket;
      persist();
    }

    function validateField(name) {
      readState();
      if (name === 'equipo') return setError(name, state.equipo ? '' : tx('err_device'));
      if (name === 'sintomas') {
        var visible = qa('.symptom-choice:not([hidden]) input:checked', form).length;
        return setError(name, visible ? '' : tx('err_symptoms'));
      }
      if (name === 'modalidad') {
        if (remoteInput && remoteInput.disabled) return setError(name, tx('remote_not_available'));
        return setError(name, state.modalidad ? '' : tx('err_mode'));
      }
      if (name === 'urgencia') return setError(name, state.urgencia ? '' : tx('err_urgency'));
      if (name === 'localidad') {
        if (state.modalidad !== 'domicilio') return setError(name, '');
        return setError(name, state.localidad ? '' : tx('err_locality'));
      }
      if (name === 'nombre') return setError(name, state.nombre.trim() ? '' : tx('err_name'));
      if (name === 'telefono') {
        return setError(name, digits(state.telefono).length === 9 ? '' : tx('err_phone'));
      }
      if (name === 'email') {
        var email = state.email.trim();
        var ok = !email || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
        return setError(name, ok ? '' : tx('err_email'));
      }
      if (name === 'rgpd') return setError(name, state.rgpd ? '' : tx('err_rgpd'));
      return true;
    }

    function validateStep(step) {
      var names = step === 1 ? ['equipo', 'sintomas']
        : step === 2 ? ['modalidad', 'urgencia', 'localidad']
          : ['nombre', 'telefono', 'email', 'rgpd'];
      var ok = true;
      names.forEach(function (name) {
        if (!validateField(name)) ok = false;
      });
      return ok;
    }

    function goTo(step) {
      step = parseInt(step, 10);
      if (step > current && !validateStep(current)) return;
      current = Math.min(3, Math.max(1, step));
      steps.forEach(function (fieldset) {
        var on = parseInt(fieldset.getAttribute('data-step'), 10) === current;
        fieldset.hidden = !on;
        fieldset.classList.toggle('is-active', on);
      });
      tabs.forEach(function (tab) {
        var on = parseInt(tab.getAttribute('data-goto'), 10) === current;
        tab.classList.toggle('is-active', on);
        if (on) tab.setAttribute('aria-current', 'step');
        else tab.removeAttribute('aria-current');
      });
      if (title) title.textContent = tx('form_step' + current);
      updateSummary();
      persist();
      var legend = q('legend', steps[current - 1]);
      if (legend && legend.focus) legend.focus();
      if (form.scrollIntoView) form.scrollIntoView({ block: 'start' });
    }

    function makeTicket() {
      if (state.ticket) return state.ticket;
      var d = new Date();
      var stamp = String(d.getTime()).slice(-6);
      state.ticket = 'TKT-' + d.getFullYear() + '-' + stamp;
      return state.ticket;
    }

    function waMessage(ticket) {
      var lines = [
        tx('wa_ticket_message', { ticket: ticket }),
        (S.summary_device || 'Equipo') + ': ' + labelFor('equipo', state.equipo),
        (S.summary_symptoms || 'Síntomas') + ': ' + state.sintomas.join(', '),
        (S.summary_mode || 'Modalidad') + ': ' + labelFor('modalidad', state.modalidad),
        (S.summary_urgency || 'Urgencia') + ': ' + labelFor('urgencia', state.urgencia)
      ];
      return lines.filter(Boolean).join('\n');
    }

    function setWaLink(ticket) {
      if (!waLink) return;
      waLink.href = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(waMessage(ticket));
    }

    function finish(ticket, demo) {
      steps.forEach(function (fieldset) { fieldset.hidden = true; });
      if (done) {
        done.hidden = false;
        if (done.focus) done.focus();
      }
      if (doneTicket) doneTicket.textContent = ticket;
      if (demoNote) demoNote.hidden = !demo;
      setWaLink(ticket);
      try { sessionStorage.removeItem(DRAFT_KEY); } catch (e) { /* no-op */ }
    }

    function showSendError(button, label) {
      button.disabled = false;
      button.textContent = label;
      if (formError) {
        formError.textContent = tx('form_error');
        var link = document.createElement('a');
        link.href = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(waMessage(state.ticket));
        link.textContent = ' ' + (S.form_wa_copy || 'WhatsApp');
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener');
        formError.appendChild(link);
      }
    }

    function buildPayload(ticket) {
      var suggestionName = suggestion ? suggestion.name : (S.form_suggestion_none || 'Sin sugerencia');
      var extra = [];
      if (state.modalidad === 'mano') extra.push(S.form_meet || 'Punto de encuentro a acordar');
      if (suggestion) extra.push((S.form_price_line || 'Precio orientativo') + ': ' + suggestion.price);
      return {
        id: ticket,
        estado: 'Pendiente',
        cliente_nombre: state.nombre.trim(),
        cliente_telefono: digits(state.telefono),
        cliente_email: state.email.trim() || null,
        cliente_direccion: state.modalidad === 'domicilio' ? (state.direccion.trim() || null) : null,
        cliente_localidad: state.modalidad === 'domicilio' ? (state.localidad || null) : null,
        cliente_cp: null,
        cliente_habitual: state.primera === 'no' ? 'si' : 'no',
        dispositivo_tipo: labelFor('equipo', state.equipo),
        dispositivo_marca: state.marca.trim() || null,
        dispositivo_modelo: state.modelo.trim() || null,
        dispositivo_serie: state.serie.trim() || null,
        dispositivo_so: state.so.trim() || null,
        dispositivo_anio: state.anio.trim() || null,
        averia_servicios: [suggestionName],
        averia_sintomas: state.sintomas.slice(),
        averia_descripcion: state.descripcion.trim() || null,
        logistica_urgencia: labelFor('urgencia', state.urgencia),
        logistica_modalidad: labelFor('modalidad', state.modalidad),
        logistica_disponibilidad: state.franjas.slice(),
        logistica_backup: state.copia || null,
        extra_observaciones: extra.length ? extra.join(' · ') : null
      };
    }

    function submit(event) {
      event.preventDefault();
      if (!validateStep(3)) return;
      readState();
      if (state.website) { finish(makeTicket(), isDemo()); return; }

      var button = q('[data-submit]', form);
      var label = button ? button.textContent : S.form_send;
      if (formError) formError.textContent = '';
      if (button) {
        button.disabled = true;
        button.textContent = S.form_sending || 'Enviando…';
      }
      var ticket = makeTicket();
      var payload = buildPayload(ticket);

      if (isDemo()) {
        if (button) {
          button.disabled = false;
          button.textContent = label;
        }
        finish(ticket, true);
        return;
      }

      if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
        showSendError(button || { disabled: false, textContent: label }, label);
        return;
      }

      window.fetch(window.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/tickets', {
        method: 'POST',
        headers: {
          'apikey': window.SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + window.SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(payload)
      }).then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        if (button) {
          button.disabled = false;
          button.textContent = label;
        }
        finish(ticket, false);
      }).catch(function () {
        showSendError(button || { disabled: false, textContent: label }, label);
      });
    }

    /* Eventos */
    qa('input, select, textarea', form).forEach(function (el) {
      var name = el.name;
      if (!name) return;
      el.addEventListener('input', refresh);
      el.addEventListener('change', function () {
        if (name === 'equipo' || name === 'sintomas') state.sugCleared = false;
        refresh();
        if (VALIDATED.indexOf(name) > -1) validateField(name);
      });
      el.addEventListener('blur', function () {
        if (['nombre', 'telefono', 'email', 'localidad'].indexOf(name) > -1) {
          validateField(name);
        }
      });
    });

    qa('[data-next]', form).forEach(function (btn) {
      btn.addEventListener('click', function () { goTo(current + 1); });
    });
    qa('[data-prev]', form).forEach(function (btn) {
      btn.addEventListener('click', function () { goTo(current - 1); });
    });
    form.addEventListener('click', function (event) {
      var target = event.target.closest('[data-goto]');
      if (target) goTo(target.getAttribute('data-goto'));
    });
    var clearBtn = q('[data-suggestion-clear]', form);
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        state.sugCleared = true;
        refresh();
      });
    }
    form.addEventListener('submit', submit);

    restore();
    refresh();
    if (current > 1) goTo(current);
  }

  document.addEventListener('DOMContentLoaded', function () {
    initCalculator();
    initTicketForm();
  });
})();

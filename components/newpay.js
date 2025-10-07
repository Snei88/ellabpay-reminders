// components/newpay.js
class NewPaymentModal {
  constructor() {
    this.root = document.getElementById('newPaymentModalRoot') || this.ensureRoot();
    this.defaultOffsets = [7, 3, 1,];
    this.rendered = false;
  }
  
  getAllowedMaxDays() {
    const dt = this.root.querySelector('#np_datetime')?.value
             || `${this.root.querySelector('#np_fecha')?.value || ''}T${this.root.querySelector('#np_hora')?.value || '09:00'}`;
    if (!dt || isNaN(new Date(dt))) return 365; // por si falta la fecha, no bloquees
    const due = new Date(dt);
    const now = new Date();
    const diffMs = due - now;
    return Math.max(0, Math.floor(diffMs / 86400000)); // días completos restantes
  }

  isRecurringValue(v) {
    const s = (v || '').toLowerCase();
    return s && s !== 'único' && s !== 'unico';
  }

  updateReminderChipsAvailability() {
    const maxDays = this.getAllowedMaxDays();
    const selRec = this.root.querySelector('#np_recurrencia');
    const recurring = this.isRecurringValue(selRec?.value);

    // deshabilita chips > maxDays solo si NO es recurrente
    this.root.querySelectorAll('#np_offsets_group .chip').forEach(btn => {
      const v = parseInt(btn.dataset.value, 10);
      const past = Number.isFinite(v) && v > maxDays;

      if (!recurring) {
        // Pago ÚNICO: deshabilitar si cae en el pasado
        btn.setAttribute('aria-disabled', past ? 'true' : 'false');
        btn.classList.toggle('opacity-40', past);
        btn.classList.toggle('pointer-events-none', past);
        if (past) btn.classList.remove('selected');
        btn.title = '';
      } else {
        // Pago RECURRENTE: nunca bloquear por estar en pasado
        btn.setAttribute('aria-disabled', 'false');
        btn.classList.remove('opacity-40', 'pointer-events-none');
        btn.title = past ? 'Se aplicará desde la próxima fecha' : '';
      }
    });

    // ajusta límites del "Otro"
    const input = this.root.querySelector('#np_offset_custom');
    if (input) {
      if (!recurring) {
        input.min = 1;
        input.max = String(maxDays);
        input.placeholder = maxDays > 0 ? `≤ ${maxDays}d` : '—';
        if (Number(input.value) > maxDays) input.value = '';
      } else {
        // Recurrente: sin límite estricto
        input.min = 1;
        input.max = 365;
        input.placeholder = '+ Otro';
      }
    }
  }

  ensureRoot() {
    const div = document.createElement('div');
    div.id = 'newPaymentModalRoot';
    document.body.appendChild(div);
    return div;
  }

  open() {
    if (!this.rendered) {
      this.render();
      this.rendered = true;
    }
    this.root.classList.remove('hidden');
    setTimeout(() => this.root.querySelector('#np_nombre')?.focus(), 50);
  }

  close() {
    this.root.classList.add('hidden');
    const form = this.root.querySelector('#np_form');
    if (form) form.reset();
    // defaults útiles
    const hora = this.root.querySelector('#np_hora');
    if (hora) hora.value = '09:00';
  }

  render() {
    this.root.innerHTML = `
      <div class="fixed inset-0 z-50" id="np_modal">
        <div class="absolute inset-0 bg-black/40" data-close="true"></div>
        <div class="absolute inset-0 flex items-center justify-center p-4">
          <div class="w-[80vw] max-w-none max-h-[90vh] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl overflow-hidden flex flex-col">
            <div class="flex justify-between items-center px-6 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700">
              <h2 class="text-[#111418] dark:text-white tracking-light text-[24px] font-bold leading-tight">Nuevo Pago</h2>
              <button class="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200" data-close="true">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>

            <form id="np_form" class="p-6 space-y-4 overflow-y-auto flex-1">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <label class="flex flex-col">
                  <p class="text-[#111418] dark:text-white text-sm font-medium leading-normal pb-2">Nombre del pago</p>
                  <input id="np_nombre" class="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white bg-white dark:bg-gray-800 h-12 placeholder:text-[#617589] dark:placeholder:text-gray-400 p-[15px] text-sm font-normal leading-normal" placeholder="EJ: Workspaces Trulab, elevara y Read.IA" required />
                </label>
                <label class="flex flex-col">
                  <p class="text-[#111418] dark:text-white text-sm font-medium leading-normal pb-2">Categoría</p>
                  <select id="np_categoria" class="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white bg-white dark:bg-gray-800 h-12 placeholder:text-[#617589] dark:placeholder:text-gray-400 p-[15px] text-sm font-normal leading-normal appearance-none" style="background-image: url('data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 20 20%27%3e%3cpath stroke=%27%236b7280%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%271.5%27 d=%27m6 8 4 4 4-4%27/%3e%3c/svg%3e'); background-position: right 0.5rem center; background-repeat: no-repeat; background-size: 1.5em 1.5em;">
                    <option value="">Seleccionar categoría</option>
                    <option>Servicios</option>
                    <option>Suscripciones</option>
                    <option>Proveedores</option>
                    <option>Nómina</option>
                    <option>Impuestos</option>
                    <option>Otros</option>
                  </select>
                </label>
              </div>
              <label class="flex flex-col">
                <p class="text-[#111418] dark:text-white text-sm font-medium leading-normal pb-2">Descripción</p>
                <textarea id="np_descripcion" class="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white bg-white dark:bg-gray-800 min-h-16 placeholder:text-[#617589] dark:placeholder:text-gray-400 p-[15px] text-sm font-normal leading-normal" placeholder="Detalles del pago..."></textarea>
              </label>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="flex flex-col">
                  <p class="text-[#111418] dark:text-white text-sm font-medium leading-normal pb-2">Fecha y Hora</p>
                  <input id="np_datetime" class="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white bg-white dark:bg-gray-800 h-12 placeholder:text-[#617589] dark:placeholder:text-gray-400 p-[15px] text-sm font-normal leading-normal" type="datetime-local" required />
                </div>
                <label class="flex flex-col">
                  <p class="text-[#111418] dark:text-white text-sm font-medium leading-normal pb-2">Monto</p>
                  <div class="relative">
                    <span class="absolute inset-y-0 left-0 flex items-center pl-4 text-[#617589] dark:text-gray-400 text-sm">$</span>
                    <input id="np_monto" class="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white bg-white dark:bg-gray-800 h-12 placeholder:text-[#617589] dark:placeholder:text-gray-400 p-[15px] pl-8 text-sm font-normal leading-normal" placeholder="0.00" step="0.01" type="number" />
                  </div>
                </label>
              </div>
              <div>
                <p class="text-[#111418] dark:text-white text-sm font-medium leading-normal pb-2">Recordatorios</p>
                <div id="np_offsets_group" class="flex flex-wrap gap-2">
                  <button type="button" class="chip selected border border-transparent rounded-full px-3 py-1 text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300" data-value="7">7d</button>
                  <button type="button" class="chip border border-transparent rounded-full px-3 py-1 text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300" data-value="3">3d</button>
                  <button type="button" class="chip border border-transparent rounded-full px-3 py-1 text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300" data-value="1">1d</button>
                  <div class="flex items-center gap-2 ml-2">
                    <input id="np_offset_custom" type="number" step="1" class="form-input h-9 w-24 rounded-lg p-2 text-sm bg-white dark:bg-gray-800 text-[#111418] dark:text-white placeholder:text-[#617589] dark:placeholder:text-gray-400" placeholder="+ Otro" />
                    <button type="button" id="np_add_custom" class="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm">Añadir</button>
                  </div>
                </div>
              </div>
              <div>
                <input class="hidden collapsible-trigger" id="np_advanced_toggle" type="checkbox">
                <label for="np_advanced_toggle" class="flex justify-between items-center cursor-pointer text-[#111418] dark:text-white text-sm font-medium leading-normal py-2">
                  <span>Opciones avanzadas</span>
                  <span class="material-symbols-outlined transition-transform transform">expand_more</span>
                </label>
                <div class="collapsible-content space-y-6 pt-4">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <label class="flex flex-col">
                      <p class="text-[#111418] dark:text-white text-sm font-medium leading-normal pb-2">Método de pago</p>
                      <select id="np_metodo" class="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white bg-white dark:bg-gray-800 h-12 placeholder:text-[#617589] dark:placeholder:text-gray-400 p-[15px] text-sm font-normal leading-normal appearance-none" style="background-image: url('data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 20 20%27%3e%3cpath stroke=%27%236b7280%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%271.5%27 d=%27m6 8 4 4 4-4%27/%3e%3c/svg%3e'); background-position: right 0.5rem center; background-repeat: no-repeat; background-size: 1.5em 1.5em;">
                        <option value="">Seleccionar</option>
                        <option>Tarjeta</option>
                        <option>Cuenta Bancaria</option>
                        <option>Efectivo</option>
                      </select>
                    </label>
                    <label class="flex flex-col">
                      <p class="text-[#111418] dark:text-white text-sm font-medium leading-normal pb-2">Recurrencia</p>
                      <select id="np_recurrencia" class="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white bg-white dark:bg-gray-800 h-12 placeholder:text-[#617589] dark:placeholder:text-gray-400 p-[15px] text-sm font-normal leading-normal appearance-none" style="background-image: url('data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 20 20%27%3e%3cpath stroke=%27%236b7280%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%271.5%27 d=%27m6 8 4 4 4-4%27/%3e%3c/svg%3e'); background-position: right 0.5rem center; background-repeat: no-repeat; background-size: 1.5em 1.5em;">
                        <option>Único</option>
                        <option>Mensual</option>
                        <option>Trimestral</option>
                        <option>Anual</option>
                      </select>
                    </label>
                  </div>
                  <label class="flex flex-col">
                    <p class="text-[#111418] dark:text-white text-sm font-medium leading-normal pb-2">Subir archivo / Adjuntar comprobante</p>
                    <input id="np-attachments" type="file" multiple accept="*/*" class="w-full text-sm text-gray-500 dark:text-gray-400
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-primary file:text-white
                      hover:file:bg-primary/90
                      cursor-pointer" />
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Se aceptan PDF, Excel, Word, imágenes, etc.</p>
                    <div id="np-att-count" class="text-xs text-gray-600 dark:text-gray-400 mt-2"></div>
                  </label>
                  <label class="flex flex-col">
                    <p class="text-[#111418] dark:text-white text-sm font-medium leading-normal pb-2">Notas internas</p>
                    <textarea id="np_notas" class="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white bg-white dark:bg-gray-800 min-h-24 placeholder:text-[#617589] dark:placeholder:text-gray-400 p-[15px] text-sm font-normal leading-normal" placeholder="Añade notas privadas aquí..."></textarea>
                  </label>
                </div>
              </div>
            </form>

            <div class="flex justify-end items-center px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 space-x-4">
              <button type="button" class="px-6 py-2.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium text-sm rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors" data-close="true">Cancelar</button>
              <button type="submit" form="np_form" class="px-6 py-2.5 bg-blue-600 dark:bg-blue-500 text-white font-medium text-sm rounded-lg hover:bg-blue-700 dark:hover:bg-blue-400 transition-colors">Guardar</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Cerrar
    const closeButtons = this.root.querySelectorAll('[data-close="true"]');
    closeButtons.forEach(btn => btn.addEventListener('click', () => this.close()));

    // Popular categorías dinámicamente
    (() => {
      const sel = this.root.querySelector('#np_categoria');
      if (!sel) return;
      const cats = (window.PaymentManager?.getCategories?.() || []);
      sel.innerHTML = '<option value="">Seleccionar categoría</option>' +
                      cats.map(c => `<option>${c}</option>`).join('');
    })();

    // Toggle visual de chips
    this.root.querySelectorAll('#np_offsets_group .chip').forEach(btn => {
      btn.addEventListener('click', () => btn.classList.toggle('selected'));
    });
    
    // Añadir offset personalizado
    this.root.querySelector('#np_add_custom').addEventListener('click', () => {
      const input = this.root.querySelector('#np_offset_custom');
      const val = parseInt((input.value || '').trim(), 10);
      const selRec = this.root.querySelector('#np_recurrencia');
      const recurring = this.isRecurringValue(selRec?.value);
      const maxDays = recurring ? 365 : this.getAllowedMaxDays();

      if (!Number.isFinite(val) || val < 1 || val > maxDays) {
        // opcional: feedback sutil
        input.classList.add('ring-2','ring-red-300');
        setTimeout(()=>input.classList.remove('ring-2','ring-red-300'), 800);
        return;
      }

      const group = this.root.querySelector('#np_offsets_group');
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip selected border rounded-full px-3 py-1 text-sm';
      chip.dataset.value = String(val);
      chip.textContent = `${val}d`;
      chip.addEventListener('click', () => chip.classList.toggle('selected'));
      group.insertBefore(chip, group.lastElementChild); // antes del "+ Otro"
      input.value = '';
    });

    // Guardar
    this.root.querySelector('#np_form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const nombre = this.root.querySelector('#np_nombre').value.trim();
      const descripcion = this.root.querySelector('#np_descripcion').value.trim();
      const categoria = window.PaymentManager?.normalizeCategory
        ? window.PaymentManager.normalizeCategory(this.root.querySelector('#np_categoria').value)
        : (this.root.querySelector('#np_categoria').value || 'Otros');
      const metodo = this.root.querySelector('#np_metodo')?.value || '';
      const recurrencia = this.root.querySelector('#np_recurrencia')?.value || 'Único';
      const notas = this.root.querySelector('#np_notas')?.value?.trim() || '';

      const dtStr = this.root.querySelector('#np_datetime').value; // "YYYY-MM-DDTHH:MM"
      if (!nombre) return alert('Ingresa un nombre');
      if (!dtStr) return alert('Selecciona fecha y hora');

      // construir Date local y serializar a ISO
      const localDate = new Date(dtStr);
      const isoDate = localDate.toISOString();

      const monto = parseFloat(this.root.querySelector('#np_monto').value || '0') || 0;

      // chips seleccionados
      const selected = Array.from(this.root.querySelectorAll('#np_offsets_group .chip.selected'))
        .map(el => parseInt(el.dataset.value, 10))
        .filter(n => Number.isFinite(n));

      // Para pagos recurrentes, no filtrar por maxDays
      const recurring = this.isRecurringValue(recurrencia);
      let offsets;
      if (recurring) {
        offsets = Array.from(new Set([...selected, 0]))
          .filter(n => n >= 0)
          .sort((a, b) => a - b);
      } else {
        const maxDays = this.getAllowedMaxDays();
        offsets = Array.from(new Set([...selected, 0]))
          .filter(n => n >= 0 && n <= maxDays)
          .sort((a, b) => a - b);
      }

      // Procesar archivos adjuntos
      const npFilesEl = this.root.querySelector('#np-attachments');
      const npTempAttachments = [];
      
      if (npFilesEl?.files?.length) {
        for (const f of npFilesEl.files) {
          const dataUrl = await window.PaymentManager.blobToDataUrl(f);
          npTempAttachments.push({
            name: f.name,
            type: f.type || 'application/octet-stream',
            size: f.size || 0,
            dataUrl
          });
        }
      }

      // Guardar el pago (incluye hora y adjuntos)
      const payment = window.PaymentManager.addPayment({
        nombre,
        descripcion,
        categoria,
        fecha: isoDate,
        hora: dtStr.split('T')[1] || '09:00',
        monto,
        reminderOffsetsDays: offsets.length ? offsets : [0],
        metodoPago: metodo,
        recurrencia,
        notasInternas: notas,
        attachments: npTempAttachments
      });

      window.dispatchEvent(new CustomEvent('paymentAdded', { detail: payment }));
      this.close();
    });
    
    // Actualizar chips al cambiar fecha/hora o recurrencia
    this.updateReminderChipsAvailability();

    this.root.querySelector('#np_datetime')?.addEventListener('input', () => this.updateReminderChipsAvailability());
    this.root.querySelector('#np_fecha')?.addEventListener('change', () => this.updateReminderChipsAvailability());
    this.root.querySelector('#np_hora')?.addEventListener('change', () => this.updateReminderChipsAvailability());
    this.root.querySelector('#np_recurrencia')?.addEventListener('change', () => this.updateReminderChipsAvailability());
  }
}

window.NewPaymentModal = NewPaymentModal;

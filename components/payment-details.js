// components/payment-details.js

// Helper para verificar si un pago está completado
function isCompleted(p) {
  const s = (p?.estado || '').toString().trim().toLowerCase();
  return s === 'completado' || s === 'completo' || s === 'completed';
}

class PaymentDetailsModal {
  static ensureRoot() {
    let root = document.getElementById('paymentDetailsRoot');
    if (!root) {
      root = document.createElement('div');
      root.id = 'paymentDetailsRoot';
      root.className = 'hidden';
      document.body.appendChild(root);
    }
    return root;
  }

  static open(p) {
    const root = this.ensureRoot();

    // Formateos
    const due = new Date(p.fecha);
    const dueStr = due.toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'medium' });
    const amountStr = `$${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(p.monto || 0)}`;
    const categoria = p.categoria || '—';
    const metodo = p.metodoPago || '—';
    const recurrencia = p.recurrencia || 'Único';
    const notas = (p.notasInternas || '').trim();
    const reminders = (p.reminderOffsetsDays || []).length
      ? `${p.reminderOffsetsDays.join(', ')} días antes`
      : '—';

    // Markup del modal (estilo como tu mock)
    root.innerHTML = `
      <div class="fixed inset-0 z-50">
        <div class="absolute inset-0 bg-black/40" data-close="true"></div>
        <div class="absolute inset-0 flex items-center justify-center p-4">
          <div class="w-full max-w-2xl max-h-[90vh] mx-auto bg-white dark:bg-gray-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <!-- Header -->
            <header class="flex items-center justify-between p-6 border-b border-gray-200/80 dark:border-gray-600/70 flex-shrink-0">
              <h1 class="text-xl font-bold text-gray-900 dark:text-gray-50">Detalles del pago</h1>
              <button class="text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition-colors" data-close="true" aria-label="Cerrar">
                <span class="material-symbols-outlined">close</span>
              </button>
            </header>

            <!-- Main -->
            <main class="p-6 md:p-8 space-y-6 overflow-y-auto flex-grow">
              <!-- Grid superior -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                <div class="flex flex-col">
                  <span class="text-sm font-medium text-gray-500 dark:text-gray-300">Nombre</span>
                  <p class="text-base text-gray-900 dark:text-gray-50 font-semibold">${p.nombre || '—'}</p>
                </div>
                <div class="flex flex-col">
                  <span class="text-sm font-medium text-gray-500 dark:text-gray-300">Descripción</span>
                  <p class="text-base text-gray-900 dark:text-gray-50">${p.descripcion || '—'}</p>
                </div>
                <div class="flex flex-col">
                  <span class="text-sm font-medium text-gray-500 dark:text-gray-300">Categoría</span>
                  <p class="text-base text-gray-900 dark:text-gray-50">${categoria}</p>
                </div>
                <div class="flex flex-col">
                  <span class="text-sm font-medium text-gray-500 dark:text-gray-300">Método de pago</span>
                  <p class="text-base text-gray-900 dark:text-gray-50">${metodo}</p>
                </div>
                <div class="flex flex-col">
                  <span class="text-sm font-medium text-gray-500 dark:text-gray-300">Recurrencia</span>
                  <p class="text-base text-gray-900 dark:text-gray-50">${recurrencia}</p>
                </div>
                <div class="flex flex-col">
                  <span class="text-sm font-medium text-gray-500 dark:text-gray-300">Monto</span>

                  <div class="flex items-center gap-3">
                    <p id="pd_amount_value" class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">${amountStr}</p>

                    ${((p.recurrencia || 'Único') !== 'Único' && (p.estado || '').toLowerCase() !== 'completado')
                      ? `<button id="pd_amount_edit" class="h-8 px-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-200 dark:hover:bg-gray-600">
                           Editar
                         </button>` : ''
                    }
                  </div>

                  <div id="pd_amount_edit_wrap" class="hidden mt-2 flex items-center gap-2">
                    <div class="relative">
                      <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-[#617589] dark:text-gray-400 text-sm">$</span>
                      <input id="pd_amount_input" type="number" step="0.01"
                             class="form-input h-10 w-40 rounded-lg pl-7 text-sm bg-white dark:bg-gray-800 text-[#111418] dark:text-white"
                             value="${(Number(p.monto || 0)).toFixed(2)}" />
                    </div>
                    <button id="pd_amount_save" class="h-8 px-3 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700">Guardar</button>
                    <button id="pd_amount_cancel" class="h-8 px-3 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-200 dark:hover:bg-gray-600">Cancelar</button>
                  </div>
                </div>
              </div>

              ${recurrencia !== 'Único' ? `
              <!-- Sección colapsable para pagos fijos -->
              <div class="border-t border-gray-200/80 dark:border-gray-600/70 pt-6">
                <button id="toggleMoreDetails" class="w-full flex items-center justify-between text-left px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <span class="text-sm font-semibold text-gray-700 dark:text-gray-300">Ver más detalles</span>
                  <span class="material-symbols-outlined text-gray-500 dark:text-gray-400 transition-transform" id="toggleIcon">expand_more</span>
                </button>
                
                <div id="moreDetailsContent" class="hidden mt-4 space-y-5">
                  <!-- Vence -->
                  <div class="flex items-start">
                    <span class="material-symbols-outlined text-gray-500 dark:text-gray-300 mr-3">calendar_today</span>
                    <div class="flex flex-col">
                      <span class="text-sm font-medium text-gray-500 dark:text-gray-300">Vence</span>
                      <p class="text-base text-gray-900 dark:text-gray-50">${dueStr}</p>
                    </div>
                  </div>

                  <!-- Recordatorios -->
                  <div class="flex items-start">
                    <span class="material-symbols-outlined text-gray-500 dark:text-gray-300 mr-3">notifications</span>
                    <div class="flex flex-col">
                      <span class="text-sm font-medium text-gray-500 dark:text-gray-300">Recordatorios</span>
                      <p class="text-base text-gray-900 dark:text-gray-50">${reminders}</p>
                    </div>
                  </div>

                  ${p.attachmentUrl ? `
                  <!-- Comprobante -->
                  <div class="flex items-start">
                    <span class="material-symbols-outlined text-gray-500 dark:text-gray-300 mr-3">attach_file</span>
                    <div class="flex flex-col">
                      <span class="text-sm font-medium text-gray-500 dark:text-gray-300">Comprobante</span>
                      <a href="${p.attachmentUrl}" target="_blank" class="text-emerald-600 dark:text-emerald-400 underline">
                        Ver archivo ${p.attachmentName ? `(${p.attachmentName})` : ''}
                      </a>
                    </div>
                  </div>
                  ` : ''}

                  <!-- Adjuntos (solo pagos recurrentes) -->
                  <div id="pd-attachments" class="space-y-3">
                    <div class="text-sm font-medium text-gray-600 dark:text-gray-300">Comprobantes</div>
                    <div id="pd-att-list" class="space-y-2"></div>

                    <div class="mt-3">
                      <input id="pd-att-input" type="file" multiple accept="*/*" class="w-full text-sm text-gray-500 dark:text-gray-400
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-lg file:border-0
                        file:text-sm file:font-semibold
                        file:bg-primary file:text-white
                        hover:file:bg-primary/90
                        cursor-pointer" />
                      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Se aceptan PDF, Excel, Word, imágenes, etc.</p>
                    </div>
                  </div>

                  <!-- Histórico de pagos -->
                  <div class="mt-4 border-t border-gray-200 dark:border-gray-600 pt-4" id="pd-history">
                    <div class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Histórico de pagos</div>
                    <div id="pd-history-list" class="space-y-2 text-sm text-gray-800 dark:text-gray-200"></div>
                  </div>
                </div>
              </div>
              ` : `
              <div class="border-t border-gray-200/80 dark:border-gray-600/70 pt-6 space-y-5">
                <!-- Vence -->
                <div class="flex items-start">
                  <span class="material-symbols-outlined text-gray-500 dark:text-gray-300 mr-3">calendar_today</span>
                  <div class="flex flex-col">
                    <span class="text-sm font-medium text-gray-500 dark:text-gray-300">Vence</span>
                    <p class="text-base text-gray-900 dark:text-gray-50">${dueStr}</p>
                  </div>
                </div>

                <!-- Recordatorios -->
                <div class="flex items-start">
                  <span class="material-symbols-outlined text-gray-500 dark:text-gray-300 mr-3">notifications</span>
                  <div class="flex flex-col">
                    <span class="text-sm font-medium text-gray-500 dark:text-gray-300">Recordatorios</span>
                    <p class="text-base text-gray-900 dark:text-gray-50">${reminders}</p>
                  </div>
                </div>

                ${p.attachmentUrl ? `
                <!-- Comprobante -->
                <div class="flex items-start">
                  <span class="material-symbols-outlined text-gray-500 dark:text-gray-300 mr-3">attach_file</span>
                  <div class="flex flex-col">
                    <span class="text-sm font-medium text-gray-500 dark:text-gray-300">Comprobante</span>
                    <a href="${p.attachmentUrl}" target="_blank" class="text-emerald-600 dark:text-emerald-400 underline">
                      Ver archivo ${p.attachmentName ? `(${p.attachmentName})` : ''}
                    </a>
                  </div>
                </div>
                ` : ''}
              </div>
              `}
            </main>

            <!-- Footer -->
            <footer class="bg-gray-50 dark:bg-gray-800 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
              <button class="w-full sm:w-auto px-4 py-2.5 bg-transparent text-gray-600 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
                      data-close="true">Cerrar</button>

              ${!isCompleted(p) ? `
              <div class="flex gap-3 w-full sm:w-auto">
                <button id="pd_only_paid"
                        class="w-full sm:w-auto px-4 py-2.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-semibold rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900/50">
                  Marcar como pagado
                </button>
              </div>
              ` : ''}
            </footer>
          </div>
        </div>
      </div>
    `;

    root.classList.remove('hidden');

    // Toggle para "Ver más detalles" en pagos fijos
    const toggleBtn = root.querySelector('#toggleMoreDetails');
    const moreContent = root.querySelector('#moreDetailsContent');
    const toggleIcon = root.querySelector('#toggleIcon');
    
    if (toggleBtn && moreContent && toggleIcon) {
      toggleBtn.addEventListener('click', () => {
        const isHidden = moreContent.classList.contains('hidden');
        if (isHidden) {
          moreContent.classList.remove('hidden');
          toggleIcon.textContent = 'expand_less';
          toggleBtn.querySelector('span').textContent = 'Ver menos detalles';
        } else {
          moreContent.classList.add('hidden');
          toggleIcon.textContent = 'expand_more';
          toggleBtn.querySelector('span').textContent = 'Ver más detalles';
        }
      });
    }

    // Listeners
    root.querySelectorAll('[data-close="true"]').forEach(el =>
      el.addEventListener('click', () => root.classList.add('hidden'))
    );

    // Solo marcar pagado (mueve fecha si es recurrente)
    const markBtn = root.querySelector('#pd_only_paid');
    if (markBtn) {
      markBtn.addEventListener('click', () => {
        const fresh = window.PaymentManager.getAllPayments(true).find(x => x.id === p.id);
        if (!fresh) return;

        const due = (typeof getDueAt === 'function') ? getDueAt(fresh) : (fresh.fecha ? new Date(fresh.fecha) : null);

        if (due && Date.now() < due.getTime()) {
          const ok = confirm(`Aún no llega la fecha (${due.toLocaleString('es-ES')}). ¿Marcar como pagado por adelantado?`);
          if (!ok) return;
        }

        window.PaymentManager.markPaid(p.id, { moveNextIfRecurring: true });
        root.classList.add('hidden');
        // Refrescar la vista
        window.location.reload();
      });
    }

    // Marcar pagado y crear siguiente (si aplica la recurrencia)
    root.querySelector('#pd_paid_and_next')?.addEventListener('click', () => {
  const fresh = window.PaymentManager.getAllPayments(true).find(x => x.id === p.id);
  if (!fresh) return;

  const due = (typeof getDueAt === 'function') ? getDueAt(fresh) : (fresh.fecha ? new Date(fresh.fecha) : null);

  if (due && Date.now() < due.getTime()) {
    const ok = confirm(`Aún no llega la fecha (${due.toLocaleString('es-ES')}). ¿Marcar como pagado por adelantado?`);
    if (!ok) return;
  }

  window.PaymentManager.markPaid(p.id, { createNextIfRecurring: true });
  root.classList.add('hidden');
    });

    // Wire attachments para pagos recurrentes
    (function initAttachmentsSection(payment) {
      if ((payment.recurrencia || 'Único') === 'Único') return; // solo recurrentes

      const listEl = document.getElementById('pd-att-list');
      const inputEl = document.getElementById('pd-att-input');

      if (!listEl || !inputEl) return;

      function renderList() {
        const fresh = window.PaymentManager.getById(payment.id);
        const atts = Array.isArray(fresh?.attachments) ? fresh.attachments : [];
        if (!atts.length) {
          listEl.innerHTML = '<div class="text-gray-400 dark:text-gray-500 text-sm">— Sin archivos —</div>';
          return;
        }
        listEl.innerHTML = atts.map((a, i) => `
          <div class="flex items-center justify-between border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                <a href="${a.dataUrl}" download="${a.name}" target="_blank" class="hover:underline text-primary">${a.name || '(archivo)'}</a>
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400">${a.type || ''} ${a.size ? `• ${Math.round(a.size/1024)} KB` : ''}</div>
            </div>
            <button class="ml-3 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors" data-remove="${i}">
              Quitar
            </button>
          </div>
        `).join('');

        listEl.querySelectorAll('[data-remove]').forEach(btn => {
          btn.onclick = () => {
            const idx = Number(btn.dataset.remove);
            window.PaymentManager.removeAttachment(payment.id, idx);
            renderList();
          };
        });
      }

      renderList();

      inputEl.addEventListener('change', async () => {
        if (!inputEl.files?.length) return;
        for (const f of inputEl.files) {
          await window.PaymentManager.addAttachment(payment.id, f);
        }
        inputEl.value = '';
        renderList();
      });
    })(p);

    // Wire histórico de pagos para pagos recurrentes
    (function initHistorySection(payment) {
      if ((payment.recurrencia || 'Único') === 'Único') return; // solo recurrentes

      const wrap = document.getElementById('pd-history');
      const listEl = document.getElementById('pd-history-list');
      if (!wrap || !listEl) return;

      function renderHistory() {
        const fresh = window.PaymentManager.getById(payment.id);
        const hist = Array.isArray(fresh?._history) ? [...fresh._history] : [];

        if (!hist.length) {
          listEl.innerHTML = '<div class="text-gray-400 dark:text-gray-500">— Sin registros —</div>';
          return;
        }

        // Orden descendente por fecha de pago
        hist.sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));

        listEl.innerHTML = hist.map(h => `
          <div class="flex items-center justify-between border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-800">
            <span class="text-gray-700 dark:text-gray-300">${new Date(h.paidAt).toLocaleString('es-ES', { dateStyle:'medium', timeStyle:'short' })}</span>
            <span class="font-semibold text-emerald-600 dark:text-emerald-400">$${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(h.amount || 0)}</span>
          </div>
        `).join('');
      }

      // Render inicial
      renderHistory();

      // Re-render cuando cambie estado o se actualice el pago
      const rerender = () => renderHistory();
      window.addEventListener('paymentStatusChanged', rerender);
      window.addEventListener('paymentUpdated', rerender);
    })(p);

    // ----- Editar monto (sólo si existe el botón) -----
    (() => {
      const btnEdit   = root.querySelector('#pd_amount_edit');
      const wrapEdit  = root.querySelector('#pd_amount_edit_wrap');
      const input     = root.querySelector('#pd_amount_input');
      const viewValue = root.querySelector('#pd_amount_value');

      if (!btnEdit || !wrapEdit || !input || !viewValue) return;

      const showEdit = (v) => wrapEdit.classList.toggle('hidden', !v);

      btnEdit.addEventListener('click', () => showEdit(true));
      root.querySelector('#pd_amount_cancel')?.addEventListener('click', () => showEdit(false));

      root.querySelector('#pd_amount_save')?.addEventListener('click', () => {
        const val = Number.parseFloat(String(input.value).replace(',', '.'));
        if (!Number.isFinite(val) || val < 0) {
          alert('Ingresa un monto válido (>= 0).');
          return;
        }

        const updated = window.PaymentManager.update(p.id, { monto: val });
        if (updated) {
          // Refresca el texto mostrado
          const pretty = `$${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)}`;
          viewValue.textContent = pretty;
          showEdit(false);
        }
      });
    })();
  }
}

window.PaymentDetailsModal = PaymentDetailsModal;

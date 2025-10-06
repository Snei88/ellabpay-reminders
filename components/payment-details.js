// components/payment-details.js
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
                  <p class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">${amountStr}</p>
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
                  <div id="attBlock" class="space-y-3">
                    <div class="text-sm font-medium text-gray-600 dark:text-gray-300">Comprobantes</div>

                    <div id="attDrop" class="flex items-center justify-center h-28 rounded-lg border-2 border-dashed
                         border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800
                         text-gray-500 dark:text-gray-400 text-sm cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
                      Pega aquí (Ctrl + V), arrastra una imagen o haz click
                      <input id="attFile" type="file" accept="image/*" class="hidden">
                    </div>

                    <div id="attGrid" class="grid grid-cols-2 sm:grid-cols-3 gap-3"></div>
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

              <div class="flex gap-3 w-full sm:w-auto">
                <button id="pd_only_paid"
                        class="w-full sm:w-auto px-4 py-2.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-semibold rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900/50">
                  Marcar como pagado
                </button>
              </div>
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

    // Solo marcar pagado (no crea la siguiente)
    root.querySelector('#pd_only_paid')?.addEventListener('click', () => {
  const fresh = window.PaymentManager.getAllPayments(true).find(x => x.id === p.id);
  if (!fresh) return;

  const due = (typeof getDueAt === 'function') ? getDueAt(fresh) : (fresh.fecha ? new Date(fresh.fecha) : null);

  if (due && Date.now() < due.getTime()) {
    const ok = confirm(`Aún no llega la fecha (${due.toLocaleString('es-ES')}). ¿Marcar como pagado por adelantado?`);
    if (!ok) return;
  }

  window.PaymentManager.markPaid(p.id, { createNextIfRecurring: false });
  root.classList.add('hidden');
    });

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
    (function wireAttachments(payment) {
      if ((payment.recurrencia || 'Único') === 'Único') return; // solo recurrentes

      const drop = document.getElementById('attDrop');
      const file = document.getElementById('attFile');
      const grid = document.getElementById('attGrid');

      // abrir selector al click
      drop.addEventListener('click', () => file.click());

      // soltar
      drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('ring-2','ring-primary'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('ring-2','ring-primary'));
      drop.addEventListener('drop', async (e) => {
        e.preventDefault(); drop.classList.remove('ring-2','ring-primary');
        const img = [...e.dataTransfer.files].find(f => f.type.startsWith('image/'));
        if (img) await window.PaymentManager.addAttachmentFromBlob(payment.id, img);
        renderGrid();
      });

      // pegar desde portapapeles
      drop.addEventListener('paste', async (e) => {
        const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
        if (!item) return;
        const blob = item.getAsFile();
        if (blob) await window.PaymentManager.addAttachmentFromBlob(payment.id, blob);
        renderGrid();
      });

      // input file
      file.addEventListener('change', async () => {
        const img = file.files?.[0]; if (!img) return;
        await window.PaymentManager.addAttachmentFromBlob(payment.id, img);
        file.value = ''; renderGrid();
      });

      function renderGrid() {
        const fresh = window.PaymentManager.getAllPayments(true).find(p => p.id === payment.id) || payment;
        const atts = fresh.attachments || [];
        grid.innerHTML = atts.map(a => `
          <div class="relative group">
            <img src="${a.dataUrl}" alt="comprobante" class="w-full h-28 object-cover rounded-md border border-gray-200 dark:border-gray-700">
            <button data-att="${a.id}" class="js-att-del opacity-0 group-hover:opacity-100 transition
                    absolute top-1 right-1 bg-black/60 text-white text-xs px-2 py-1 rounded">
              Quitar
            </button>
          </div>
        `).join('') || '<div class="text-xs text-gray-500 dark:text-gray-400">Sin comprobantes</div>';
      }

      grid.addEventListener('click', (e) => {
        const del = e.target.closest('.js-att-del');
        if (!del) return;
        window.PaymentManager.removeAttachment(payment.id, del.dataset.att);
        renderGrid();
      });

      renderGrid();
    })(p);
  }
}

window.PaymentDetailsModal = PaymentDetailsModal;

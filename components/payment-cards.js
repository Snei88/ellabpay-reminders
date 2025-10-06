// components/payment-cards.js

// Devuelve un Date con la "hora real" de vencimiento, tolerando varios formatos
function getDueAt(p) {
  if (!p || !p.fecha) return null;
  // si p.fecha ya trae hora (ISO con T), úsala
  if (typeof p.fecha === 'string' && /T\d{2}:\d{2}/.test(p.fecha)) return new Date(p.fecha);
  // si llegó “fecha” sin hora pero tienes HH:MM
  if (p.hora && /^\d{2}:\d{2}$/.test(p.hora)) return new Date(`${p.fecha}T${p.hora}:00`);
  // fallback 09:00
  return new Date(`${p.fecha}T09:00:00`);
}

// Normaliza el estado visual a partir de la hora actual
function normalizedStatus(p, nowTs = Date.now()) {
  if ((p.estado || '').toLowerCase() === 'completado') return 'Completado';
  const due = getDueAt(p);
  if (!due) return 'Pendiente';
  // Tolerancia de 500ms para evitar falsos positivos por milisegundos
  return (due.getTime() < nowTs - 500) ? 'Atrasado' : 'Pendiente';
}

class PaymentCards {
  constructor() {
    this.upcomingContainer = document.getElementById('upcomingContainer');
    this.overdueContainer = document.getElementById('overdueContainer');
    this.fixedContainer = document.getElementById('fixedContainer');
  }

  init() {
    const all = window.PaymentManager.getAllPayments();
    const nowTs = Date.now();

    const isCompleted = p => (p.estado || '').toLowerCase() === 'completado';
    const isFixed = p => (p.recurrencia || 'Único') !== 'Único';

    const upcoming = all.filter(p => {
      const status = normalizedStatus(p, nowTs);
      return status === 'Pendiente' && !isFixed(p);
    });
    
    const overdue = all.filter(p => {
      const status = normalizedStatus(p, nowTs);
      return status === 'Atrasado' && !isFixed(p);
    });

    const fixed = all.filter(isFixed);

    this.renderSection(this.upcomingContainer, upcoming, 'No hay próximos pagos.');
    this.renderSection(this.overdueContainer, overdue, 'No hay pagos atrasados.');
    this.renderSection(this.fixedContainer, fixed, 'No hay pagos fijos.');
  }

  renderSection(container, list, emptyMsg) {
    if (!container) return;
    if (!list.length) {
      container.innerHTML = `<p class="text-gray-500">${emptyMsg}</p>`;
      return;
    }
    container.innerHTML = list.map(this.card).join('');
    // wire buttons: confirmar si se marca pagado antes de la fecha/hora real
    container.querySelectorAll('[data-action="mark-paid"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const p = window.PaymentManager.getAllPayments(true).find(x => x.id === id);
        if (!p) return;

        const due = getDueAt(p);
        if (due && Date.now() < due.getTime()) {
          const ok = confirm(`Aún no llega la fecha (${due.toLocaleString('es-ES')}). ¿Marcar como pagado por adelantado?`);
          if (!ok) return;
        }

        // crea la siguiente ocurrencia si es recurrente
        window.PaymentManager.markPaid(id, { createNextIfRecurring: true });
      });
    });

    // Toggle de acciones al hacer click en la tarjeta (sin activar si se clickea un botón)
    container.querySelectorAll('.js-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return; // no togglear si es botón
        // cerrar otras
        container.querySelectorAll('.js-card.is-open').forEach(c => {
          if (c !== card) c.classList.remove('is-open');
        });
        // alternar esta
        card.classList.toggle('is-open');
      });
    });

    // Ver detalles (abre modal de detalle)
    container.querySelectorAll('.js-view-details').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const pago = window.PaymentManager.getAllPayments().find(x => x.id === id);
        if (pago) PaymentDetailsModal.open(pago);
      });
    });

    // Eliminar con confirmación para pagos fijos
    container.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const p  = window.PaymentManager.getAllPayments(true).find(x => x.id === id);
        if (!p) return;

        const isFixed = (p.recurrencia || 'Único') !== 'Único';
        const label   = (p.recurrencia || 'Único').toLowerCase(); // mensual, trimestral, anual…

        const ok = isFixed
          ? confirm(`¿Eliminar este pago ${label}? Se moverá al historial como "Eliminado".`)
          : confirm('¿Eliminar este pago? Se moverá al historial como "Eliminado".');

        if (!ok) return;
        window.PaymentManager.delete(id); // soft delete → aparecerá en Historial
      });
  });

  }

  


  card(p) {
    const due = getDueAt(p);
    const dueStr = due ? due.toLocaleDateString('es-ES') : '—';
    const amount = p.monto ? new Intl.NumberFormat('es-ES').format(p.monto) : '—';
    
    // Preferir la fuente única de verdad si está expuesta por PaymentManager
    const status = (window.PaymentManager && typeof window.PaymentManager.getDerivedStatus === 'function')
      ? window.PaymentManager.getDerivedStatus(p)
      : normalizedStatus(p);
    const chipClass = status === 'Completado'
      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      : status === 'Atrasado'
      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';

    return `
      <div class="js-card relative rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800 shadow-sm pb-16">
        <div class="flex items-start justify-between">
          <div>
            <h4 class="text-base font-semibold">${p.nombre}</h4>
            <p class="text-sm text-gray-500">${p.descripcion || ''}</p>
          </div>
          <span class="text-xs px-2 py-1 rounded-full ${chipClass}">
            ${status}
          </span>
        </div>
        <div class="mt-3 grid grid-cols-3 gap-4 text-sm">
          <div>
            <div class="text-gray-500">Vence</div>
            <div class="font-medium">${dueStr}</div>
          </div>
          <div>
            <div class="text-gray-500">Monto</div>
            <div class="font-medium">${amount}</div>
          </div>
          <div>
            <div class="text-gray-500">Recordatorios</div>
            <div class="font-medium">${(p.reminderOffsetsDays || [7,3,1,0]).join(', ')}d</div>
          </div>
        </div>
        
        <!-- acciones en overlay (inicialmente ocultas) -->
        <div class="js-actions absolute left-4 right-4 bottom-4 transition-opacity duration-150 opacity-0 pointer-events-none">
        <div class="flex gap-2">
          <!-- Ver detalles (neutro) -->
          <button
            class="js-view-details inline-flex items-center gap-2 h-9 px-3 rounded-md border border-gray-300
                  bg-white text-gray-900 shadow-sm transition-colors
                  hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30
                  dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 dark:hover:bg-gray-700"
            data-id="${p.id}">
            Ver detalles
          </button>

          <!-- Eliminar (destructivo, menos saturado) -->
          <button
            class="js-delete inline-flex items-center gap-2 h-9 px-3 rounded-md border border-red-300
                  text-red-700 bg-red-50 shadow-sm transition-colors
                  hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/25
                  dark:border-red-800 dark:text-red-300 dark:bg-red-900/30 dark:hover:bg-red-900/50"
            data-id="${p.id}">
            Eliminar
          </button>
        </div>
      </div>

        </div>
      </div>
    `;
  }
}

window.PaymentCards = PaymentCards;

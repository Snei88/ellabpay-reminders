// components/notification-manager.js
// Gestiona la agenda de notificaciones en el sistema (vía IPC con main.js)

class NotificationManager {
  constructor() {
    // Configuración por defecto: días antes del vencimiento
    // Puedes cambiar/leer esto de una UI de ajustes.
    this.defaultOffsetsDays = [7, 3, 1, 0]; // 0 = día del pago
    this.defaultHour = 9; // 09:00 AM local
  }

  init() {
    // Programación inicial
    this.rescheduleAll();

    // Reaccionar a cambios
    window.addEventListener('paymentAdded', () => this.rescheduleAll());
    window.addEventListener('paymentStatusChanged', () => this.rescheduleAll());
    window.addEventListener('paymentDeleted', () => this.rescheduleAll());
    window.addEventListener('storage', (e) => {
      if (e.key === 'ellabpay_payments') this.rescheduleAll();
    });

    // Callback si el usuario hace click en la notificación
    if (window.RemindersAPI?.onClick) {
      window.RemindersAPI.onClick(({ id }) => {
        // Puedes abrir modal de detalle o navegar al pago
        console.log('Notificación clickeada:', id);
      });
    }
  }

  async rescheduleAll() {
    const payments = window.PaymentManager?.getAllPayments?.() || [];

    // Por simplicidad: borra y vuelve a crear recordatorios de cada pago (reemplazo determinista)
    const allExistingReminders = await window.RemindersAPI?.getAll?.();
    const existingIds = new Set(Object.keys(allExistingReminders || {}));

    const wantedIds = new Set();

    for (const p of payments) {
      // sólo notificar pagos pendientes / programados
      if (p.estado && p.estado.toLowerCase() === 'completado') continue;

      const due = new Date(p.fecha);
      if (Number.isNaN(due.getTime())) continue;

      const base = Array.isArray(p.reminderOffsetsDays) ? p.reminderOffsetsDays : [];
      const offsets = Array.from(new Set([...base, 0])); // 0d garantizado

      for (const d of offsets) {
        const id = `pay_${p.id}__d${d}`;
        wantedIds.add(id);

        const when = this.atTime(this.addDays(due, -d), p.hora || '09:00');
        if (when <= new Date()) continue; // No agendar en pasado

        const reminder = {
          id,
          reminderTime: when.toISOString(),
          title: `Recordatorio: ${p.nombre}`,
          description: `Vence ${due.toLocaleDateString('es-ES')}${p.monto ? ` • Monto: ${new Intl.NumberFormat('es-ES').format(p.monto)}` : ''}`,
          paymentId: p.id,
        };

        await window.RemindersAPI?.save?.(reminder);
      }

      // Extra: si está vencido y NO pagado, un "nudge" hoy a las 10:00
      const now = new Date();
      if (due < now && (!p.estado || p.estado.toLowerCase() !== 'completado')) {
        const nudgeId = `pay_${p.id}__overdue`;
        wantedIds.add(nudgeId);
        const when = this.atTime(new Date(), '10:00');
        if (when > now) {
          await window.RemindersAPI?.save?.({
            id: nudgeId,
            reminderTime: when.toISOString(),
            title: `Pago ATRASADO: ${p.nombre}`,
            description: `Venció el ${due.toLocaleDateString('es-ES')}.`,
            paymentId: p.id,
          });
        }
      }
    }

    // Limpieza: quitar recordatorios que ya no aplican
    for (const id of existingIds) {
      if (!wantedIds.has(id)) {
        await window.RemindersAPI?.remove?.(id);
      }
    }

    console.log('Notificaciones reprogramadas.');
  }

  // --- utils ---
  addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }
  atTime(date, hhmm = '09:00') {
    const [h, m] = (hhmm || '09:00').split(':').map(n => parseInt(n, 10));
    const d = new Date(date);
    d.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
    return d;
  }
}

window.NotificationManager = NotificationManager;

// components/payment-manager.js
(function () {
  const KEY = 'ellabpay_payments';

  // --- helpers ---
  function blobToDataUrl(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);   // data:image/...;base64,AAAA
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  }

  const STATUSES = {
    PENDIENTE: 'Pendiente',
    COMPLETADO: 'Completado',
    ATRASADO: 'Atrasado',
  };

  // Suma N meses manteniendo día de mes (con fallback al último día del mes destino)
  function addMonthsKeepDay(baseDate, monthsToAdd) {
    const y = baseDate.getFullYear();
    const m = baseDate.getMonth();
    const d = baseDate.getDate();
    const h = baseDate.getHours();
    const min = baseDate.getMinutes();
    const targetLastDay = new Date(y, m + monthsToAdd + 1, 0).getDate();
    const day = Math.min(d, targetLastDay);
    return new Date(y, m + monthsToAdd, day, h, min, 0, 0);
  }

  function computeNextDueISO(currentISO, recurrencia) {
    const cur = new Date(currentISO);
    switch (recurrencia) {
      case 'Mensual':
        return addMonthsKeepDay(cur, 1).toISOString();
      case 'Trimestral':
        return addMonthsKeepDay(cur, 3).toISOString();
      case 'Anual':
        return addMonthsKeepDay(cur, 12).toISOString();
      default:
        return null; // Único
    }
  }

  async function scheduleRemindersFor(payment) {
    if (!window.RemindersAPI?.save) return; // si no hay API, no hacemos nada

    const due = new Date(payment.fecha);
    const selected = Array.isArray(payment.reminderOffsetsDays) ? payment.reminderOffsetsDays : [];
    for (const offset of selected) {
      // fecha del recordatorio = vencimiento - offset días (misma hora)
      const when = new Date(due);
      when.setDate(when.getDate() - Number(offset || 0));
      // protege contra fechas en el pasado
      if (when.getTime() <= Date.now()) continue;

      await window.RemindersAPI.save({
        id: `rem_${payment.id}_${offset}`,
        reminderTime: when.toISOString(),
        title: `Recordatorio: ${payment.nombre}`,
        description: `Vence el ${due.toLocaleDateString('es-ES')} a las ${(payment.hora || '').slice(0,5)}.`
      });
    }
  }

  // --- Utils de fecha/estado ---
  function startOfToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()); // 00:00 local
  }

  function parseISO(dateStr) {
    // p.fecha se documenta como "ISO completo con hora"
    // Si no viene bien, Date(...) devolverá Invalid Date y lo manejamos abajo.
    return new Date(dateStr);
  }

  function getDerivedStatus(pago) {
    const raw = (pago.estado || '').toLowerCase();
    if (raw === STATUSES.COMPLETADO.toLowerCase()) return STATUSES.COMPLETADO;

    // Intentar usar helper global si existe (definido en payment-cards.js o history.html)
  let due = null;
    if (typeof getDueAt === 'function') {
      try { due = getDueAt(pago); } catch (e) { due = null; }
    } else {
      // Fallback local: soporta ISO con hora, fecha + hora (HH:MM) o fecha asumiendo 09:00
      if (!pago || !pago.fecha) return STATUSES.PENDIENTE;
      if (typeof pago.fecha === 'string' && /T\d{2}:\d{2}/.test(pago.fecha)) {
        due = new Date(pago.fecha);
      } else if (pago.hora && /^\d{2}:\d{2}$/.test(pago.hora)) {
        due = new Date(`${pago.fecha}T${pago.hora}:00`);
      } else {
        due = new Date(`${pago.fecha}T09:00:00`);
      }
    }

    if (!due || isNaN(due.getTime())) return STATUSES.PENDIENTE;
    // Comparación por hora exacta: si la hora ya pasó, está atrasado
    return due.getTime() < Date.now() ? STATUSES.ATRASADO : STATUSES.PENDIENTE;
  }

  function normalizeStatuses(list) {
    let changed = false;
    for (const p of list) {
      const derived = getDerivedStatus(p);
      if (p.estado !== derived) {
        p.estado = derived;
        changed = true;
      }
    }
    return changed;
  }

  const PaymentManager = {
  // Lee y normaliza timestamps; opcionalmente normaliza estados
  getAllPayments(includeDeleted = false) {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
      const list = Array.isArray(raw) ? raw : [];

      // Backfill de timestamps
      let patched = false;
      const nowIso = new Date().toISOString();
      for (const p of list) {
        if (!p.createdAt) { p.createdAt = p.fecha || nowIso; patched = true; }
        if (!p.updatedAt) { p.updatedAt = p.createdAt; patched = true; }
      }
      if (patched) {
        localStorage.setItem(KEY, JSON.stringify(list));
      }

      // Normalización de estados (si tienes esa función y devuelve true si mutó)
      if (typeof normalizeStatuses === 'function' && normalizeStatuses(list)) {
        localStorage.setItem(KEY, JSON.stringify(list));
        window.dispatchEvent(new Event('storage'));
      }

      // Filtrar eliminados si no se solicitan explícitamente
      return includeDeleted ? list : list.filter(p => !p.deleted);
    } catch {
      return [];
    }
    },
    saveAll(payments) {
      // Antes de guardar, normalizamos para evitar inconsistencias
      if (normalizeStatuses(payments)) {
        // ya se normalizó en memoria; continuamos a guardar
      }
      localStorage.setItem(KEY, JSON.stringify(payments));
      window.dispatchEvent(new Event('storage')); // para que otras vistas se enteren
    },

    addPayment(p) {
      const list = this.getAllPayments();
      const id = p.id || (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()));
      const nowIso = new Date().toISOString();

      const record = {
        id,
        nombre: p.nombre?.trim() || 'Pago sin nombre',
        descripcion: p.descripcion || '',
        categoria: p.categoria || '',
        fecha: p.fecha,           // ISO completo con hora (ej: 2025-10-02T09:00:00-05:00)
        hora: p.hora || '09:00',  // HH:MM guardada (informativa, ya que fecha trae hora)
        monto: Number(p.monto || 0),
        estado: p.estado || STATUSES.PENDIENTE,
        reminderOffsetsDays: Array.isArray(p.reminderOffsetsDays) ? p.reminderOffsetsDays : [7, 3, 1, 0],
        categoria: p.categoria || '',
        metodoPago: p.metodoPago || '',
        recurrencia: p.recurrencia || 'Único',
        notasInternas: p.notasInternas || '',
        attachmentUrl: p.attachmentUrl || null,
        attachmentName: p.attachmentName || '',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      // Si no está completado, derivamos estado para registrar coherente (Pendiente/Atrasado)
      if ((record.estado || '').toLowerCase() !== STATUSES.COMPLETADO.toLowerCase()) {
        record.estado = getDerivedStatus(record);
      }

      list.push(record);
      this.saveAll(list);
      window.dispatchEvent(new CustomEvent('paymentAdded', { detail: record }));
      // Programar recordatorios
      scheduleRemindersFor(record);
      return record;
    },

    setStatus(id, estado) {
      const list = this.getAllPayments();
      const idx = list.findIndex(p => p.id === id);
      if (idx >= 0) {
        list[idx].estado = estado;
        list[idx].updatedAt = new Date().toISOString();  
        // Si lo marcan manualmente como no-completado, volvemos a derivar (por si ya está atrasado)
        if ((estado || '').toLowerCase() !== STATUSES.COMPLETADO.toLowerCase()) {
          list[idx].estado = getDerivedStatus(list[idx]);
        }
        this.saveAll(list);
        window.dispatchEvent(new CustomEvent('paymentStatusChanged', { detail: list[idx] }));
      }
    },

    delete(id) {
      const list = this.getAllPayments();
      const idx = list.findIndex(p => p.id === id);
      if (idx >= 0) {
        list[idx].deleted = true;
        list[idx].deletedAt = new Date().toISOString();
        list[idx].updatedAt = new Date().toISOString();
        this.saveAll(list);
        window.dispatchEvent(new CustomEvent('paymentDeleted', { detail: list[idx] }));
      }
    },

    hardDelete(id) {
      const list = this.getAllPayments(true); // incluir eliminados
      const i = list.findIndex(p => p.id === id);
      if (i < 0) return;
      list.splice(i, 1);                      // borrar del array
      this.saveAll(list);
      window.dispatchEvent(new CustomEvent('paymentHardDeleted', { detail: id }));
    },

    async addAttachmentFromBlob(paymentId, blob) {
      const list = this.getAllPayments(true);
      const p = list.find(x => x.id === paymentId);
      if (!p) return null;

      // Solo permitir para NO "Único"
      if ((p.recurrencia || 'Único') === 'Único') return null;

      const dataUrl = await blobToDataUrl(blob);
      const att = {
        id: (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now())),
        mime: blob.type || 'image/png',
        size: blob.size || 0,
        createdAt: new Date().toISOString(),
        dataUrl,                 // persistente
      };
      (p.attachments ||= []).push(att);
      p.updatedAt = new Date().toISOString();
      this.saveAll(list);
      window.dispatchEvent(new CustomEvent('paymentAttachmentAdded', {
        detail: { paymentId, attachment: att }
      }));
      return att;
    },

    removeAttachment(paymentId, attachmentId) {
      const list = this.getAllPayments(true);
      const p = list.find(x => x.id === paymentId);
      if (!p || !Array.isArray(p.attachments)) return;
      p.attachments = p.attachments.filter(a => a.id !== attachmentId);
      p.updatedAt = new Date().toISOString();
      this.saveAll(list);
      window.dispatchEvent(new CustomEvent('paymentAttachmentRemoved', {
        detail: { paymentId, attachmentId }
      }));
    },

    markPaid(id, { createNextIfRecurring = true } = {}) {
      const list = this.getAllPayments();
      const idx = list.findIndex(p => p.id === id);
      if (idx < 0) return;

      // 1) marcar pagado
      list[idx].estado = 'Completado';
      list[idx].updatedAt = new Date().toISOString();   // ← IMPORTANTE
      this.saveAll(list);
      window.dispatchEvent(new CustomEvent('paymentStatusChanged', { detail: list[idx] }));

      // 2) si tiene recurrencia, clonar con próxima fecha
      const p = list[idx];
      const nextISO = createNextIfRecurring ? computeNextDueISO(p.fecha, p.recurrencia) : null;
      if (nextISO) {
        const next = {
          // id nuevo
          nombre: p.nombre,
          descripcion: p.descripcion,
          categoria: p.categoria,
          fecha: nextISO,
          hora: p.hora,
          monto: p.monto,
          estado: 'Pendiente',
          reminderOffsetsDays: p.reminderOffsetsDays,
          metodoPago: p.metodoPago,
          recurrencia: p.recurrencia,
          notasInternas: p.notasInternas,
          attachmentUrl: null,          // normalmente la nueva ocurrencia no hereda el archivo
          attachmentName: ''
        };
        const created = this.addPayment(next);
        scheduleRemindersFor(created);
      }
    },

    // Exponer helpers si quieres usarlos en el render
    getDerivedStatus,
    STATUSES,
  };

  window.PaymentManager = PaymentManager;
})();

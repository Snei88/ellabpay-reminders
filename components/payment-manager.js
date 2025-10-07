// components/payment-manager.js
(function () {
  const KEY = 'ellabpay_payments';

  // --- CATEGORIES (fuente de verdad) ---
  const DEFAULT_CATEGORIES = [
    'Vivienda',
    'Servicios',
    'Internet/Telefonía',
    'Suscripciones',
    'Proveedores',
    'Nómina',
    'Impuestos y Tasas',
    'Educación',
    'Salud',
    'Transporte',
    'Seguros',
    'Créditos/Tarjetas',
    'Entretenimiento',
    'Otros'
  ];

  // --- helpers ---
  function blobToDataUrl(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);   // data:image/...;base64,AAAA
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  }

  // === Helpers de fecha para recurrencias ===
  function toDateParts(iso) {
    const d = new Date(iso);
    return { y: d.getFullYear(), m: d.getMonth(), day: d.getDate(), hh: d.getHours(), mm: d.getMinutes(), ss: d.getSeconds() };
  }
  function pad2(n){ return String(n).padStart(2, '0'); }
  function endOfMonth(year, month){ return new Date(year, month + 1, 0).getDate(); }

  /** Deriva estado a partir de la fecha */
  function deriveStatus(fechaISO){
    if (!fechaISO) return 'Pendiente';
    const now = Date.now();
    const t = Date.parse(fechaISO);
    if (isNaN(t)) return 'Pendiente';
    return t < now ? 'Atrasado' : 'Pendiente';
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
    // --- CATEGORIES HELPERS ---
    getCategories() {
      try {
        const raw = localStorage.getItem('ellabpay_categories');
        const list = raw ? JSON.parse(raw) : null;
        return (Array.isArray(list) && list.length) ? list : DEFAULT_CATEGORIES;
      } catch { return DEFAULT_CATEGORIES; }
    },

    setCategories(list) {
      if (Array.isArray(list) && list.length) {
        localStorage.setItem('ellabpay_categories', JSON.stringify(list));
        window.dispatchEvent(new Event('categoriesChanged'));
      }
    },

    normalizeCategory(cat) {
      const list = this.getCategories();
      if (!cat) return 'Otros';
      // intenta match insensible a mayúsculas/acentos
      const norm = (s)=> s.toString().normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();
      const i = list.findIndex(x => norm(x) === norm(cat));
      return i >= 0 ? list[i] : 'Otros';
    },

    // --- ATTACHMENTS HELPERS ---
    getById(id) {
      const all = this.getAllPayments(true);
      return all.find(x => x.id === id);
    },

    blobToDataUrl(blob) {
      return blobToDataUrl(blob);
    },

    async addAttachment(id, fileOrAtt) {
      const all = this.getAllPayments(true);
      const p = all.find(x => x.id === id);
      if (!p) return false;

      let att = fileOrAtt;
      if (!fileOrAtt.dataUrl) {
        att = {
          name: fileOrAtt.name,
          type: fileOrAtt.type || 'application/octet-stream',
          size: fileOrAtt.size || 0,
          dataUrl: await this.blobToDataUrl(fileOrAtt),
        };
      }

      p.attachments = Array.isArray(p.attachments) ? p.attachments : [];
      p.attachments.push(att);
      p.updatedAt = new Date().toISOString();
      localStorage.setItem(KEY, JSON.stringify(all));
      window.dispatchEvent(new Event('paymentUpdated'));
      return true;
    },

    removeAttachment(id, index) {
      const all = this.getAllPayments(true);
      const p = all.find(x => x.id === id);
      if (!p) return false;
      p.attachments = Array.isArray(p.attachments) ? p.attachments : [];
      p.attachments.splice(index, 1);
      p.updatedAt = new Date().toISOString();
      localStorage.setItem(KEY, JSON.stringify(all));
      window.dispatchEvent(new Event('paymentUpdated'));
      return true;
    },

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
        attachments: Array.isArray(p.attachments) ? p.attachments : [],
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

    update(id, patch = {}) {
      const list = this.getAllPayments(true);
      const i = list.findIndex(p => p.id === id);
      if (i < 0) return null;

      const allow = new Set([
        'nombre','descripcion','categoria','fecha','hora','monto',
        'reminderOffsetsDays','metodoPago','recurrencia','notasInternas'
      ]);

      for (const k of Object.keys(patch)) {
        if (!allow.has(k)) continue;
        list[i][k] = (k === 'monto') ? Number(patch[k] || 0) : patch[k];
      }
      list[i].updatedAt = new Date().toISOString();

      this.saveAll(list);
      window.dispatchEvent(new CustomEvent('paymentUpdated', { detail: list[i] }));
      return list[i];
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

    // === Helpers de recurrencia ===
    computeNextDueISO(fechaISO, recurrencia, horaStr) {
      if (!fechaISO) return null;
      const { y, m, day, hh, mm, ss } = toDateParts(fechaISO);
      const [h2, m2] = (horaStr || `${pad2(hh)}:${pad2(mm)}`).split(':').map(x=>parseInt(x||'0',10));

      if (!recurrencia || recurrencia.toLowerCase() === 'único' || recurrencia.toLowerCase() === 'unico') {
        return null;
      }
      if (recurrencia.toLowerCase().startsWith('mensual')) {
        // Mes siguiente, respetando el mismo día si existe (clamp al fin de mes)
        const ny = m === 11 ? y + 1 : y;
        const nm = (m + 1) % 12;
        const last = endOfMonth(ny, nm);
        const nd = Math.min(day, last);
        const next = new Date(ny, nm, nd, h2||0, m2||0, ss||0);
        return next.toISOString();
      }

      // Puedes extender para 'Trimestral', 'Anual', etc.
      return null;
    },

    // === Marcar como pagado (con soporte de recurrencia) ===
    markPaid(id, opts = { moveNextIfRecurring: true }) {
      const raw = localStorage.getItem(KEY);
      const arr = raw ? JSON.parse(raw) : [];
      const i = arr.findIndex(p => p.id === id);
      if (i < 0) return false;

      const p = arr[i];

      // 1) Registrar histórico de pago
      p._history = Array.isArray(p._history) ? p._history : [];
      p._history.push({ paidAt: new Date().toISOString(), amount: Number(p.monto || 0) });

      // 2) Si es recurrente mensual y se pide mover, ajustar a la próxima fecha
      const rec = (p.recurrencia || '').toLowerCase();
      if (opts.moveNextIfRecurring && rec && !rec.includes('único') && !rec.includes('unico')) {
        const nextISO = this.computeNextDueISO(p.fecha, p.recurrencia, p.hora);
        if (nextISO) {
          p.fecha = nextISO;                  // mover al siguiente mes
          p.estado = deriveStatus(nextISO);   // normalmente 'Pendiente'
          p.updatedAt = new Date().toISOString();
          // Nota: conservamos misma hora, recordatorios, etc.
        } else {
          p.estado = 'Completado';
          p.updatedAt = new Date().toISOString();
        }
      } else {
        // No recurrente → completar
        p.estado = 'Completado';
        p.updatedAt = new Date().toISOString();
      }

      arr[i] = p;
      localStorage.setItem(KEY, JSON.stringify(arr));

      // Notificar a la app
      window.dispatchEvent(new Event('paymentStatusChanged'));
      window.dispatchEvent(new Event('paymentsChanged'));

      // Reagendar recordatorios para la "nueva" fecha
      try { window.NotificationManager?.rescheduleAll?.(); } catch {}
      return true;
    },

    // Exponer helpers si quieres usarlos en el render
    getDerivedStatus,
    STATUSES,
  };

  window.PaymentManager = PaymentManager;
})();

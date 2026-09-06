export function normalizeBooking(b) {
  if (!b) return null;
  
  let items = b.items || (b.booking_items ? b.booking_items.map(bi => bi.inventory || (bi.inventory_id ? { id: bi.inventory_id, name: bi.inventory_id, qty: 1 } : null)).filter(Boolean) : []);
  
  // If items is empty but return_checklist exists, generate items from return_checklist keys
  if ((!items || items.length === 0) && b.return_checklist && typeof b.return_checklist === 'object') {
    items = Object.keys(b.return_checklist).map(rawKey => {
      const parts = rawKey.split('|');
      const name = parts[parts.length - 1] || rawKey;
      const cat = parts.length > 1 ? parts[0] : '';
      return { name, cat, status: 'ready' };
    });
  }

  const start = b.date_start ? b.date_start.split('T')[0] : (b.dateStart || b.startDate || '');
  const end = b.date_end ? b.date_end.split('T')[0] : (b.dateEnd || b.endDate || '');
  
  const rawNote = b.return_note || b.returnNote || '';
  const proofUrlMatch = typeof rawNote === 'string' ? rawNote.match(/\[Foto Bukti\]:\s*(https?:\/\/[^\s]+)/) : null;
  const returnProofUrl = proofUrlMatch ? proofUrlMatch[1] : (b.return_proof_url || b.returnProofUrl || '');
  const cleanReturnNote = typeof rawNote === 'string' ? rawNote.replace(/\[Foto Bukti\]:\s*https?:\/\/[^\s]+/g, '').trim() : '';

  const originVal = b.origin || b.userOrigin || (b.user_nim || b.userNim ? 'internal' : 'internal');
  const deptVal = b.dept || b.userDept || '';

  return {
    ...b,
    _key: b.id,
    id: b.id,
    uid: b.uid || '',
    status: b.status || 'pending',
    userName: b.user_name || b.userName || b.name || b.nama || '-',
    user_name: b.user_name || b.userName || b.name || b.nama || '-',
    userPhone: b.user_phone || b.userPhone || b.phone || b.hp || '',
    user_phone: b.user_phone || b.userPhone || b.phone || b.hp || '',
    userEmail: b.user_email || b.userEmail || b.email || '',
    userNim: b.user_nim || b.userNim || b.nim || '',
    user_nim: b.user_nim || b.userNim || b.nim || '',
    userOrigin: originVal,
    origin: originVal,
    userDept: deptVal,
    dept: deptVal,
    purpose: b.purpose || b.keperluan || '',
    dateStart: start,
    dateEnd: end,
    startDate: start,
    endDate: end,
    date_start: start,
    date_end: end,
    supportingDocUrl: b.doc_url || b.supportingDocUrl || '',
    doc_url: b.doc_url || b.supportingDocUrl || '',
    returnChecklist: b.return_checklist || b.returnChecklist || null,
    return_checklist: b.return_checklist || b.returnChecklist || null,
    returnNote: cleanReturnNote,
    return_note: cleanReturnNote,
    returnProofUrl: returnProofUrl,
    return_proof_url: returnProofUrl,
    createdAt: b.created_at || b.createdAt || '',
    created_at: b.created_at || b.createdAt || '',
    timestamp: b.created_at ? new Date(b.created_at).getTime() : (b.timestamp || 0),
    items: items,
    booking_items: b.booking_items
  };
}

export function fmtDate(d) {
  if (!d) return "-";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
  } catch {
    return d;
  }
}

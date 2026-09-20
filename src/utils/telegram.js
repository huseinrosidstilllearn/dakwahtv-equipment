/**
 * Telegram Bot Notification Utility
 * Handles sending alerts and status updates to Telegram groups/channels.
 * Dispatches through the secure Cloudflare Pages Function (/api/send-telegram)
 * with a fallback for local dev.
 */

/**
 * Send an alert message to a Telegram group or channel
 * @param {Object} options
 * @param {string} options.text The message text (Markdown supported)
 * @param {string} [options.chatId] Target Telegram Chat ID (e.g. -100xxxxxxx)
 * @param {string} [options.botToken] Telegram Bot Token from @BotFather
 * @param {string} [options.parseMode='Markdown'] Markdown or HTML
 * @returns {Promise<{success: boolean, messageId?: number, error?: string}>}
 */
export async function sendTelegramAlert({ text, chatId, botToken, parseMode = 'Markdown' }) {
  if (!text || !text.trim()) {
    return { success: false, error: 'Pesan Telegram tidak boleh kosong.' };
  }

  // 1. Send via Cloudflare Pages edge function
  try {
    const res = await fetch('/api/send-telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        chatId,
        botToken,
        parseMode
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.ok) {
        return { success: true, messageId: data.messageId, chat: data.chat };
      }
      return { success: false, error: data.error || 'Gagal mengirim pesan Telegram.' };
    }
  } catch {
    // Edge function unreachable (local dev mode), fallback to direct API if botToken provided
  }

  // 2. Direct browser fallback (for local development)
  if (botToken && chatId) {
    try {
      const cleanToken = botToken.trim();
      const res = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId.trim(),
          text,
          parse_mode: parseMode,
          disable_web_page_preview: false
        })
      });

      const data = await res.json();
      if (data.ok) {
        return { success: true, messageId: data.result?.message_id };
      }
      return { success: false, error: data.description || 'Gagal mengirim pesan via direct API.' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  return { success: false, error: 'Tidak dapat menghubungi gateway Telegram.' };
}

/**
 * Send an interactive test message to verify Telegram Bot configuration
 * @param {string} botToken Telegram Bot Token
 * @param {string} chatId Telegram Chat ID
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function testTelegramBotConnection(botToken, chatId) {
  if (!botToken?.trim()) {
    return { success: false, message: 'Harap masukkan Bot Token dari @BotFather.' };
  }
  if (!chatId?.trim()) {
    return { success: false, message: 'Harap masukkan Chat ID target (grup atau akun pribadi).' };
  }

  const testMessage = `🤖 *DAKWAH TV EQUIPMENT — UJI BOT TELEGRAM*\n\n` +
    `✅ *Koneksi Berhasil!*\n` +
    `Bot notifikasi Dakwah TV telah terhubung ke grup ini dan siap mengirimkan pembaruan sistem.\n\n` +
    `⏰ *Waktu Uji:* ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB\n` +
    `📍 *Sistem:* Dakwah TV Equipment Library v4.0.0`;

  const result = await sendTelegramAlert({
    text: testMessage,
    chatId: chatId.trim(),
    botToken: botToken.trim()
  });

  if (result.success) {
    return {
      success: true,
      message: `Pesan uji coba berhasil terkirim ke Telegram (ID Pesan: ${result.messageId})!`
    };
  } else {
    return {
      success: false,
      message: result.error || 'Gagal mengirim pesan uji coba ke Telegram.'
    };
  }
}

/**
 * Format new booking alert for Telegram broadcast
 * @param {Object} booking Booking details
 * @param {Array} items List of borrowed items
 * @returns {string} Markdown formatted Telegram message
 */
export function formatBookingTelegramMessage(booking, items = []) {
  const fmtDate = (dStr) => dStr ? dStr.split('-').reverse().join('/') : '-';
  const itemListText = items && items.length > 0
    ? items.map((it, idx) => `  ${idx + 1}. *${it.name || it.item_name || 'Alat'}* (${it.category || it.kategori || 'Unit'})`).join('\n')
    : '  _(Daftar alat tercantum di sistem)_';

  return `📢 *PENGAJUAN PINJAM ALAT BARU*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🆔 *ID Booking:* \`#${booking.id || '-'}\`\n` +
    `👤 *Peminjam:* ${booking.userName || booking.name || '-'}\n` +
    `📺 *Unit/Program:* ${booking.userDept || booking.dept || '-'}\n` +
    `📱 *WhatsApp:* \`${booking.userPhone || '-'}\`\n` +
    `📅 *Periode:* ${fmtDate(booking.dateStart)} s/d ${fmtDate(booking.dateEnd)}\n\n` +
    `📦 *Daftar Peralatan (${items.length} item):*\n` +
    `${itemListText}\n\n` +
    `🔗 *Buka Dashboard Admin:*\n` +
    `https://dakwahtvequipment.pages.dev/admin`;
}

/**
 * Format booking status change for Telegram broadcast
 * @param {Object} options
 * @returns {string} Markdown formatted message
 */
export function formatBookingStatusTelegramMessage({ booking, newStatus, adminEmail }) {
  const statusLabels = {
    approved: '✅ DISETUJUI (Menunggu Pengambilan)',
    rejected: '❌ DITOLAK',
    active: '🎥 SEDANG DIPINJAM (Alat Telah Diambil)',
    picked_up: '🎥 SEDANG DIPINJAM (Alat Telah Diambil)',
    returned: '📦 TELAH DIKEMBALIKAN (Selesai)',
    returned_late: '⚠️ DIKEMBALIKAN TERLAMBAT',
    letter_ready: '📄 SURAT & ALAT SIAP DIAMBIL'
  };

  const label = statusLabels[newStatus] || newStatus.toUpperCase();

  return `🔔 *UPDATE STATUS PEMINJAMAN ALAT*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🆔 *ID:* \`#${booking.id || '-'}\`\n` +
    `👤 *Peminjam:* ${booking.userName || booking.name || '-'}\n` +
    `📺 *Program:* ${booking.userDept || booking.dept || '-'}\n` +
    `📌 *Status Baru:* *${label}*\n` +
    `👮 *Diperbarui Oleh:* ${adminEmail || 'Admin'}\n` +
    `⏰ *Waktu:* ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`;
}

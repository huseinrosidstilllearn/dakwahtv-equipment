export const DEFAULT_WA_TEMPLATES = {
  adminNewBooking: `🚨 *BOOKING BARU MASUK!* 🚨

Halo Admin! Ada pengajuan booking baru masuk nih:

📋 *ID Booking:* {id}
👤 *Nama:* {nama}
🎬 *Program:* {program}
📅 *Pinjam:* {tgl_pinjam}
📅 *Kembali:* {tgl_kembali}

Yuk segera diproses ya... ⏳✨

🤖 *Bot Dakwah TV Equipment* 🎬

_Jangan Balas Pesan ini_`,

  userPending: `Halo {nama}! 👋

Pengajuan booking alat kamu sudah masuk dan tercatat di sistem:

📋 *ID Booking:* {id}
🎬 *Program:* {program}
📅 *Pinjam:* {tgl_pinjam}
📅 *Kembali:* {tgl_kembali}

Status saat ini: *MENUNGGU PERSETUJUAN* admin ⏳
Mohon ditunggu sebentar ya kak.

Jika booking sudah disetujui, link Surat Peminjaman Alat (SPA PDF) resmi akan dikirim otomatis lewat chat ini 🔔

Thank you! 🙏✨

🤖 *Bot Dakwah TV Equipment* 🎬

_Jangan Balas Pesan ini_`,

  userApproved: `Halo {nama}! 👋

Yeay! Booking alat kamu dengan ID *{id}* sudah *DISETUJUI*! ✅🎉

🎬 *Program:* {program}
📅 *Pinjam:* {tgl_pinjam}
📅 *Kembali:* {tgl_kembali}

Surat Peminjaman Alat (SPA PDF) resmi bisa langsung diunduh di sini ya (format PDF ringan & otomatis) 👇
🔗 {link_surat}

Nanti tinggal tunjukkan suratnya saat ambil alat di studio. Ditunggu ya! 🎥✨

🤖 *Bot Dakwah TV Equipment* 🎬

_Jangan Balas Pesan ini_`,

  userRejected: `Halo {nama}! 👋

Mohon maaf banget ya 😔 Pengajuan booking kamu dengan ID *{id}* belum bisa kami setujui (*DITOLAK*). ❌

Kalau mau tahu alasannya atau mau atur jadwal baru, langsung hubungi admin ya kak 🙏

Semoga lain waktu bisa booking lagi! 💪✨

🤖 *Bot Dakwah TV Equipment* 🎬

_Jangan Balas Pesan ini_`,

  userReturned: `Halo {nama}! 👋

Peralatan untuk booking ID *{id}* sudah kami terima kembali ✅

Terima kasih banyak sudah meminjam dan menjaga alatnya dengan baik! 🙏😄
Sampai jumpa di booking berikutnya! 🎬✨

🤖 *Bot Dakwah TV Equipment* 🎬

_Jangan Balas Pesan ini_`,

  reminderPickup: `Halo {nama}! 👋

Pengingat jadwal pengambilan alat nih 😄
Peralatan untuk booking ID *{id}* sudah siap di studio 🎥✨

📅 *Tgl Pinjam:* {tgl_pinjam}

Jangan lupa datang sesuai jadwal ya kak. Semangat produksinya! 🎬😎

🤖 *Bot Dakwah TV Equipment* 🎬

_Jangan Balas Pesan ini_`,

  reminderReturn: `Halo {nama}! 👋

Sekadar mengingatkan ya kak ⏰ Masa peminjaman alat untuk booking ID *{id}* sudah mendekati batas waktu nih.

📅 *Tgl Kembali:* {tgl_kembali}

Mohon segera mengembalikan alatnya ke studio ya. Thank you banget! 🙏😄

🤖 *Bot Dakwah TV Equipment* 🎬

_Jangan Balas Pesan ini_`
};

export const sanitizeWaTemplate = (template, fallbackKey) => {
  if (!template || typeof template !== 'string') return DEFAULT_WA_TEMPLATES[fallbackKey] || '';
  if (template.includes('??') || template.includes('\uFFFD') || template.includes('dY')) {
    return DEFAULT_WA_TEMPLATES[fallbackKey] || template;
  }
  return template;
};

export const sendWhatsAppMessage = async (target, message) => {
  const token = '6zWjLzHFtYJavkm7y3qT'; // Fonnte API Token

  if (!target || !message) return false;

  try {
    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': token,
      },
      body: new URLSearchParams({
        target: target,
        message: message,
        countryCode: '62', // Default to Indonesia
      }),
    });

    const data = await response.json();
    console.log('Fonnte Response:', data);
    return data.status;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return false;
  }
};

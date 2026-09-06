import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Menu, X, BookOpen, ChevronRight, Hash, ShoppingCart } from 'lucide-react';

const SopTeknis = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('peminjaman-alat');

  const sections = [
    { id: 'peminjaman-alat', title: 'Peminjaman Alat' },
    { id: 'studio', title: 'Penggunaan Studio' },
    { id: 'mcr', title: 'Master Control Room (MCR)' },
    { id: 'editor-video', title: 'Editor dan Video' },
    { id: 'ruang-editor', title: 'Ruang Editor & Library' },
    { id: 'creative-media', title: 'Creative Media' },
    { id: 'event-penyiaran', title: 'Event & Penyiaran' }
  ];

  // Handle scroll spy to highlight active section
  useEffect(() => {
    const handleScroll = () => {
      const sectionElements = sections.map(s => document.getElementById(s.id));
      const scrollPosition = window.scrollY + 100; // offset for header

      for (let i = sectionElements.length - 1; i >= 0; i--) {
        const element = sectionElements[i];
        if (element && element.offsetTop <= scrollPosition) {
          setActiveSection(sections[i].id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      window.scrollTo({
        top: element.offsetTop - 80, // offset for top padding
        behavior: 'smooth'
      });
      setActiveSection(id);
      setIsSidebarOpen(false);
    }
  };

  const SectionHeading = ({ id, title }) => (
    <h2 id={id} className="text-2xl lg:text-3xl font-black tracking-tight mb-6 mt-12 pb-4 border-b border-border flex items-center group cursor-pointer" onClick={() => scrollToSection(id)}>
      <Hash className="w-6 h-6 mr-3 text-primary/30 group-hover:text-primary transition-colors" />
      {title}
    </h2>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30">
      
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border h-16 flex items-center justify-between px-4 lg:px-8">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="lg:hidden p-2 rounded-xl hover:bg-accent text-foreground">
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-105 transition-transform">
              <BookOpen className="w-4 h-4 text-primary" />
            </div>
            <span className="font-black text-lg tracking-tight hidden sm:block">Dokumentasi SOP</span>
          </Link>
        </div>
        
        <Link to="/katalog" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all text-sm font-bold">
          <ShoppingCart className="w-4 h-4" /> Katalog
        </Link>
      </header>

      <div className="flex-1 flex max-w-7xl mx-auto w-full relative">
        
        {/* Sidebar Navigation */}
        <aside className={`fixed inset-y-0 left-0 pt-16 z-40 w-72 bg-background/95 backdrop-blur-xl border-r border-border transform transition-transform duration-300 lg:translate-x-0 lg:static lg:bg-transparent lg:border-none lg:pt-8 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="h-full overflow-y-auto p-6 scrollbar-hide">
            <div className="mb-8">
              <h3 className="font-mono text-xs font-bold text-foreground/50 uppercase tracking-widest mb-4 px-2">Table of Contents</h3>
              <nav className="space-y-1">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeSection === section.id ? 'bg-primary/10 text-primary' : 'text-foreground/70 hover:bg-accent hover:text-foreground'}`}
                  >
                    {section.title}
                    {activeSection === section.id && <ChevronRight className="w-4 h-4" />}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile sidebar */}
        {isSidebarOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
        )}

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 max-w-3xl px-6 lg:px-12 py-8 lg:py-12 prose prose-stone dark:prose-invert prose-headings:font-black prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold font-mono mb-6 uppercase tracking-widest">
              Dakwah TV 2026
            </div>
            <h1 className="text-4xl lg:text-5xl font-black tracking-tight leading-tight mb-4">SOP Teknis & Produksi</h1>
            <p className="text-lg text-foreground/70 leading-relaxed font-medium">
              Panduan standar operasional untuk peminjaman alat, tata tertib studio, MCR, manajemen file, dan spesifikasi teknis produksi di Dakwah TV.
            </p>
          </div>

          <div className="space-y-4">
            <SectionHeading id="peminjaman-alat" title="Peminjaman Alat" />
            <ul className="list-disc pl-5 space-y-2 text-foreground/80 leading-relaxed">
              <li>Setiap peminjaman alat Dakwah TV harus diketahui Teknis dan Eksekutif Produser.</li>
              <li>Peminjam harus tercatat dan menyerahkan SPA (Surat Peminjaman Alat) maksimal H-3.</li>
              <li>Alat yang dipinjam untuk produksi saat <em>weekend</em> harus dikembalikan pada anggota teknis terdekat, tidak diperkenankan mengalihkan alat secara langsung. Pengembalian harus bertemu langsung dengan Teknis.</li>
              <li>Lama peminjaman dilaksanakan sesuai jam kerja yaitu <strong>08.00 – 17.00</strong>, kecuali ada event/produksi malam hari. Peminjaman bagi selain kru Dakwah TV maksimal 1x24 jam.</li>
              <li><strong>Alat tidak boleh dibawa pulang</strong> (sanksi berlaku), kecuali produksi saat <em>weekend</em> atau hari libur.</li>
              <li>Alat tidak boleh digunakan selain untuk kegiatan Dakwah TV tanpa koordinasi & pendampingan dengan jaminan KTP.</li>
              <li>Setiap kerusakan/kehilangan alat menjadi tanggung jawab penuh peminjam, dan <strong>wajib mengganti dengan spesifikasi yang sama</strong>.</li>
              <li>Kelengkapan produksi disiapkan di dalam <em>box</em>, dan harus dikembalikan ke dalam <em>box</em> sesuai catatan.</li>
            </ul>

            <SectionHeading id="studio" title="Penggunaan Studio" />
            <ul className="list-disc pl-5 space-y-2 text-foreground/80 leading-relaxed">
              <li>Studio dibuka pada pukul <strong>08.00 - 20.00 WIB</strong>. Mahasiswa yang berniat menggunakan melebihi jam operasional wajib memiliki izin dari Station Manager dan Kepala Laboratorium.</li>
              <li>Alas kaki wajib ditata rapi di rak sepatu.</li>
              <li>Kru wajib menggunakan <em>id card</em> di dalam forum saat di studio.</li>
              <li>Wajib menjaga kebersihan. Denda pembuangan sampah sembarangan sebesar Rp. 2000 per satuan sampah.</li>
              <li>Boleh membawa makanan, namun <strong>wajib dimakan di luar ruang MCR dan ruang editor</strong>.</li>
              <li>Dilarang membawa properti atau peralatan keluar Studio kecuali saat produksi program.</li>
              <li>Setiap barang yang dititipkan di studio bukan menjadi tanggung jawab teknis jika terjadi kerusakan/kehilangan.</li>
              <li>Setelah pembuatan properti, studio wajib dibersihkan kembali seperti sedia kala.</li>
            </ul>

            <SectionHeading id="mcr" title="Master Control Room (MCR)" />
            <ul className="list-disc pl-5 space-y-2 text-foreground/80 leading-relaxed">
              <li>Semua kru dilarang membawa makanan dan minuman ke ruang MCR.</li>
              <li>Dilarang meninggalkan sampah. (Denda Rp. 2000/sampah).</li>
              <li>Jika ingin produksi menggunakan MCR, <strong>wajib menghubungi anggota Teknis H-2</strong> sebelum produksi dan melakukan simulasi H-1.</li>
              <li>Kru yang sedang tidak bertugas dilarang mengganggu kru yang bertugas di MCR.</li>
              <li>Kerusakan barang di MCR wajib diganti sesuai barang yang dihilangkan/dirusak.</li>
              <li>Tidak diperkenankan menitipkan barang pribadi di ruang MCR.</li>
            </ul>

            <SectionHeading id="editor-video" title="Editor dan Video" />
            <ul className="list-disc pl-5 space-y-2 text-foreground/80 leading-relaxed">
              <li>Aplikasi <em>editing</em> direkomendasikan menggunakan keluarga Adobe (Premiere Pro, After Effects, dsb).</li>
              <li>Format <em>render</em> video wajib <strong>H.264</strong> dengan resolusi <strong>1920 x 1080 (25/30 fps)</strong>.</li>
              <li>Durasi program reguler sesuai ketentuan, file video event berdurasi hingga event selesai, dan video iklan maksimal 2 menit (60 detik untuk versi reguler).</li>
              <li>Konten video harus orisinil. Penggunaan bahan dari pihak lain harus menyertakan sumber (Contoh: "Courtesy Of Youtube") dan tidak melanggar hak cipta.</li>
              <li>Dilarang menggunakan <em>backsound</em> lagu yang mengandung unsur SARA dan melanggar hak cipta.</li>
              <li>Proses <em>editing</em> harus selesai sesuai <em>deadline</em>, revisi <em>online</em> maksimal 3 hari.</li>
              <li><strong>Batas waktu proses <em>editing</em> pasca produksi adalah 5 hari.</strong></li>
            </ul>

            <SectionHeading id="ruang-editor" title="Ruang Editor & Library" />
            <div className="bg-primary/5 rounded-2xl p-6 border border-primary/10 my-6">
              <h4 className="font-bold text-primary mb-3">Struktur Folder Penyimpanan:</h4>
              <p className="text-sm text-foreground/70 mb-4">Setiap file *project* komputer ruang editor harus rapi di dalam folder program masing-masing (Contoh: Muslim Kampus -&gt; Eps.1). Struktur wajib:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm font-medium text-foreground/80">
                <li>Source</li>
                <li>File Project (Pr)</li>
                <li>Music / Backsound Music</li>
                <li>Lower Third</li>
                <li>Effect & Sound Effect</li>
              </ul>
            </div>
            <ul className="list-disc pl-5 space-y-2 text-foreground/80 leading-relaxed">
              <li>Dilarang membawa makanan/minuman, tidur, berisik, atau merusak fasilitas di ruang editor.</li>
              <li>Setelah memakai komputer, <strong>harap mematikan mouse dan keyboard</strong>.</li>
              <li>Komputer ruang editor diutamakan untuk edit program tayang dibanding keperluan pribadi. Boleh dipakai untuk pribadi dengan syarat tidak meninggalkan jejak (simpan di flashdisk).</li>
              <li>Setiap penitipan file pribadi pada komputer studio harus seizin Koord. Editor dan Koord. Programmer.</li>
              <li>File video yang sudah lulus <em>Quality Control (QC)</em> diletakkan pada folder <strong>"Siap Tayang"</strong>.</li>
              <li>Masa revisi file yang ditolak maksimal 2 hari.</li>
            </ul>

            <SectionHeading id="creative-media" title="Creative Media (Highlight & Iklan)" />
            <ul className="list-disc pl-5 space-y-2 text-foreground/80 leading-relaxed">
              <li>Setiap produksi wajib membuat <em>highlight</em> cuplikan untuk diserahkan ke Creative Media.</li>
              <li>Semua video <em>highlight</em> <strong>wajib mencantumkan logo Dakwah TV di bagian atas video</strong>, dengan posisi yang jelas.</li>
              <li>Durasi <em>highlight</em> maksimal 1 menit.</li>
              <li>Video steril dari rokok, vape, minuman keras, atau elemen yang bertentangan dengan prinsip Dakwah TV.</li>
              <li>Video iklan wajib memiliki <em>caption</em> relevan (hindari <em>caption</em> AI yang kaku) dan mencantumkan <em>credit title</em> kru.</li>
              <li>Tidak boleh mencantumkan produk/merk di dalam video, kecuali memang berstatus <em>endorse</em>.</li>
            </ul>

            <SectionHeading id="event-penyiaran" title="Event & Penyiaran" />
            <ul className="list-disc pl-5 space-y-2 text-foreground/80 leading-relaxed">
              <li>Penyiaran dilakukan setiap Senin – Jum'at pukul 10:00 – 13:00 WIB.</li>
              <li>Siaran meliputi program utama, event, dan iklan. Setelah siaran, wajib di-*upload* ke YouTube Dakwah TV.</li>
              <li>Kru Event wajib datang 1 jam sebelum event dimulai. Wajib berseragam (perempuan kerudung hitam), <em>id card</em>, dan bersepatu.</li>
              <li>Dilarang menggunakan HP saat bertugas, kecuali urusan mendesak.</li>
              <li>Kru Event wajib mengembalikan seluruh alat ke tempat semula setelah <em>event</em>.</li>
              <li>Data liputan event di-<em>backup</em> di <em>hardisk/G-Drive</em> Dakwah TV.</li>
              <li>Editor event diberi waktu 1 minggu untuk <em>editing</em>. Jika tidak sanggup, Koordinator Event berhak me-<em>reshuffle</em> editor.</li>
            </ul>
          </div>
          
          <div className="mt-16 pt-8 border-t border-border flex items-center justify-between text-sm text-foreground/50 font-medium">
            <span>Ditetapkan di Surabaya, 5 Desember 2026</span>
            <span>Station Manager Dakwah TV</span>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SopTeknis;

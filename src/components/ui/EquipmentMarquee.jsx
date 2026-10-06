import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Camera, 
  Radio, 
  Lightbulb, 
  Video, 
  Mic, 
  Disc3, 
  Sliders, 
  Layers, 
  Laptop, 
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { supabase } from '../../supabase';

// Daftar alat unggulan resmi Dakwah TV dengan gambar asli dari katalog
const DAKWAH_TV_EQUIPMENT = [
  {
    name: 'Sony Alpha A6400 Kit',
    searchKey: 'Sony Alpha A6400',
    cat: 'Kamera',
    img: '/items-img/Camera_Body___Camcorder_Camera_Body_Sony_Alpha_A6400_+_E_PZ_16-50mm_OSS.png',
    icon: Camera,
    status: 'Ready'
  },
  {
    name: 'Panasonic AV-HS410 Switcher',
    searchKey: 'Panasonic AV-HS410',
    cat: 'Video Production',
    img: '/items-img/Video_Production__Panasonic_AV-HS410_Video_Switcher.png',
    icon: Sliders,
    status: 'Ready'
  },
  {
    name: 'Panasonic AG-AC160 Camcorder',
    searchKey: 'Panasonic AG-AC160',
    cat: 'Camcorder',
    img: '/items-img/Camera_Body___Camcorder_Camcorder_Panasonic_AG-AC160.png',
    icon: Video,
    status: 'Ready'
  },
  {
    name: 'Yamaha MG10XU Mixer',
    searchKey: 'Yamaha MG10XU',
    cat: 'Audio Console',
    img: '/items-img/Audio_Audio_Mixer_Yamaha_MG10XU.png',
    icon: Sliders,
    status: 'Ready'
  },
  {
    name: 'Nikon D7200 DSLR',
    searchKey: 'Nikon D7200',
    cat: 'Kamera',
    img: '/items-img/Camera_Body___Camcorder_Camera_Body_Nikon_D7200.png',
    icon: Camera,
    status: 'Ready'
  },
  {
    name: 'Sennheiser MKE 600 Shotgun',
    searchKey: 'Sennheiser MKE 600',
    cat: 'Audio',
    img: '/items-img/Audio_Microphone_Sennheiser_MKE_600.png',
    icon: Mic,
    status: 'Ready'
  },
  {
    name: 'Zhiyun Weebill S Gimbal',
    searchKey: 'Zhiyun Weebill S',
    cat: 'Stabilizer',
    img: '/items-img/Support_Equipment_Support_Zhiyun_Weebill_S.png',
    icon: Video,
    status: 'Ready'
  },
  {
    name: 'Godox LED 1000Bi II',
    searchKey: 'Godox LED 1000Bi II',
    cat: 'Studio Lighting',
    img: '/items-img/Flash___Lighting_LED_Video_Light_Godox_LED_1000Bi_II.png',
    icon: Lightbulb,
    status: 'Ready'
  },
  {
    name: 'Saramonic Blink 500 B2',
    searchKey: 'Saramonic Blink 500',
    cat: 'Wireless Mic',
    img: '/items-img/Audio_Microphone_Saramonic_Blink_500_B2.png',
    icon: Radio,
    status: 'Ready'
  },
  {
    name: 'Godox MS200 Studio Kit',
    searchKey: 'Godox MS200',
    cat: 'Lighting Flash',
    img: '/items-img/Flash___Lighting_Studio_Lighting_Godox_MS200_Studio_Kit_+_Softbox.png',
    icon: Lightbulb,
    status: 'Ready'
  },
  {
    name: 'Canon EF 300mm f/4L USM',
    searchKey: 'Canon EF 300mm',
    cat: 'Lensa Tele',
    img: '/items-img/Lens__Canon_EF_300mm_f_4L_USM.png',
    icon: Disc3,
    status: 'Ready'
  },
  {
    name: 'Soundcraft EPM8 Console',
    searchKey: 'Soundcraft EPM8',
    cat: 'Audio Mixer',
    img: '/items-img/Audio_Audio_Mixer_Soundcraft_EPM8.png',
    icon: Sliders,
    status: 'Ready'
  },
  {
    name: 'Libec Professional Tripod',
    searchKey: 'Libec Professional Tripod',
    cat: 'Support Rig',
    img: '/items-img/Support_Equipment_Tripod_Libec_Professional_Tripod_(Large).png',
    icon: Video,
    status: 'Ready'
  },
  {
    name: 'Datavideo HDR-70 Recorder',
    searchKey: 'Datavideo HDR-70',
    cat: 'Video Production',
    img: '/items-img/Video_Production__Datavideo_HDR-70_HD_Recorder.png',
    icon: Layers,
    status: 'Ready'
  },
  {
    name: 'Apple iMac 27" Retina',
    searchKey: 'Apple iMac 27',
    cat: 'Editing Room',
    img: '/items-img/Editing_Room__Apple_iMac_27_inch_(Late_2015).png',
    icon: Laptop,
    status: 'Ready'
  },
  {
    name: 'WLN KD-C1 Radio HT',
    searchKey: 'WLN KD-C1',
    cat: 'Komunikasi',
    img: '/items-img/Communication_WLN_KD-C1_Two-Way_Radio.png',
    icon: Radio,
    status: 'Ready'
  }
];

export function EquipmentMarquee() {
  const [items, setItems] = useState(DAKWAH_TV_EQUIPMENT);

  // Sync dengan status realtime dari Supabase jika tersedia
  useEffect(() => {
    let isMounted = true;
    const syncWithDatabase = async () => {
      try {
        const { data } = await supabase
          .from('inventory')
          .select('name, status, img')
          .not('img', 'is', null)
          .neq('img', '');

        if (data && data.length > 0 && isMounted) {
          // Update status alat pada daftar yang sedang tampil
          setItems(prevItems =>
            prevItems.map(item => {
              const matched = data.find(dbItem => 
                dbItem.img === item.img || 
                (item.searchKey && dbItem.name.toLowerCase().includes(item.searchKey.toLowerCase()))
              );
              if (matched) {
                const statusLabel = matched.status === 'ready' 
                  ? 'Ready' 
                  : matched.status === 'borrowed' 
                  ? 'Dipinjam' 
                  : matched.status === 'maintenance' 
                  ? 'Maintenance' 
                  : 'Ready';
                return { ...item, status: statusLabel };
              }
              return item;
            })
          );
        }
      } catch (err) {
        // Fallback aman tetap menampilkan DAKWAH_TV_EQUIPMENT
        console.debug('Using curated Dakwah TV equipment list');
      }
    };

    syncWithDatabase();
    return () => { isMounted = false; };
  }, []);

  return (
    <section className="relative w-full overflow-hidden py-4 sm:py-5 border-y border-border/40 bg-background/60 backdrop-blur-xl">
      {/* Edge Gradient Fades untuk transisi halus di kiri & kanan */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-16 sm:w-28 z-20 bg-gradient-to-r from-background via-background/80 to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-16 sm:w-28 z-20 bg-gradient-to-l from-background via-background/80 to-transparent" />

      {/* Marquee Track */}
      <div className="flex w-max animate-marquee space-x-4 sm:space-x-5 hover:[animation-play-state:paused] py-1">
        {[...items, ...items].map((item, idx) => {
          const Icon = item.icon || Camera;
          const isReady = item.status === 'Ready';

          return (
            <Link
              to={`/katalog?item=${encodeURIComponent(item.searchKey || item.name)}`}
              key={idx}
              title={`Klik untuk lihat ${item.name} di Katalog`}
              className="group relative flex items-center gap-3.5 px-3.5 py-2 sm:py-2.5 rounded-2xl bg-card/75 hover:bg-card/95 border border-border/70 hover:border-emerald-500/50 shadow-sm hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300 flex-shrink-0 cursor-pointer overflow-hidden backdrop-blur-md"
            >
              {/* Subtle Ambient Hover Glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

              {/* Bingkai Foto Alat */}
              <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-background/90 border border-border/70 p-1 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner group-hover:scale-105 group-hover:border-emerald-500/40 transition-all duration-300">
                <img
                  src={item.img}
                  alt={item.name}
                  className="w-full h-full object-contain filter drop-shadow-sm transition-transform duration-300 group-hover:scale-110"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextElementSibling) {
                      e.currentTarget.nextElementSibling.classList.remove('hidden');
                    }
                  }}
                />
                <div className="hidden w-full h-full flex items-center justify-center text-primary/70">
                  <Icon className="w-5 h-5" />
                </div>
              </div>

              {/* Detail & Status Alat */}
              <div className="flex flex-col min-w-0 pr-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs sm:text-sm text-foreground tracking-tight whitespace-nowrap group-hover:text-emerald-400 transition-colors">
                    {item.name}
                  </span>
                  <ChevronRight className="w-3 h-3 text-muted-foreground/40 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-emerald-400 transition-all" />
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] sm:text-[11px] font-medium text-foreground/60 flex items-center gap-1 whitespace-nowrap">
                    <Icon className="w-3 h-3 text-emerald-500/80" />
                    {item.cat}
                  </span>
                  
                  <span className="inline-block w-1 h-1 rounded-full bg-border" />

                  <span className={`inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap transition-colors ${
                    isReady 
                      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                      : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isReady ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                    {item.status}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 45s linear infinite;
        }
        @media (max-width: 640px) {
          .animate-marquee {
            animation: marquee 35s linear infinite;
          }
        }
      `}</style>
    </section>
  );
}

export interface VinylAlbum {
  id: string;
  title: string;
  artist: string;
  genre: string;
  year: string;
  labelColor: string;
  coverBg: string;
  coverImage?: string;
  trackSlug?: string;
  duration?: string;
  description: string;
  tracks: string[];
}

export const PUB_ARTWORK = 'https://i1.sndcdn.com/avatars-yEuGz9F4uSiAy40t-FIQ8EA-t500x500.jpg';

export const VINYL_ALBUMS: VinylAlbum[] = [
  {
    "id": "album-pubrecords",
    "title": "PUB Records • Todas as Faixas (Feed Oficial)",
    "artist": "paesnobeat • PUB Records",
    "genre": "SoundCloud Feed",
    "year": "2026",
    "labelColor": "#ff5500",
    "coverBg": "linear-gradient(135deg, #ff5500, #7c2d12)",
    "coverImage": "https://i1.sndcdn.com/avatars-yEuGz9F4uSiAy40t-FIQ8EA-t500x500.jpg",
    "trackSlug": "pubrecords/tracks",
    "duration": "63 Faixas",
    "description": "Catálogo oficial completo hospedado em soundcloud.com/pubrecords/tracks. Qualquer faixa nova upada entra aqui em tempo real.",
    "tracks": [
      "01. Feed Dinâmico do SoundCloud",
      "02. Transmissão Contínua",
      "03. 100% Volume Analógico"
    ]
  },
  {
    "id": "album-pubrecords-shuffle",
    "title": "PUB Records • Modo Aleatório (Shuffle)",
    "artist": "paesnobeat • PUB Records",
    "genre": "SoundCloud Shuffle",
    "year": "2026",
    "labelColor": "#38bdf8",
    "coverBg": "linear-gradient(135deg, #0284c7, #1e1b4b)",
    "coverImage": "https://i1.sndcdn.com/avatars-yEuGz9F4uSiAy40t-FIQ8EA-t500x500.jpg",
    "trackSlug": "pubrecords/tracks",
    "duration": "Mix Aleatório",
    "description": "Todas as músicas da PUB Records tocadas de forma randômica para ambientar a equipe.",
    "tracks": [
      "01. Shuffle Automático",
      "02. Rotação Contínua"
    ]
  },
  {
    "id": "track-mailow",
    "title": "MAILOW",
    "artist": "paesnobeat • PUB Records",
    "genre": "Beat / Hip-Hop",
    "year": "2026",
    "labelColor": "#ef4444",
    "coverBg": "linear-gradient(135deg, #b91c1c, #450a0a)",
    "coverImage": "https://i1.sndcdn.com/avatars-yEuGz9F4uSiAy40t-FIQ8EA-t500x500.jpg",
    "trackSlug": "pubrecords/mailow",
    "duration": "0:59",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/mailow.",
    "tracks": [
      "01. MAILOW (Original Mix)"
    ]
  },
  {
    "id": "track-pelelope",
    "title": "pelelope",
    "artist": "paesnobeat • PUB Records",
    "genre": "Beat / Hip-Hop",
    "year": "2026",
    "labelColor": "#f59e0b",
    "coverBg": "linear-gradient(135deg, #d97706, #451a03)",
    "coverImage": "https://i1.sndcdn.com/avatars-yEuGz9F4uSiAy40t-FIQ8EA-t500x500.jpg",
    "trackSlug": "pubrecords/pelelope",
    "duration": "4:00",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/pelelope.",
    "tracks": [
      "01. pelelope (Original Mix)"
    ]
  },
  {
    "id": "track-carlton",
    "title": "carlton",
    "artist": "paesnobeat • PUB Records",
    "genre": "Beat / Hip-Hop",
    "year": "2026",
    "labelColor": "#10b981",
    "coverBg": "linear-gradient(135deg, #059669, #064e3b)",
    "coverImage": "https://i1.sndcdn.com/avatars-yEuGz9F4uSiAy40t-FIQ8EA-t500x500.jpg",
    "trackSlug": "pubrecords/carlton",
    "duration": "10:46",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/carlton.",
    "tracks": [
      "01. carlton (Original Mix)"
    ]
  },
  {
    "id": "track-sherman-2",
    "title": "sherman #2",
    "artist": "paesnobeat • PUB Records",
    "genre": "Beat / Hip-Hop",
    "year": "2026",
    "labelColor": "#38bdf8",
    "coverBg": "linear-gradient(135deg, #0284c7, #082f49)",
    "coverImage": "https://i1.sndcdn.com/avatars-yEuGz9F4uSiAy40t-FIQ8EA-t500x500.jpg",
    "trackSlug": "pubrecords/sherman-2",
    "duration": "1:29",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/sherman-2.",
    "tracks": [
      "01. sherman #2 (Original Mix)"
    ]
  },
  {
    "id": "track-jovem-tralha",
    "title": "jovem tralha",
    "artist": "paesnobeat • PUB Records",
    "genre": "Beat / Hip-Hop",
    "year": "2026",
    "labelColor": "#8b5cf6",
    "coverBg": "linear-gradient(135deg, #7c3aed, #2e1065)",
    "coverImage": "https://i1.sndcdn.com/avatars-yEuGz9F4uSiAy40t-FIQ8EA-t500x500.jpg",
    "trackSlug": "pubrecords/jovem-tralha",
    "duration": "7:08",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/jovem-tralha.",
    "tracks": [
      "01. jovem tralha (Original Mix)"
    ]
  },
  {
    "id": "track-sunday-sunday",
    "title": "sunday sunday",
    "artist": "paesnobeat • PUB Records",
    "genre": "Beat / Hip-Hop",
    "year": "2026",
    "labelColor": "#ec4899",
    "coverBg": "linear-gradient(135deg, #db2777, #500724)",
    "coverImage": "https://i1.sndcdn.com/avatars-yEuGz9F4uSiAy40t-FIQ8EA-t500x500.jpg",
    "trackSlug": "pubrecords/sunday-sunday",
    "duration": "2:27",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/sunday-sunday.",
    "tracks": [
      "01. sunday sunday (Original Mix)"
    ]
  },
  {
    "id": "track-chirivia",
    "title": "chirivia",
    "artist": "paesnobeat • PUB Records",
    "genre": "Beat / Hip-Hop",
    "year": "2026",
    "labelColor": "#14b8a6",
    "coverBg": "linear-gradient(135deg, #0d9488, #042f2e)",
    "coverImage": "https://i1.sndcdn.com/avatars-yEuGz9F4uSiAy40t-FIQ8EA-t500x500.jpg",
    "trackSlug": "pubrecords/chirivia",
    "duration": "4:16",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/chirivia.",
    "tracks": [
      "01. chirivia (Original Mix)"
    ]
  },
  {
    "id": "track-papara",
    "title": "papara",
    "artist": "paesnobeat • PUB Records",
    "genre": "Beat / Hip-Hop",
    "year": "2026",
    "labelColor": "#f97316",
    "coverBg": "linear-gradient(135deg, #ea580c, #431407)",
    "coverImage": "https://i1.sndcdn.com/avatars-yEuGz9F4uSiAy40t-FIQ8EA-t500x500.jpg",
    "trackSlug": "pubrecords/papara",
    "duration": "2:49",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/papara.",
    "tracks": [
      "01. papara (Original Mix)"
    ]
  },
  {
    "id": "track-balalau",
    "title": "balalau",
    "artist": "paesnobeat • PUB Records",
    "genre": "Beat / Hip-Hop",
    "year": "2026",
    "labelColor": "#eab308",
    "coverBg": "linear-gradient(135deg, #ca8a04, #422006)",
    "coverImage": "https://i1.sndcdn.com/avatars-yEuGz9F4uSiAy40t-FIQ8EA-t500x500.jpg",
    "trackSlug": "pubrecords/balalau",
    "duration": "3:12",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/balalau.",
    "tracks": [
      "01. balalau (Original Mix)"
    ]
  },
  {
    "id": "track-padregabriel",
    "title": "PADREGABRIEL",
    "artist": "paesnobeat • PUB Records",
    "genre": "Beat / Hip-Hop",
    "year": "2026",
    "labelColor": "#6366f1",
    "coverBg": "linear-gradient(135deg, #4f46e5, #1e1b4b)",
    "coverImage": "https://i1.sndcdn.com/artworks-LhHVLvPxG6lUeO4I-rX4kBw-large.png",
    "trackSlug": "pubrecords/padregabriel",
    "duration": "3:12",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/padregabriel.",
    "tracks": [
      "01. PADREGABRIEL (Original Mix)"
    ]
  },
  {
    "id": "track-larica-manoela2-f-minor-95bpm",
    "title": "LARICA MANOELA2-F# minor-95bpm-443hz",
    "artist": "paesnobeat • PUB Records",
    "genre": "Beat / Hip-Hop",
    "year": "2026",
    "labelColor": "#ef4444",
    "coverBg": "linear-gradient(135deg, #b91c1c, #450a0a)",
    "coverImage": "https://i1.sndcdn.com/avatars-yEuGz9F4uSiAy40t-FIQ8EA-t500x500.jpg",
    "trackSlug": "pubrecords/larica-manoela2-f-minor-95bpm",
    "duration": "3:23",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/larica-manoela2-f-minor-95bpm.",
    "tracks": [
      "01. LARICA MANOELA2-F# minor-95bpm-443hz (Original Mix)"
    ]
  },
  {
    "id": "track-shelton-palace",
    "title": "SHELTON PALACE",
    "artist": "paesnobeat • PUB Records",
    "genre": "Beat / Hip-Hop",
    "year": "2026",
    "labelColor": "#f59e0b",
    "coverBg": "linear-gradient(135deg, #d97706, #451a03)",
    "coverImage": "https://i1.sndcdn.com/artworks-6dVaRWehaUI8LrpL-bJ9W7A-large.png",
    "trackSlug": "pubrecords/shelton-palace",
    "duration": "3:50",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/shelton-palace.",
    "tracks": [
      "01. SHELTON PALACE (Original Mix)"
    ]
  },
  {
    "id": "track-beneath-the-pines",
    "title": "Beneath the Pines",
    "artist": "paesnobeat • PUB Records",
    "genre": "Ambient",
    "year": "2026",
    "labelColor": "#10b981",
    "coverBg": "linear-gradient(135deg, #059669, #064e3b)",
    "coverImage": "https://i1.sndcdn.com/artworks-RcgEgkmVWPpXbztI-oD74Vw-t500x500.jpg",
    "trackSlug": "pubrecords/beneath-the-pines",
    "duration": "2:48",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/beneath-the-pines.",
    "tracks": [
      "01. Beneath the Pines (Original Mix)"
    ]
  },
  {
    "id": "track-robalo-imperial",
    "title": "robalo imperial",
    "artist": "paesnobeat • PUB Records",
    "genre": "Beat / Hip-Hop",
    "year": "2026",
    "labelColor": "#38bdf8",
    "coverBg": "linear-gradient(135deg, #0284c7, #082f49)",
    "coverImage": "https://i1.sndcdn.com/artworks-yVk2yGQCvfGc6ale-yyXHZQ-t500x500.jpg",
    "trackSlug": "pubrecords/robalo-imperial",
    "duration": "8:57",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/robalo-imperial.",
    "tracks": [
      "01. robalo imperial (Original Mix)"
    ]
  },
  {
    "id": "track-genildo",
    "title": "genildo",
    "artist": "paesnobeat • PUB Records",
    "genre": "Beat / Hip-Hop",
    "year": "2026",
    "labelColor": "#8b5cf6",
    "coverBg": "linear-gradient(135deg, #7c3aed, #2e1065)",
    "coverImage": "https://i1.sndcdn.com/artworks-ze1pAc7pQcwPy5k5-4sTiZA-large.png",
    "trackSlug": "pubrecords/genildo",
    "duration": "5:36",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/genildo.",
    "tracks": [
      "01. genildo (Original Mix)"
    ]
  },
  {
    "id": "track-machu-picchu-afrorap",
    "title": "Machu Picchu  - @paesnobeat",
    "artist": "paesnobeat • PUB Records",
    "genre": "Latin",
    "year": "2026",
    "labelColor": "#ec4899",
    "coverBg": "linear-gradient(135deg, #db2777, #500724)",
    "coverImage": "https://i1.sndcdn.com/artworks-Zl338bYV20SPREeG-yV8GCQ-large.png",
    "trackSlug": "pubrecords/machu-picchu-afrorap",
    "duration": "3:36",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/machu-picchu-afrorap.",
    "tracks": [
      "01. Machu Picchu  - @paesnobeat (Original Mix)"
    ]
  },
  {
    "id": "track-boomderby",
    "title": "boomderby",
    "artist": "paesnobeat • PUB Records",
    "genre": "Beat / Hip-Hop",
    "year": "2026",
    "labelColor": "#14b8a6",
    "coverBg": "linear-gradient(135deg, #0d9488, #042f2e)",
    "coverImage": "https://i1.sndcdn.com/avatars-yEuGz9F4uSiAy40t-FIQ8EA-t500x500.jpg",
    "trackSlug": "pubrecords/boomderby",
    "duration": "5:41",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/boomderby.",
    "tracks": [
      "01. boomderby (Original Mix)"
    ]
  },
  {
    "id": "track-ratombo",
    "title": "ratombo",
    "artist": "paesnobeat • PUB Records",
    "genre": "Beat / Hip-Hop",
    "year": "2026",
    "labelColor": "#f97316",
    "coverBg": "linear-gradient(135deg, #ea580c, #431407)",
    "coverImage": "https://i1.sndcdn.com/artworks-5KRuwXxgegyPP8oS-zl85wg-large.png",
    "trackSlug": "pubrecords/ratombo",
    "duration": "5:41",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/ratombo.",
    "tracks": [
      "01. ratombo (Original Mix)"
    ]
  },
  {
    "id": "track-partynextdoor-come-and-see-me",
    "title": "PARTYNEXTDOOR - Come And See Me ft. Drake- REMIX @paesnobeat",
    "artist": "paesnobeat • PUB Records",
    "genre": "Hip-hop & Rap",
    "year": "2026",
    "labelColor": "#eab308",
    "coverBg": "linear-gradient(135deg, #ca8a04, #422006)",
    "coverImage": "https://i1.sndcdn.com/artworks-YMa8aPVJZED4ZHE5-SlloPg-large.png",
    "trackSlug": "pubrecords/partynextdoor-come-and-see-me",
    "duration": "3:26",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/partynextdoor-come-and-see-me.",
    "tracks": [
      "01. PARTYNEXTDOOR - Come And See Me ft. Drake- REMIX @paesnobeat (Original Mix)"
    ]
  },
  {
    "id": "track-djavan-vive-remix-paesnobeat",
    "title": "Djavan - Vive - REMIX @paesnobeat",
    "artist": "paesnobeat • PUB Records",
    "genre": "Folk & Singer-Songwriter",
    "year": "2026",
    "labelColor": "#6366f1",
    "coverBg": "linear-gradient(135deg, #4f46e5, #1e1b4b)",
    "coverImage": "https://i1.sndcdn.com/artworks-tkpjkK8o6gOSXshM-LlYodw-large.png",
    "trackSlug": "pubrecords/djavan-vive-remix-paesnobeat",
    "duration": "4:30",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/djavan-vive-remix-paesnobeat.",
    "tracks": [
      "01. Djavan - Vive - REMIX @paesnobeat (Original Mix)"
    ]
  },
  {
    "id": "track-ariana-grande-positions-remix",
    "title": "Ariana Grande - positions - REMIX @paesnobeat",
    "artist": "paesnobeat • PUB Records",
    "genre": "R&B & Soul",
    "year": "2026",
    "labelColor": "#ef4444",
    "coverBg": "linear-gradient(135deg, #b91c1c, #450a0a)",
    "coverImage": "https://i1.sndcdn.com/artworks-lUOTJn3o2ad2hyw8-J61EzA-large.png",
    "trackSlug": "pubrecords/ariana-grande-positions-remix",
    "duration": "2:53",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/ariana-grande-positions-remix.",
    "tracks": [
      "01. Ariana Grande - positions - REMIX @paesnobeat (Original Mix)"
    ]
  },
  {
    "id": "track-matue-backstage-30praum-remix",
    "title": "Matuê - BACKSTAGE - 30PRAUM - REMIX @paesnobeat",
    "artist": "paesnobeat • PUB Records",
    "genre": "Beat / Hip-Hop",
    "year": "2026",
    "labelColor": "#f59e0b",
    "coverBg": "linear-gradient(135deg, #d97706, #451a03)",
    "coverImage": "https://i1.sndcdn.com/artworks-vldEznu26KXcy8HQ-bUOglA-large.png",
    "trackSlug": "pubrecords/matue-backstage-30praum-remix",
    "duration": "1:59",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/matue-backstage-30praum-remix.",
    "tracks": [
      "01. Matuê - BACKSTAGE - 30PRAUM - REMIX @paesnobeat (Original Mix)"
    ]
  },
  {
    "id": "track-kali-uchis-telepat-a-remix",
    "title": "Kali Uchis – telepatía - REMIX @paesnobeat",
    "artist": "paesnobeat • PUB Records",
    "genre": "Latin",
    "year": "2026",
    "labelColor": "#10b981",
    "coverBg": "linear-gradient(135deg, #059669, #064e3b)",
    "coverImage": "https://i1.sndcdn.com/artworks-yWIDEv4zGQexyXFw-yUDNBw-large.png",
    "trackSlug": "pubrecords/kali-uchis-telepat-a-remix",
    "duration": "2:23",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/kali-uchis-telepat-a-remix.",
    "tracks": [
      "01. Kali Uchis – telepatía - REMIX @paesnobeat (Original Mix)"
    ]
  },
  {
    "id": "track-monalisa-teto-wiu-remix",
    "title": "MONALISA - Teto & WIU - REMIX - @paesnobeat",
    "artist": "paesnobeat • PUB Records",
    "genre": "Trap",
    "year": "2026",
    "labelColor": "#38bdf8",
    "coverBg": "linear-gradient(135deg, #0284c7, #082f49)",
    "coverImage": "https://i1.sndcdn.com/artworks-E8g1rHnbb7lcXJW7-7yFzTw-large.png",
    "trackSlug": "pubrecords/monalisa-teto-wiu-remix",
    "duration": "2:58",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/monalisa-teto-wiu-remix.",
    "tracks": [
      "01. MONALISA - Teto & WIU - REMIX - @paesnobeat (Original Mix)"
    ]
  },
  {
    "id": "track-rihanna-work-remix-paesnobeat",
    "title": "Rihanna - Work - REMIX @paesnobeat",
    "artist": "paesnobeat • PUB Records",
    "genre": "R&B & Soul",
    "year": "2026",
    "labelColor": "#8b5cf6",
    "coverBg": "linear-gradient(135deg, #7c3aed, #2e1065)",
    "coverImage": "https://i1.sndcdn.com/artworks-w1PxcZAzywpoY2Gf-RUFqeQ-large.png",
    "trackSlug": "pubrecords/rihanna-work-remix-paesnobeat",
    "duration": "3:23",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/rihanna-work-remix-paesnobeat.",
    "tracks": [
      "01. Rihanna - Work - REMIX @paesnobeat (Original Mix)"
    ]
  },
  {
    "id": "track-justin-bieber-company-remix",
    "title": "Justin Bieber - Company- REMIX - @PAESNOBEAT",
    "artist": "paesnobeat • PUB Records",
    "genre": "Pop",
    "year": "2026",
    "labelColor": "#ec4899",
    "coverBg": "linear-gradient(135deg, #db2777, #500724)",
    "coverImage": "https://i1.sndcdn.com/artworks-5FsM6FzYyOcFecLt-4YqmBg-t500x500.jpg",
    "trackSlug": "pubrecords/justin-bieber-company-remix",
    "duration": "3:34",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/justin-bieber-company-remix.",
    "tracks": [
      "01. Justin Bieber - Company- REMIX - @PAESNOBEAT (Original Mix)"
    ]
  },
  {
    "id": "track-kehlani-folded-remix",
    "title": "Kehlani - Folded - REMIX @paesnobeat",
    "artist": "paesnobeat • PUB Records",
    "genre": "R&B & Soul",
    "year": "2026",
    "labelColor": "#14b8a6",
    "coverBg": "linear-gradient(135deg, #0d9488, #042f2e)",
    "coverImage": "https://i1.sndcdn.com/artworks-YR8sPTnqyZ4CPQmM-Lqz27w-large.png",
    "trackSlug": "pubrecords/kehlani-folded-remix",
    "duration": "3:50",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/kehlani-folded-remix.",
    "tracks": [
      "01. Kehlani - Folded - REMIX @paesnobeat (Original Mix)"
    ]
  },
  {
    "id": "track-coco-jones-taste-remix",
    "title": "COCO JONES - TASTE - REMIX @PAESNOBEAT",
    "artist": "paesnobeat • PUB Records",
    "genre": "R&B & Soul",
    "year": "2026",
    "labelColor": "#f97316",
    "coverBg": "linear-gradient(135deg, #ea580c, #431407)",
    "coverImage": "https://i1.sndcdn.com/artworks-iOBrydkevaN84L39-SqynWg-large.png",
    "trackSlug": "pubrecords/coco-jones-taste-remix",
    "duration": "2:53",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/coco-jones-taste-remix.",
    "tracks": [
      "01. COCO JONES - TASTE - REMIX @PAESNOBEAT (Original Mix)"
    ]
  },
  {
    "id": "track-teto-grecia-remix-paesnobeat",
    "title": "Teto - GRÉCIA- REMIX @PAESNOBEAT",
    "artist": "paesnobeat • PUB Records",
    "genre": "Trap",
    "year": "2026",
    "labelColor": "#eab308",
    "coverBg": "linear-gradient(135deg, #ca8a04, #422006)",
    "coverImage": "https://i1.sndcdn.com/artworks-19pGPvQno0oeyOYj-3zgPQg-large.png",
    "trackSlug": "pubrecords/teto-grecia-remix-paesnobeat",
    "duration": "3:41",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/teto-grecia-remix-paesnobeat.",
    "tracks": [
      "01. Teto - GRÉCIA- REMIX @PAESNOBEAT (Original Mix)"
    ]
  },
  {
    "id": "track-mc-ryan-sp-matue-filho-da",
    "title": "MC Ryan SP & Matuê - Filho da Noite - REMIX - @PAESnobeat",
    "artist": "paesnobeat • PUB Records",
    "genre": "Trap",
    "year": "2026",
    "labelColor": "#6366f1",
    "coverBg": "linear-gradient(135deg, #4f46e5, #1e1b4b)",
    "coverImage": "https://i1.sndcdn.com/artworks-19emMt9x4butPjvi-V7Ra2g-large.png",
    "trackSlug": "pubrecords/mc-ryan-sp-matue-filho-da",
    "duration": "3:38",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/mc-ryan-sp-matue-filho-da.",
    "tracks": [
      "01. MC Ryan SP & Matuê - Filho da Noite - REMIX - @PAESnobeat (Original Mix)"
    ]
  },
  {
    "id": "track-333-matue-remix-paesnobeat-1",
    "title": "333 - MATUE - REMIX @PAESNOBEAT",
    "artist": "paesnobeat • PUB Records",
    "genre": "Trap",
    "year": "2026",
    "labelColor": "#ef4444",
    "coverBg": "linear-gradient(135deg, #b91c1c, #450a0a)",
    "coverImage": "https://i1.sndcdn.com/artworks-9YXSE76aQiUre5ne-0RF0Dg-large.png",
    "trackSlug": "pubrecords/333-matue-remix-paesnobeat-1",
    "duration": "4:00",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/333-matue-remix-paesnobeat-1.",
    "tracks": [
      "01. 333 - MATUE - REMIX @PAESNOBEAT (Original Mix)"
    ]
  },
  {
    "id": "track-mais-um-voo-teto-remix",
    "title": "MAIS UM VOO - TETO - REMIX - @paesnobeat - PUB RECORDS",
    "artist": "paesnobeat • PUB Records",
    "genre": "Hip-hop & Rap",
    "year": "2025",
    "labelColor": "#f59e0b",
    "coverBg": "linear-gradient(135deg, #d97706, #451a03)",
    "coverImage": "https://i1.sndcdn.com/artworks-Cm0SIerv9eAovlBn-Ds2yhQ-large.png",
    "trackSlug": "pubrecords/mais-um-voo-teto-remix",
    "duration": "3:17",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/mais-um-voo-teto-remix.",
    "tracks": [
      "01. MAIS UM VOO - TETO - REMIX - @paesnobeat - PUB RECORDS (Original Mix)"
    ]
  },
  {
    "id": "track-wi-fi-lo-fi-1",
    "title": "Wi-fi  Lo-fi",
    "artist": "paesnobeat • PUB Records",
    "genre": "Ambient",
    "year": "2025",
    "labelColor": "#10b981",
    "coverBg": "linear-gradient(135deg, #059669, #064e3b)",
    "coverImage": "https://i1.sndcdn.com/artworks-W9izUzoECsqyhhyz-ewvAjA-large.png",
    "trackSlug": "pubrecords/wi-fi-lo-fi-1",
    "duration": "3:15",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/wi-fi-lo-fi-1.",
    "tracks": [
      "01. Wi-fi  Lo-fi (Original Mix)"
    ]
  },
  {
    "id": "track-sapula",
    "title": "SAPULA",
    "artist": "paesnobeat • PUB Records",
    "genre": "Jazz & Blues",
    "year": "2025",
    "labelColor": "#38bdf8",
    "coverBg": "linear-gradient(135deg, #0284c7, #082f49)",
    "coverImage": "https://i1.sndcdn.com/artworks-3yn982GpeeQ105W4-CfmMyw-large.png",
    "trackSlug": "pubrecords/sapula",
    "duration": "4:06",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/sapula.",
    "tracks": [
      "01. SAPULA (Original Mix)"
    ]
  },
  {
    "id": "track-quem-e-voce",
    "title": "Quem é Você",
    "artist": "paesnobeat • PUB Records",
    "genre": "Folk & Singer-Songwriter",
    "year": "2025",
    "labelColor": "#8b5cf6",
    "coverBg": "linear-gradient(135deg, #7c3aed, #2e1065)",
    "coverImage": "https://i1.sndcdn.com/artworks-xpzBlPJvASyJuV1C-LUyz7w-large.png",
    "trackSlug": "pubrecords/quem-e-voce",
    "duration": "5:31",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/quem-e-voce.",
    "tracks": [
      "01. Quem é Você (Original Mix)"
    ]
  },
  {
    "id": "track-day-set-fire-to-the-rain-adele",
    "title": "Day - Set Fire to the Rain - Adele - Cover",
    "artist": "paesnobeat • PUB Records",
    "genre": "Pop",
    "year": "2025",
    "labelColor": "#ec4899",
    "coverBg": "linear-gradient(135deg, #db2777, #500724)",
    "coverImage": "https://i1.sndcdn.com/avatars-yEuGz9F4uSiAy40t-FIQ8EA-t500x500.jpg",
    "trackSlug": "pubrecords/day-set-fire-to-the-rain-adele",
    "duration": "4:00",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/day-set-fire-to-the-rain-adele.",
    "tracks": [
      "01. Day - Set Fire to the Rain - Adele - Cover (Original Mix)"
    ]
  },
  {
    "id": "track-kelly-p-140bpm",
    "title": "KELLY P 140BPM",
    "artist": "paesnobeat • PUB Records",
    "genre": "Beat / Hip-Hop",
    "year": "2025",
    "labelColor": "#14b8a6",
    "coverBg": "linear-gradient(135deg, #0d9488, #042f2e)",
    "coverImage": "https://i1.sndcdn.com/artworks-aqWsyf5fNwxDRv96-lyuTOw-large.png",
    "trackSlug": "pubrecords/kelly-p-140bpm",
    "duration": "2:45",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/kelly-p-140bpm.",
    "tracks": [
      "01. KELLY P 140BPM (Original Mix)"
    ]
  },
  {
    "id": "track-mickey-jagger",
    "title": "mickey jagger",
    "artist": "paesnobeat • PUB Records",
    "genre": "Beat / Hip-Hop",
    "year": "2025",
    "labelColor": "#f97316",
    "coverBg": "linear-gradient(135deg, #ea580c, #431407)",
    "coverImage": "https://i1.sndcdn.com/avatars-yEuGz9F4uSiAy40t-FIQ8EA-t500x500.jpg",
    "trackSlug": "pubrecords/mickey-jagger",
    "duration": "5:49",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/mickey-jagger.",
    "tracks": [
      "01. mickey jagger (Original Mix)"
    ]
  },
  {
    "id": "track-333-matue-two-loves-duo",
    "title": "333 - MATUE - Two Loves Duo",
    "artist": "paesnobeat • PUB Records",
    "genre": "Trap",
    "year": "2025",
    "labelColor": "#eab308",
    "coverBg": "linear-gradient(135deg, #ca8a04, #422006)",
    "coverImage": "https://i1.sndcdn.com/artworks-2Qtl9nFlTqDSbufK-CKVZ1g-large.png",
    "trackSlug": "pubrecords/333-matue-two-loves-duo",
    "duration": "4:01",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/333-matue-two-loves-duo.",
    "tracks": [
      "01. 333 - MATUE - Two Loves Duo (Original Mix)"
    ]
  },
  {
    "id": "track-como-o-passarinho-rogerio-paes",
    "title": "COMO O PASSARINHO - ROGÉRIO PAES",
    "artist": "paesnobeat • PUB Records",
    "genre": "Pop",
    "year": "2025",
    "labelColor": "#6366f1",
    "coverBg": "linear-gradient(135deg, #4f46e5, #1e1b4b)",
    "coverImage": "https://i1.sndcdn.com/artworks-qUGQA1wXvmyVsRO3-MZuHmg-t500x500.jpg",
    "trackSlug": "pubrecords/como-o-passarinho-rogerio-paes",
    "duration": "3:49",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/como-o-passarinho-rogerio-paes.",
    "tracks": [
      "01. COMO O PASSARINHO - ROGÉRIO PAES (Original Mix)"
    ]
  },
  {
    "id": "track-1a",
    "title": "#1",
    "artist": "paesnobeat • PUB Records",
    "genre": "Ambient",
    "year": "2025",
    "labelColor": "#ef4444",
    "coverBg": "linear-gradient(135deg, #b91c1c, #450a0a)",
    "coverImage": "https://i1.sndcdn.com/avatars-yEuGz9F4uSiAy40t-FIQ8EA-t500x500.jpg",
    "trackSlug": "pubrecords/1a",
    "duration": "3:15",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/1a.",
    "tracks": [
      "01. #1 (Original Mix)"
    ]
  },
  {
    "id": "track-minibonsai-samanbaia",
    "title": "PINCHER - PIPICA",
    "artist": "paesnobeat • PUB Records",
    "genre": "Beat / Hip-Hop",
    "year": "2025",
    "labelColor": "#f59e0b",
    "coverBg": "linear-gradient(135deg, #d97706, #451a03)",
    "coverImage": "https://i1.sndcdn.com/avatars-yEuGz9F4uSiAy40t-FIQ8EA-t500x500.jpg",
    "trackSlug": "pubrecords/minibonsai-samanbaia",
    "duration": "3:32",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/minibonsai-samanbaia.",
    "tracks": [
      "01. PINCHER - PIPICA (Original Mix)"
    ]
  },
  {
    "id": "track-3a1",
    "title": "RELAXASSE - MATHEUS PAES",
    "artist": "paesnobeat • PUB Records",
    "genre": "Beat / Hip-Hop",
    "year": "2025",
    "labelColor": "#10b981",
    "coverBg": "linear-gradient(135deg, #059669, #064e3b)",
    "coverImage": "https://i1.sndcdn.com/artworks-au5bV7otgzmIbrxg-xJM4RA-large.png",
    "trackSlug": "pubrecords/3a1",
    "duration": "7:08",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/3a1.",
    "tracks": [
      "01. RELAXASSE - MATHEUS PAES (Original Mix)"
    ]
  },
  {
    "id": "track-lo-fi-chill-paesnobeat",
    "title": "Acalmasse - Matheus Paes",
    "artist": "paesnobeat • PUB Records",
    "genre": "Beat / Hip-Hop",
    "year": "2025",
    "labelColor": "#38bdf8",
    "coverBg": "linear-gradient(135deg, #0284c7, #082f49)",
    "coverImage": "https://i1.sndcdn.com/artworks-3dB8GUgzIDMSZTBy-8F3WBQ-large.png",
    "trackSlug": "pubrecords/lo-fi-chill-paesnobeat",
    "duration": "5:12",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/lo-fi-chill-paesnobeat.",
    "tracks": [
      "01. Acalmasse - Matheus Paes (Original Mix)"
    ]
  },
  {
    "id": "track-giv-on-heartbreak-anniversary",
    "title": "GIVĒON - Heartbreak Anniversary",
    "artist": "paesnobeat • PUB Records",
    "genre": "Beat / Hip-Hop",
    "year": "2025",
    "labelColor": "#8b5cf6",
    "coverBg": "linear-gradient(135deg, #7c3aed, #2e1065)",
    "coverImage": "https://i1.sndcdn.com/avatars-yEuGz9F4uSiAy40t-FIQ8EA-t500x500.jpg",
    "trackSlug": "pubrecords/giv-on-heartbreak-anniversary",
    "duration": "3:05",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/giv-on-heartbreak-anniversary.",
    "tracks": [
      "01. GIVĒON - Heartbreak Anniversary (Original Mix)"
    ]
  },
  {
    "id": "track-kendrick-lamar-ft-sza-luther-remix-paesnobeat",
    "title": "Kendrick Lamar ft SZA - Luther - REMIX - @PAESNOBEAT",
    "artist": "paesnobeat • PUB Records",
    "genre": "Hip-hop & Rap",
    "year": "2025",
    "labelColor": "#ec4899",
    "coverBg": "linear-gradient(135deg, #db2777, #500724)",
    "coverImage": "https://i1.sndcdn.com/artworks-9QbgpNM5JGwo9k7r-iEXAVw-large.png",
    "trackSlug": "pubrecords/kendrick-lamar-ft-sza-luther-remix-paesnobeat",
    "duration": "2:49",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/kendrick-lamar-ft-sza-luther-remix-paesnobeat.",
    "tracks": [
      "01. Kendrick Lamar ft SZA - Luther - REMIX - @PAESNOBEAT (Original Mix)"
    ]
  },
  {
    "id": "track-orochi-amor-de-fim-de-noite",
    "title": "Orochi - AMOR DE FIM DE NOITE - REMIX - @PAESnobeat",
    "artist": "paesnobeat • PUB Records",
    "genre": "Hip-hop & Rap",
    "year": "2025",
    "labelColor": "#14b8a6",
    "coverBg": "linear-gradient(135deg, #0d9488, #042f2e)",
    "coverImage": "https://i1.sndcdn.com/artworks-x7NjaazPZo2HyTeO-cKhInQ-large.png",
    "trackSlug": "pubrecords/orochi-amor-de-fim-de-noite",
    "duration": "4:11",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/orochi-amor-de-fim-de-noite.",
    "tracks": [
      "01. Orochi - AMOR DE FIM DE NOITE - REMIX - @PAESnobeat (Original Mix)"
    ]
  },
  {
    "id": "track-maria-matue-remix-paesnobeat",
    "title": "MARIA - MATUÊ - REMIX - @PAESnobeat",
    "artist": "paesnobeat • PUB Records",
    "genre": "Trap",
    "year": "2025",
    "labelColor": "#f97316",
    "coverBg": "linear-gradient(135deg, #ea580c, #431407)",
    "coverImage": "https://i1.sndcdn.com/artworks-oKsiXd4aPjyMZgQA-HdqyjA-large.png",
    "trackSlug": "pubrecords/maria-matue-remix-paesnobeat",
    "duration": "2:49",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/maria-matue-remix-paesnobeat.",
    "tracks": [
      "01. MARIA - MATUÊ - REMIX - @PAESnobeat (Original Mix)"
    ]
  },
  {
    "id": "track-333-matue-remix-paesnobeat",
    "title": "333 - Matuê - REMIX - @PAESnobeat",
    "artist": "paesnobeat • PUB Records",
    "genre": "Trap",
    "year": "2025",
    "labelColor": "#eab308",
    "coverBg": "linear-gradient(135deg, #ca8a04, #422006)",
    "coverImage": "https://i1.sndcdn.com/artworks-JDit5t6oxm6ZzWEL-3svi7A-t500x500.jpg",
    "trackSlug": "pubrecords/333-matue-remix-paesnobeat",
    "duration": "4:19",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/333-matue-remix-paesnobeat.",
    "tracks": [
      "01. 333 - Matuê - REMIX - @PAESnobeat (Original Mix)"
    ]
  },
  {
    "id": "track-snooze-sza-remix-paenobeat",
    "title": "SNOOZE - SZA - REMIX @PAENOBEAT",
    "artist": "paesnobeat • PUB Records",
    "genre": "R&B & Soul",
    "year": "2025",
    "labelColor": "#6366f1",
    "coverBg": "linear-gradient(135deg, #4f46e5, #1e1b4b)",
    "coverImage": "https://i1.sndcdn.com/artworks-oygWudzVz6mCHsVI-fH5Ypg-large.png",
    "trackSlug": "pubrecords/snooze-sza-remix-paenobeat",
    "duration": "2:37",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/snooze-sza-remix-paenobeat.",
    "tracks": [
      "01. SNOOZE - SZA - REMIX @PAENOBEAT (Original Mix)"
    ]
  },
  {
    "id": "track-kevin-o-chris-dj-nk-da-serra-faz-um-vuk-vuk-teto-espelhado-remix-paesnobeat",
    "title": "Kevin O Chris, DJ Nk Da Serra - Faz Um Vuk Vuk (Teto Espelhado) - REMIX - @PAESnobeat",
    "artist": "paesnobeat • PUB Records",
    "genre": "Trap",
    "year": "2025",
    "labelColor": "#ef4444",
    "coverBg": "linear-gradient(135deg, #b91c1c, #450a0a)",
    "coverImage": "https://i1.sndcdn.com/artworks-0jK3gIBNi4hMZYS0-4EZ8zQ-large.png",
    "trackSlug": "pubrecords/kevin-o-chris-dj-nk-da-serra-faz-um-vuk-vuk-teto-espelhado-remix-paesnobeat",
    "duration": "2:24",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/kevin-o-chris-dj-nk-da-serra-faz-um-vuk-vuk-teto-espelhado-remix-paesnobeat.",
    "tracks": [
      "01. Kevin O Chris, DJ Nk Da Serra - Faz Um Vuk Vuk (Teto Espelhado) - REMIX - @PAESnobeat (Original Mix)"
    ]
  },
  {
    "id": "track-filipe-ret-acima-de-mim-so-deus-remix-paesnobeat",
    "title": "Filipe Ret - Acima de Mim Só Deus - REMIX @PAESnobeat",
    "artist": "paesnobeat • PUB Records",
    "genre": "Hip-hop & Rap",
    "year": "2025",
    "labelColor": "#f59e0b",
    "coverBg": "linear-gradient(135deg, #d97706, #451a03)",
    "coverImage": "https://i1.sndcdn.com/artworks-ZQjsClIaegDEr5FP-SVxKGg-large.png",
    "trackSlug": "pubrecords/filipe-ret-acima-de-mim-so-deus-remix-paesnobeat",
    "duration": "2:36",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/filipe-ret-acima-de-mim-so-deus-remix-paesnobeat.",
    "tracks": [
      "01. Filipe Ret - Acima de Mim Só Deus - REMIX @PAESnobeat (Original Mix)"
    ]
  },
  {
    "id": "track-orochi-fashion-remix",
    "title": "Orochi - Fashion - REMIX @PAESnobeat",
    "artist": "paesnobeat • PUB Records",
    "genre": "Trap",
    "year": "2025",
    "labelColor": "#10b981",
    "coverBg": "linear-gradient(135deg, #059669, #064e3b)",
    "coverImage": "https://i1.sndcdn.com/artworks-asH5iUoZYvgc9N4f-OX45gw-large.png",
    "trackSlug": "pubrecords/orochi-fashion-remix",
    "duration": "3:37",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/orochi-fashion-remix.",
    "tracks": [
      "01. Orochi - Fashion - REMIX @PAESnobeat (Original Mix)"
    ]
  },
  {
    "id": "track-teto-mulher-secreta-ft-matue-wiu-remix-paesnobeat",
    "title": "Teto - MULHER SECRETA ft. Matuê, Wiu (REMIX PAESNOBEAT)",
    "artist": "paesnobeat • PUB Records",
    "genre": "Hip-hop & Rap",
    "year": "2025",
    "labelColor": "#38bdf8",
    "coverBg": "linear-gradient(135deg, #0284c7, #082f49)",
    "coverImage": "https://i1.sndcdn.com/artworks-cveqsQ0Q2D9rbcD1-BIYSXQ-large.png",
    "trackSlug": "pubrecords/teto-mulher-secreta-ft-matue-wiu-remix-paesnobeat",
    "duration": "3:43",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/teto-mulher-secreta-ft-matue-wiu-remix-paesnobeat.",
    "tracks": [
      "01. Teto - MULHER SECRETA ft. Matuê, Wiu (REMIX PAESNOBEAT) (Original Mix)"
    ]
  },
  {
    "id": "track-justin-bieber-ill-show-you-remix-paesmatmusic",
    "title": "Justin Bieber - I'll Show You - REMIX - PAESMATMUSIC",
    "artist": "paesnobeat • PUB Records",
    "genre": "Pop",
    "year": "2024",
    "labelColor": "#8b5cf6",
    "coverBg": "linear-gradient(135deg, #7c3aed, #2e1065)",
    "coverImage": "https://i1.sndcdn.com/avatars-yEuGz9F4uSiAy40t-FIQ8EA-t500x500.jpg",
    "trackSlug": "pubrecords/justin-bieber-ill-show-you-remix-paesmatmusic",
    "duration": "3:21",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/justin-bieber-ill-show-you-remix-paesmatmusic.",
    "tracks": [
      "01. Justin Bieber - I'll Show You - REMIX - PAESMATMUSIC (Original Mix)"
    ]
  },
  {
    "id": "track-sza-snooze-fingerstyle",
    "title": "SZA - SnoozE - FINGERSTYLE - REMIX - @PAESMATMUSIC",
    "artist": "paesnobeat • PUB Records",
    "genre": "R&B & Soul",
    "year": "2024",
    "labelColor": "#ec4899",
    "coverBg": "linear-gradient(135deg, #db2777, #500724)",
    "coverImage": "https://i1.sndcdn.com/avatars-yEuGz9F4uSiAy40t-FIQ8EA-t500x500.jpg",
    "trackSlug": "pubrecords/sza-snooze-fingerstyle",
    "duration": "3:26",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/sza-snooze-fingerstyle.",
    "tracks": [
      "01. SZA - SnoozE - FINGERSTYLE - REMIX - @PAESMATMUSIC (Original Mix)"
    ]
  },
  {
    "id": "track-khalid-better-remix-paesmatmusic",
    "title": "Khalid - Better  - REMIX - @PAESMATMUSIC",
    "artist": "paesnobeat • PUB Records",
    "genre": "Hip-hop & Rap",
    "year": "2024",
    "labelColor": "#14b8a6",
    "coverBg": "linear-gradient(135deg, #0d9488, #042f2e)",
    "coverImage": "https://i1.sndcdn.com/avatars-yEuGz9F4uSiAy40t-FIQ8EA-t500x500.jpg",
    "trackSlug": "pubrecords/khalid-better-remix-paesmatmusic",
    "duration": "3:27",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/khalid-better-remix-paesmatmusic.",
    "tracks": [
      "01. Khalid - Better  - REMIX - @PAESMATMUSIC (Original Mix)"
    ]
  },
  {
    "id": "track-role-na-favela-de-nave",
    "title": "Oruam ft. Didi - Rolé na favela de Nave (Prod. LC da Roça) - REMIX - @PAESMATMUSIC",
    "artist": "paesnobeat • PUB Records",
    "genre": "Beat / Hip-Hop",
    "year": "2024",
    "labelColor": "#f97316",
    "coverBg": "linear-gradient(135deg, #ea580c, #431407)",
    "coverImage": "https://i1.sndcdn.com/artworks-vEPQYDjLCjpNZ2We-bsASSQ-t500x500.jpg",
    "trackSlug": "pubrecords/role-na-favela-de-nave",
    "duration": "1:19",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/role-na-favela-de-nave.",
    "tracks": [
      "01. Oruam ft. Didi - Rolé na favela de Nave (Prod. LC da Roça) - REMIX - @PAESMATMUSIC (Original Mix)"
    ]
  },
  {
    "id": "track-wiu-coracao-de-gelo",
    "title": "WIU - Coração De Gelo",
    "artist": "paesnobeat • PUB Records",
    "genre": "Beat / Hip-Hop",
    "year": "2024",
    "labelColor": "#eab308",
    "coverBg": "linear-gradient(135deg, #ca8a04, #422006)",
    "coverImage": "https://i1.sndcdn.com/artworks-Vbq4yGQklNrzjF2S-mXk6sw-t500x500.jpg",
    "trackSlug": "pubrecords/wiu-coracao-de-gelo",
    "duration": "2:54",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/wiu-coracao-de-gelo.",
    "tracks": [
      "01. WIU - Coração De Gelo (Original Mix)"
    ]
  },
  {
    "id": "track-pericles-melhor-eu-ir",
    "title": "PÉRICLES - MELHOR EU IR - REMIX - PAESMAT",
    "artist": "paesnobeat • PUB Records",
    "genre": "Beat / Hip-Hop",
    "year": "2024",
    "labelColor": "#6366f1",
    "coverBg": "linear-gradient(135deg, #4f46e5, #1e1b4b)",
    "coverImage": "https://i1.sndcdn.com/artworks-Rw9N2PeiLc83rBQ2-Dm7YQw-t500x500.jpg",
    "trackSlug": "pubrecords/pericles-melhor-eu-ir",
    "duration": "4:15",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/pericles-melhor-eu-ir.",
    "tracks": [
      "01. PÉRICLES - MELHOR EU IR - REMIX - PAESMAT (Original Mix)"
    ]
  },
  {
    "id": "track-yame-becane-a-colors-show-remix-paesmatmusic",
    "title": "Yamê - Bécane -A COLORS SHOW - REMIX PAESMATMUSIC",
    "artist": "paesnobeat • PUB Records",
    "genre": "R&B & Soul",
    "year": "2024",
    "labelColor": "#ef4444",
    "coverBg": "linear-gradient(135deg, #b91c1c, #450a0a)",
    "coverImage": "https://i1.sndcdn.com/artworks-yoibLCSudeIx53nv-M6ogrQ-t500x500.jpg",
    "trackSlug": "pubrecords/yame-becane-a-colors-show-remix-paesmatmusic",
    "duration": "3:04",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/yame-becane-a-colors-show-remix-paesmatmusic.",
    "tracks": [
      "01. Yamê - Bécane -A COLORS SHOW - REMIX PAESMATMUSIC (Original Mix)"
    ]
  },
  {
    "id": "track-orochi-mesma-historia-feat-caio-luccas-remix-paesmatmusic",
    "title": "Orochi  Mesma História  Feat. Caio Luccas - REMIX - PAESMATMUSIC",
    "artist": "paesnobeat • PUB Records",
    "genre": "Beat / Hip-Hop",
    "year": "2024",
    "labelColor": "#f59e0b",
    "coverBg": "linear-gradient(135deg, #d97706, #451a03)",
    "coverImage": "https://i1.sndcdn.com/artworks-fh8TMMASBCnnbebI-k18V9Q-t500x500.jpg",
    "trackSlug": "pubrecords/orochi-mesma-historia-feat-caio-luccas-remix-paesmatmusic",
    "duration": "2:43",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/orochi-mesma-historia-feat-caio-luccas-remix-paesmatmusic.",
    "tracks": [
      "01. Orochi  Mesma História  Feat. Caio Luccas - REMIX - PAESMATMUSIC (Original Mix)"
    ]
  },
  {
    "id": "track-bin-mira-laser-remix-paesmat",
    "title": "BIN - Mira Laser - REMIX - PAESMAT",
    "artist": "paesnobeat • PUB Records",
    "genre": "Beat / Hip-Hop",
    "year": "2024",
    "labelColor": "#10b981",
    "coverBg": "linear-gradient(135deg, #059669, #064e3b)",
    "coverImage": "https://i1.sndcdn.com/artworks-fcTqHHONYz8uUt5c-wMZWZw-t500x500.jpg",
    "trackSlug": "pubrecords/bin-mira-laser-remix-paesmat",
    "duration": "2:36",
    "description": "Faixa oficial da PUB Records produzida por Matheus Paes (paesnobeat) disponível em soundcloud.com/pubrecords/bin-mira-laser-remix-paesmat.",
    "tracks": [
      "01. BIN - Mira Laser - REMIX - PAESMAT (Original Mix)"
    ]
  }
];

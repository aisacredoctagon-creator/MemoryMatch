# Memory Match: Petualangan Rimba

Game mencocokkan kartu bertema hutan. Situs statis murni (HTML + CSS + JavaScript vanilla): tanpa build step dan tanpa dependency npm.

**Demo:** https://aisacredoctagon-creator.github.io/MemoryMatch/

## Cara main
1. Pilih ukuran papan di dropdown **Ukuran** (4×4, 4×5, 5×6, 6×6, atau 6×8). Mengganti ukuran langsung memulai game baru.
2. Balik dua kartu per giliran. Kalau gambarnya sama, kartu tetap terbuka dan diberi tanda centang. Kalau beda, keduanya menutup lagi setelah jeda singkat.
3. Temukan semua pasangan secepat dan sesedikit langkah mungkin. Timer mulai saat kartu pertama dibalik.
4. Rekor terbaik (langkah dan waktu) tersimpan per ukuran papan di browser (`localStorage`).
5. Tombol **Ulang** memulai game baru kapan saja.

Bisa dimainkan dengan keyboard (Tab untuk pindah kartu, Enter/Space untuk membalik). Animasi flip diganti fade jika perangkat memakai `prefers-reduced-motion`.

## Menjalankan lokal
Cara paling mudah: buka `index.html` langsung di browser (klik dua kali).

Atau lewat server statis, salah satunya:

```bash
# Python
python -m http.server 8000

# Node.js
npx serve .
```

Lalu buka <http://localhost:8000>.

## Struktur proyek
```
index.html       halaman utama (di root, dibutuhkan GitHub Pages)
style.css        seluruh gaya; semua nilai desain ada di :root
script.js        logika game
assets/          SVG dari desain Figma, favicon, apple-touch-icon, og-image.png (1200x630)
```
Semua path memakai path relatif, jadi situs aman dijalankan di subpath seperti `/MemoryMatch/`. Satu-satunya sumber daya eksternal adalah font Google Fonts (Fredoka, Luckiest Guy, Freckle Face) dengan fallback sistem.

Tag Open Graph di `index.html` memakai URL absolut untuk `og:url` dan `og:image` (wajib untuk pratinjau di WhatsApp dan sosial media). Kalau nama repo atau username berubah, perbarui kedua URL itu.

## Deploy ke GitHub Pages
1. Push proyek ke repository GitHub (branch `main`).
2. Buka **Settings → Pages**.
3. Pada *Build and deployment*, pilih **Deploy from a branch**, branch `main`, folder `/ (root)`, lalu **Save**.
4. Situs tersedia di `https://<username>.github.io/<nama-repo>/` setelah beberapa menit.

Alternatif gratis lain: Netlify (drag & drop folder ke <https://app.netlify.com/drop>) atau Vercel (`npx vercel --prod`, Framework Preset **Other**, tanpa build command). Keduanya melayani situs di root domain, jadi path relatif tetap berfungsi.

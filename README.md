# 🔥 WA Bot Bara

Bot WhatsApp simple dengan fitur Menu + Reply View Once.

## Fitur

- `.menu` — Tampilkan menu bot
- `.rvo` — Reply foto sekali lihat, bot kirim ulang

## Cara Pakai

### 1. Clone repo

```bash
git clone https://github.com/USERNAME/wa-bot-bara.git
cd wa-bot-bara
```

### 2. Install dependencies

```bash
npm install
```

### 3. Setup .env

```bash
cp .env.example .env
nano .env
```

Isi `.env`:
```
BOT_NUMBER=628xxxxxxxxxx
SESSION_NAME=auth_session
MODE=pairing
```

### 4. Jalanin

```bash
npm start
```

### 5. Pairing

- Muncul pairing code di terminal
- Buka WhatsApp → Perangkat Tertaut → Tautkan dengan Nomor
- Ketik kode
- Bot siap

## Penggunaan

### `.menu`

Kirim `.menu` di chat pribadi bot → bot balas menu.

### `.rvo` (Reply View Once)

1. Kirim foto sekali lihat ke bot
2. Reply foto tersebut
3. Ketik `.rvo`
4. Bot kirim ulang fotonya tanpa view once

## Deploy

### Termux

```bash
pkg install nodejs git -y
git clone https://github.com/USERNAME/wa-bot-bara.git
cd wa-bot-bara
npm install
npm start
```

### VPS / Railway / Render

- Push ke GitHub
- Deploy ke Railway/Render
- Set env variable

## License

MIT
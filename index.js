// ═══════════════════════════════════════════════════════════
// WA BOT BARA v3.0 — SESSION SAFE + PAIRING FIX
// ═══════════════════════════════════════════════════════════

require('dotenv').config();
const makeWASocket = require('@whiskeysockets/baileys').default;
const {
    useMultiFileAuthState,
    DisconnectReason,
    Browsers,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const P = require('pino');
const readline = require('readline');
const fs = require('fs');

const SESSION_NAME = process.env.SESSION_NAME || 'auth_session';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(r => rl.question(q, r));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function log(msg) {
    console.log('[' + new Date().toLocaleTimeString() + '] ' + msg);
}

function isCommand(text, cmd) {
    if (!text) return false;
    return text.trim().toLowerCase() === cmd.toLowerCase();
}

// ═══════════════════════════════════════════════════════════
// START BOT — SESSION SAFE
// ═══════════════════════════════════════════════════════════

async function startBot() {
    // ⚠️ JANGAN auto-hapus session
    // Cuma hapus kalau lu manual hapus folder-nya
    const credsPath = SESSION_NAME + '/creds.json';
    const hasSession = fs.existsSync(credsPath);

    if (hasSession) {
        log('Session ditemukan, coba resume...');
    } else {
        log('Session tidak ada, butuh pairing baru');
    }

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_NAME);
    const { version } = await fetchLatestBaileysVersion();

    log('WA protocol version: ' + version.join('.'));

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        logger: P({ level: 'silent' }),
        browser: Browsers.ubuntu('Chrome'),
        syncFullHistory: false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        generateHighQualityLinkPreview: false,
        getMessage: async () => undefined
    });

    sock.ev.on('creds.update', saveCreds);

    // ═══════════════════════════════════════════════════════
    // PAIRING CODE — kalau belum registered
    // ═══════════════════════════════════════════════════════
    if (!sock.authState.creds.registered) {
        await sleep(3000);

        let botNumber = process.env.BOT_NUMBER;
        if (!botNumber) {
            botNumber = (await ask('\n[?] Nomor bot (contoh: 6283172030829): ')).trim();
        }

        const cleanNumber = botNumber.replace(/[^0-9]/g, '');

        console.log('');
        console.log('═══════════════════════════════════════════');
        console.log('  PAIRING REQUEST');
        console.log('  Nomor: ' + cleanNumber);
        console.log('═══════════════════════════════════════════');
        console.log('');

        try {
            const pairingCode = await sock.requestPairingCode(cleanNumber);

            console.log('');
            console.log('═══════════════════════════════════════════');
            console.log('           🔑 PAIRING CODE 🔑');
            console.log('');
            console.log('              >>> ' + pairingCode + ' <<<');
            console.log('');
            console.log('═══════════════════════════════════════════');
            console.log('');
            console.log('  CARA PAKAI:');
            console.log('');
            console.log('  1. BUKA WhatsApp di HP nomor ' + cleanNumber);
            console.log('  2. Menu (⋮) → Perangkat Tertaut');
            console.log('  3. Tautkan Perangkat');
            console.log('  4. Pilih "Tautkan dengan Nomor Telepon"');
            console.log('  5. Ketik: ' + pairingCode);
            console.log('');
            console.log('  ⚡ Expired 2 menit. BURUAN!');
            console.log('');
            console.log('  [*] Menunggu...');
            console.log('');

        } catch (e) {
            console.error('');
            console.error('[✗] GAGAL request pairing code');
            console.error('[✗] Error: ' + e.message);
            console.error('');
            console.error('KEMUNGKINAN PENYEBAB:');
            console.error('1. Device penuh (4 linked) — hapus 1 di WA');
            console.error('2. WhatsApp versi lama — update dulu');
            console.error('3. Nomor salah format — harus 62xxx');
            console.error('4. Rate limit — tunggu 10 menit');
            console.error('5. Baileys 7.0.0-rc (buggy) — turunin ke 6.7.9');
            console.error('');
            process.exit(1);
        }
    }

    // ═══════════════════════════════════════════════════════
    // HANDLE MESSAGE
    // ═══════════════════════════════════════════════════════
    sock.ev.on('messages.upsert', async (msg) => {
        try {
            const m = msg.messages[0];
            if (!m.message) return;
            if (m.key.fromMe) return;

            const from = m.key.remoteJid;
            const text =
                m.message.conversation ||
                m.message.extendedTextMessage?.text ||
                m.message.imageMessage?.caption ||
                m.message.videoMessage?.caption ||
                '';

            log('Pesan dari ' + from + ': ' + text.substring(0, 50));

            // ─── .menu ───
            if (isCommand(text, '.menu')) {
                const menuText =
                    '╭━━━━━━━━━━━━━━━━━━━━━╮\n' +
                    '┃  🔥 *BARA BOT* 🔥   ┃\n' +
                    '╰━━━━━━━━━━━━━━━━━━━━━╯\n' +
                    '\n' +
                    'Halo *Bara*! Ini menunya:\n' +
                    '\n' +
                    '╭──「 *MAIN MENU* 」──\n' +
                    '│\n' +
                    '│ .menu → Menu\n' +
                    '│ .rvo  → Reply View Once\n' +
                    '│\n' +
                    '╰──────────────────\n' +
                    '\n' +
                    '*Cara pakai .rvo:*\n' +
                    '1. Kirim foto sekali lihat\n' +
                    '2. Reply fotonya\n' +
                    '3. Ketik .rvo\n' +
                    '4. Bot kirim ulang\n' +
                    '\n' +
                    '> BARA BOT ☠️';

                await sock.sendMessage(from, { text: menuText }, { quoted: m });
                log('Menu terkirim');
                return;
            }

            // ─── .rvo ───
            if (isCommand(text, '.rvo')) {
                const quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage;

                if (!quoted) {
                    await sock.sendMessage(from, {
                        text: '❌ Reply foto sekali lihat dulu, baru ketik .rvo'
                    }, { quoted: m });
                    return;
                }

                let viewOnce = null;
                if (quoted.viewOnceMessageV2) {
                    viewOnce = quoted.viewOnceMessageV2.message;
                } else if (quoted.viewOnceMessage) {
                    viewOnce = quoted.viewOnceMessage.message;
                } else if (quoted.viewOnceMessageV2Extension) {
                    viewOnce = quoted.viewOnceMessageV2Extension.message;
                }

                if (!viewOnce) {
                    await sock.sendMessage(from, {
                        text: '❌ Yang lu reply bukan foto sekali lihat'
                    }, { quoted: m });
                    return;
                }

                if (viewOnce.imageMessage) {
                    await sock.sendMessage(from, {
                        image: viewOnce.imageMessage,
                        caption: viewOnce.imageMessage.caption || '',
                        mimetype: viewOnce.imageMessage.mimetype || 'image/jpeg'
                    }, { quoted: m });
                    log('RVO image terkirim');
                } else if (viewOnce.videoMessage) {
                    await sock.sendMessage(from, {
                        video: viewOnce.videoMessage,
                        caption: viewOnce.videoMessage.caption || '',
                        mimetype: viewOnce.videoMessage.mimetype || 'video/mp4'
                    }, { quoted: m });
                    log('RVO video terkirim');
                } else if (viewOnce.audioMessage) {
                    await sock.sendMessage(from, {
                        audio: viewOnce.audioMessage,
                        mimetype: viewOnce.audioMessage.mimetype || 'audio/ogg',
                        ptt: true
                    }, { quoted: m });
                    log('RVO audio terkirim');
                } else {
                    await sock.sendMessage(from, {
                        text: '❌ Tipe view once tidak didukung'
                    }, { quoted: m });
                }
                return;
            }

        } catch (e) {
            console.error('[✗] Error: ' + e.message);
        }
    });

    // ═══════════════════════════════════════════════════════
    // CONNECTION HANDLER — AUTO RECONNECT
    // ═══════════════════════════════════════════════════════
    return new Promise((resolve, reject) => {
        let resolved = false;

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open' && !resolved) {
                resolved = true;
                console.log('');
                console.log('╔═══════════════════════════════════════════╗');
                console.log('║       [✓] BOT CONNECTED!                 ║');
                console.log('╚═══════════════════════════════════════════╝');
                console.log('[USER] ' + (sock.user?.id || 'unknown'));
                console.log('[NAME] ' + (sock.user?.name || 'unknown'));
                console.log('');
                console.log('[*] Bot siap. Kirim .menu dari WhatsApp.');
                console.log('');
                resolve(sock);
            }

            if (connection === 'close' && !resolved) {
                const code = lastDisconnect?.error?.output?.statusCode;
                const reason = lastDisconnect?.error?.message || 'unknown';
                log('Connection closed: ' + reason + ' (' + code + ')');

                // Logged out dari HP — session invalid
                if (code === DisconnectReason.loggedOut || code === 401) {
                    console.error('[✗] Logged out. Hapus auth_session & ulang.');
                    reject(new Error('Logged out'));
                    return;
                }

                // Bad session
                if (code === DisconnectReason.badSession) {
                    console.error('[✗] Bad session. Hapus auth_session & ulang.');
                    reject(new Error('Bad session'));
                    return;
                }

                // Auto reconnect
                log('Reconnect 5s...');
                await sleep(5000);
                try {
                    const newSock = await startBot();
                    resolve(newSock);
                } catch (e) {
                    reject(e);
                }
            }
        });
    });
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════

(async () => {
    console.log('');
    console.log('╔═══════════════════════════════════════════╗');
    console.log('║    🔥 WA BOT BARA v3.0 🔥                 ║');
    console.log('║    Session Safe + Pairing Fix              ║');
    console.log('╚═══════════════════════════════════════════╝');
    console.log('');

    try {
        await startBot();
    } catch (e) {
        console.error('[✗] Fatal: ' + e.message);
        process.exit(1);
    }
})();

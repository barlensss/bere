// ═══════════════════════════════════════════════════════════
// WA BOT BARA — Simple Menu + RVO
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
const MODE = process.env.MODE || 'pairing';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(r => rl.question(q, r));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════
// HELPER
// ═══════════════════════════════════════════════════════════

function log(msg) {
    console.log('[' + new Date().toLocaleTimeString() + '] ' + msg);
}

function isCommand(text, cmd) {
    if (!text) return false;
    return text.trim().toLowerCase() === cmd.toLowerCase();
}

// ═══════════════════════════════════════════════════════════
// BOT START
// ═══════════════════════════════════════════════════════════

async function startBot() {
    const { version } = await fetchLatestBaileysVersion();
    log('Baileys version: ' + version.join('.'));

    // Cek session lama
    const credsPath = SESSION_NAME + '/creds.json';
    if (fs.existsSync(credsPath)) {
        try {
            const creds = JSON.parse(fs.readFileSync(credsPath));
            if (!creds.me) {
                log('Session belum registered, hapus...');
                fs.rmSync(SESSION_NAME, { recursive: true, force: true });
            }
        } catch (e) {
            fs.rmSync(SESSION_NAME, { recursive: true, force: true });
        }
    }

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_NAME);

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: MODE === 'qr',
        logger: P({ level: 'silent' }),
        browser: Browsers.ubuntu('Chrome'),
        syncFullHistory: false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 180000,
        defaultQueryTimeoutMs: 180000,
        keepAliveIntervalMs: 25000,
        generateHighQualityLinkPreview: false,
        getMessage: async () => undefined
    });

    sock.ev.on('creds.update', saveCreds);

    // ─── PAIRING MODE ───
    if (MODE === 'pairing' && !sock.authState.creds.registered) {
        await sleep(2000);

        let botNumber = process.env.BOT_NUMBER;
        if (!botNumber) {
            botNumber = (await ask('[?] Nomor bot (contoh: 6283172030829): ')).trim();
        }

        const cleanNumber = botNumber.replace(/[^0-9]/g, '');
        log('Request pairing code untuk: ' + cleanNumber);

        let pairingCode = null;
        for (let attempt = 1; attempt <= 5; attempt++) {
            try {
                pairingCode = await sock.requestPairingCode(cleanNumber);
                break;
            } catch (e) {
                log('Gagal attempt ' + attempt + ': ' + e.message);
                if (attempt < 5) await sleep(5000);
            }
        }

        if (!pairingCode) {
            console.error('[✗] Gagal request pairing code');
            process.exit(1);
        }

        console.log('\n═══════════════════════════════════════════');
        console.log('           🔑 PAIRING CODE 🔑');
        console.log('');
        console.log('              >>> ' + pairingCode + ' <<<');
        console.log('');
        console.log('═══════════════════════════════════════════');
        console.log('');
        console.log('  CARA PAKAI:');
        console.log('  1. Buka WhatsApp → Perangkat Tertaut');
        console.log('  2. Tautkan Perangkat');
        console.log('  3. Pilih "Tautkan dengan Nomor Telepon"');
        console.log('  4. Ketik: ' + pairingCode);
        console.log('');
        console.log('  ⚡ Expired 2 menit');
        console.log('');
    }

    // ─── HANDLE MESSAGE ───
    sock.ev.on('messages.upsert', async (msg) => {
        try {
            const m = msg.messages[0];
            if (!m.message) return;
            if (m.key.fromMe) return;

            const from = m.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const sender = isGroup ? m.key.participant : from;

            // Ambil text
            const text =
                m.message.conversation ||
                m.message.extendedTextMessage?.text ||
                m.message.imageMessage?.caption ||
                m.message.videoMessage?.caption ||
                '';

            log('Pesan dari ' + sender + ': ' + text.substring(0, 50));

            // ─── COMMAND .menu ───
            if (isCommand(text, '.menu')) {
                const menuText = 
                    '╭━━━━━━━━━━━━━━━━━━━━━╮\n' +
                    '┃  🔥 *BARA BOT* 🔥      ┃\n' +
                    '╰━━━━━━━━━━━━━━━━━━━━━╯\n' +
                    '\n' +
                    'Halo *Bara*! Ini menunya:\n' +
                    '\n' +
                    '╭──「 *MAIN MENU* 」──\n' +
                    '│\n' +
                    '│ .menu   → Tampilkan menu\n' +
                    '│ .rvo    → Reply View Once\n' +
                    '│\n' +
                    '╰──────────────────\n' +
                    '\n' +
                    '*Cara pakai .rvo:*\n' +
                    '1. Kirim foto sekali lihat\n' +
                    '2. Reply fotonya\n' +
                    '3. Ketik .rvo\n' +
                    '4. Bot kirim ulang fotonya\n' +
                    '\n' +
                    '> BARA BOT ☠️';

                await sock.sendMessage(from, { text: menuText }, { quoted: m });
                log('Menu terkirim ke ' + from);
                return;
            }

            // ─── COMMAND .rvo (Reply View Once) ───
            if (isCommand(text, '.rvo')) {
                // Cek apakah ini reply
                const quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage;

                if (!quoted) {
                    await sock.sendMessage(from, {
                        text: '❌ Reply foto sekali lihat dulu, baru ketik .rvo'
                    }, { quoted: m });
                    return;
                }

                // Cek apakah quoted message adalah view once
                let viewOnce = null;
                let type = null;

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

                // Kirim ulang tanpa view once
                if (viewOnce.imageMessage) {
                    type = 'image';
                    await sock.sendMessage(from, {
                        image: viewOnce.imageMessage,
                        caption: viewOnce.imageMessage.caption || '',
                        mimetype: viewOnce.imageMessage.mimetype || 'image/jpeg'
                    }, { quoted: m });
                    log('RVO image terkirim ke ' + from);
                } else if (viewOnce.videoMessage) {
                    type = 'video';
                    await sock.sendMessage(from, {
                        video: viewOnce.videoMessage,
                        caption: viewOnce.videoMessage.caption || '',
                        mimetype: viewOnce.videoMessage.mimetype || 'video/mp4'
                    }, { quoted: m });
                    log('RVO video terkirim ke ' + from);
                } else if (viewOnce.audioMessage) {
                    type = 'audio';
                    await sock.sendMessage(from, {
                        audio: viewOnce.audioMessage,
                        mimetype: viewOnce.audioMessage.mimetype || 'audio/ogg',
                        ptt: true
                    }, { quoted: m });
                    log('RVO audio terkirim ke ' + from);
                } else {
                    await sock.sendMessage(from, {
                        text: '❌ Tipe view once tidak didukung'
                    }, { quoted: m });
                }
                return;
            }

        } catch (e) {
            console.error('[✗] Error handle message: ' + e.message);
        }
    });

    // ─── WAIT CONNECTION ───
    return new Promise((resolve, reject) => {
        let resolved = false;

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open' && !resolved) {
                resolved = true;
                console.log('\n╔═══════════════════════════════════════════╗');
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

                if (code === DisconnectReason.loggedOut || code === 401) {
                    reject(new Error('Logged out'));
                    return;
                }

                log('Reconnect...');
                await sleep(3000);
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
    console.log('║       🔥 WA BOT BARA v1.0 🔥              ║');
    console.log('║          Simple + RVO                      ║');
    console.log('╚═══════════════════════════════════════════╝');
    console.log('');

    try {
        await startBot();
    } catch (e) {
        console.error('[✗] Fatal: ' + e.message);
        process.exit(1);
    }
})();
process.on('uncaughtException', e => console.log('CRASH:', e))
process.on('unhandledRejection', e => console.log('CRASH PROMISE:', e))

const express = require('express')
const app = express()
let latestQR = null

app.get('/', (req, res) => res.send('PAVE-BOT Online ✅'))
app.get('/qr', (req, res) => {
    if (!latestQR) return res.send('<h1>✅ PAVE-BOT gia connesso, nessun QR</h1>')
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(latestQR)}`
    res.send(`
        <h1>PAVE-BOT - Scansiona QR</h1>
        <p>WhatsApp > Dispositivi collegati > Collega dispositivo</p>
        <img src="${qrUrl}" width="400" height="400" />
        <p>Si auto-aggiorna ogni 20 sec</p>
        <script>setTimeout(()=>location.reload(), 20000)</script>
    `)
})

const PORT = process.env.PORT || 3000
app.listen(PORT, '0.0.0.0', () => {
    console.log(`WEB ON PORT ${PORT}`)
    startBot()
})

const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys')
const pino = require('pino')
const fs = require('fs')
const qrcode = require('qrcode-terminal')

const BOT_NAME = "PAVE-BOT"
const OWNER_NUMBER = "393381532143@s.whatsapp.net"
let isBotOn = true
const spamMap = new Map()
const BAN_TIME = 10 * 60 * 1000

function loadDB() {
    if (!fs.existsSync('./db.json')) fs.writeFileSync('./db.json', JSON.stringify({}))
    return JSON.parse(fs.readFileSync('./db.json'))
}
function saveDB(db) { fs.writeFileSync('./db.json', JSON.stringify(db, null, 2)) }

async function startBot() {
    try {
        console.log('Avvio bot...')
        const { state, saveCreds } = await useMultiFileAuthState('./auth')
        const sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }) })
        sock.ev.on('creds.update', saveCreds)

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update
            if (qr) {
                latestQR = qr
                console.log('=== PAVE-BOT QR GENERATO ===')
                console.log(`QR LINK: ${process.env.RENDER_EXTERNAL_URL || 'https://tuo-link.onrender.com'}/qr`)
                qrcode.generate(qr, { small: true })
            }
            if (connection === 'close') {
                console.log('Connessione chiusa')
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== 401
                if (shouldReconnect) setTimeout(startBot, 3000)
                else { latestQR = null; console.log('Logout - cancella cartella auth') }
            } else if (connection === 'open') {
                latestQR = null
                console.log(`✅ ${BOT_NAME} CONNESSO`)
            }
        })

        sock.ev.on('messages.upsert', async ({ messages }) => {
            const m = messages[0]
            if (!m.message || m.key.fromMe) return
            const chatJid = m.key.remoteJid
            const senderJid = m.key.participant || m.key.remoteJid
            const text = m.message.conversation || m.message.extendedTextMessage?.text || ""
            const lower = text.toLowerCase().trim()
            let db = loadDB()
            if (!db[senderJid]) db[senderJid] = { soldi: 0, banca: 0, lastMina: 0 }

            let isBanned = false, bannedRemaining = 0
            if (chatJid.endsWith('@g.us') && senderJid!== OWNER_NUMBER) {
                const now = Date.now()
                let userSpam = spamMap.get(senderJid) || { count: 0, lastTime: 0, bannedUntil: 0 }
                if (userSpam.bannedUntil > now) {
                    isBanned = true; bannedRemaining = userSpam.bannedUntil - now
                    if (!lower.startsWith("/menu") &&!lower.startsWith("/help") && lower!== "/on" && lower!== "/off") return
                } else {
                    if (!lower.startsWith("/menu") &&!lower.startsWith("/help")) {
                        if (now - userSpam.lastTime < 2500) {
                            userSpam.count++
                            if (userSpam.count >= 4) {
                                userSpam.bannedUntil = now + BAN_TIME; userSpam.count = 0
                                spamMap.set(senderJid, userSpam)
                                return await sock.sendMessage(chatJid, { text: `💀 @${senderJid.split('@')[0]} BANNATO 10 MIN PER SPAM\nUsa solo /menu`, mentions: [senderJid] })
                            }
                        } else userSpam.count = 1
                        userSpam.lastTime = now; spamMap.set(senderJid, userSpam)
                    }
                }
            }

            if (lower === "/on" || lower === "/off") {
                if (senderJid!== OWNER_NUMBER) return sock.sendMessage(chatJid, { text: `Non sei owner` })
                isBotOn = lower === "/on"
                return sock.sendMessage(chatJid, { text: isBotOn? `✅ ${BOT_NAME} ON` : `❌ ${BOT_NAME} OFF` })
            }
            if (!isBotOn) return

            if (lower === "/menu" || lower === "/help") {
                let banText = ""
                if (isBanned) { let min = Math.floor(bannedRemaining / 60000); let sec = Math.floor((bannedRemaining % 60000) / 1000); banText = `\n\n⛔ SEI BANNATO! Mancano ${min}m ${sec}s\n` }
                return sock.sendMessage(chatJid, { text: `*🤖 ${BOT_NAME} MENU*${banText}\n\n💰 ECONOMIA\n/mina - guadagni ogni 10 min\n/soldi - vedi soldi\n/banca - vedi banca\n/deposita [num]\n/preleva [num]\n/pay @persona [num]\n\n😂 FUN\n/slap @persona - 40% nessuno vede 50€ dentista, 60% multa 50€\n\n👑 OWNER\n/on /off` })
            }
            if (isBanned) return

            if (lower.startsWith("/mina")) {
                let now = Date.now()
                if (now - db[senderJid].lastMina < 10 * 60 * 1000) {
                    let sec = Math.ceil((10 * 60 * 1000 - (now - db[senderJid].lastMina)) / 1000)
                    return sock.sendMessage(chatJid, { text: `⏳ Aspetta ${Math.floor(sec/60)}m ${sec%60}s` })
                }
                let guadagno = Math.floor(Math.random() * 100) + 50
                db[senderJid].soldi += guadagno; db[senderJid].lastMina = now; saveDB(db)
                return sock.sendMessage(chatJid, { text: `⛏️ Hai minato ${guadagno}€!` })
            }
            else if (lower === "/soldi" || lower === "/bal") return sock.sendMessage(chatJid, { text: `💰 Hai ${db[senderJid].soldi}€ in mano, ${db[senderJid].banca}€ in banca` })
            else if (lower === "/banca") return sock.sendMessage(chatJid, { text: `🏦 Banca: ${db[senderJid].banca}€` })
            else if (lower.startsWith("/deposita")) {
                let amount = parseInt(lower.split(" ")[1])
                if (isNaN(amount) || amount <= 0) return sock.sendMessage(chatJid, { text: `Usa: /deposita 100` })
                if (db[senderJid].soldi < amount) return sock.sendMessage(chatJid, { text: `Non hai abbastanza soldi` })
                db[senderJid].soldi -= amount; db[senderJid].banca += amount; saveDB(db)
                return sock.sendMessage(chatJid, { text: `✅ Depositati ${amount}€` })
            }
            else if (lower.startsWith("/preleva")) {
                let amount = parseInt(lower.split(" ")[1])
                if (isNaN(amount) || amount <= 0) return sock.sendMessage(chatJid, { text: `Usa: /preleva 100` })
                if (db[senderJid].banca < amount) return sock.sendMessage(chatJid, { text: `Non hai abbastanza in banca` })
                db[senderJid].banca -= amount; db[senderJid].soldi += amount; saveDB(db)
                return sock.sendMessage(chatJid, { text: `✅ Prelevati ${amount}€` })
            }
            else if (lower.startsWith("/pay")) {
                let mentioned = m.message.extendedTextMessage?.contextInfo?.mentionedJid
                let targetJid = mentioned?.[0]; let amount = parseInt(lower.split(" ").pop())
                if (!targetJid || isNaN(amount) || amount <= 0) return sock.sendMessage(chatJid, { text: `Usa: /pay @persona 100` })
                if (db[senderJid].soldi < amount) return sock.sendMessage(chatJid, { text: `Non hai abbastanza soldi` })
                if (!db[targetJid]) db[targetJid] = { soldi: 0, banca: 0, lastMina: 0 }
                db[senderJid].soldi -= amount; db[targetJid].soldi += amount; saveDB(db)
                return sock.sendMessage(chatJid, { text: `✅ Pagati ${amount}€ a @${targetJid.split('@')[0]}`, mentions: [targetJid] })
            }
            else if (lower.startsWith("/slap")) {
                let mentioned = m.message.extendedTextMessage?.contextInfo?.mentionedJid
                let targetJid = mentioned?.[0]
                if (!targetJid) return sock.sendMessage(chatJid, { text: `Usa: /slap @persona` })
                if (targetJid === senderJid) return sock.sendMessage(chatJid, { text: `Non puoi schiaffeggiarti da solo 😂` })
                if (!db[targetJid]) db[targetJid] = { soldi: 0, banca: 0, lastMina: 0 }
                let isHidden = Math.random() < 0.4
                if (isHidden) {
                    db[targetJid].soldi = Math.max(0, db[targetJid].soldi - 50); saveDB(db)
                    await sock.sendMessage(chatJid, { text: `👋 @${senderJid.split('@')[0]} SCHIAFFONE a @${targetJid.split('@')[0]}! Nessuno ha visto 🤫 Dentista 50€ 😂🦷`, mentions: [senderJid, targetJid] })
                } else {
                    db[senderJid].soldi = Math.max(0, db[senderJid].soldi - 50); saveDB(db)
                    await sock.sendMessage(chatJid, { text: `👋 @${senderJid.split('@')[0]} beccato! POLIZIA 🚔 Multa 50€ 😂😂`, mentions: [senderJid, targetJid] })
                }
            }
        })
    } catch (e) { console.log('ERRORE AVVIO:', e) }
}

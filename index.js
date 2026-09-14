process.on('uncaughtException', e => console.log('CRASH:', e))
process.on('unhandledRejection', e => console.log('CRASH PROMISE:', e))

const express = require('express')
const app = express()
let latestQR = null
let botStatus = "AVVIO..."

app.get('/', (req, res) => res.send(`PAVE-BOT: ${botStatus} ✅ - Vai su /qr`))
app.get('/qr', (req, res) => {
    if (!latestQR) {
        return res.send(`<h1>${botStatus}</h1><p>QR non generato ancora - se sei connesso e in pausa, cancella la cartella auth su GitHub e fai Clear cache & Deploy su Render</p><p>Stato: ${botStatus}</p><script>setTimeout(()=>location.reload(),5000)</script>`)
    }
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(latestQR)}`
    res.send(`<h1>PAVE-BOT QR - SCANSIONA ORA</h1><h2>Stato: ${botStatus}</h2><img src="${qrUrl}" width=400><p>WhatsApp > Dispositivi collegati > Collega dispositivo</p><script>setTimeout(()=>location.reload(),20000)</script>`)
})

const PORT = process.env.PORT || 3000
app.listen(PORT, '0.0.0.0', () => { console.log(`WEB ON PORT ${PORT}`); startBot() })

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
        const { state, saveCreds } = await useMultiFileAuthState('./auth')
        const sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }) })
        sock.ev.on('creds.update', saveCreds)
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update
            if (qr) {
                latestQR = qr
                botStatus = "QR PRONTO - scansiona su /qr"
                console.log(`QR GENERATO - vai su /qr`)
                qrcode.generate(qr, { small: true })
            }
            if (connection === 'close') {
                botStatus = "DISCONNESSO"
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== 401
                if (shouldReconnect) {
                    botStatus = "RICONNESSIONE..."
                    setTimeout(startBot, 3000)
                } else {
                    botStatus = "SESSIONE SCADUTA - serve nuovo QR"
                }
            } else if (connection === 'open') {
                botStatus = "✅ CONNESSO"
                console.log(`✅ ${BOT_NAME} CONNESSO`)
            }
        })
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const m = messages[0]; if (!m.message || m.key.fromMe) return
            const chatJid = m.key.remoteJid; const senderJid = m.key.participant || m.key.remoteJid
            const text = m.message.conversation || m.message.extendedTextMessage?.text || ""; const lower = text.toLowerCase().trim()
            let db = loadDB(); if (!db[senderJid]) db[senderJid] = { soldi: 0, banca: 0, lastMina: 0 }
            let isBanned = false, bannedRemaining = 0
            if (chatJid.endsWith('@g.us') && senderJid!== OWNER_NUMBER) {
                const now = Date.now(); let userSpam = spamMap.get(senderJid) || { count: 0, lastTime: 0, bannedUntil: 0 }
                if (userSpam.bannedUntil > now) { isBanned = true; bannedRemaining = userSpam.bannedUntil - now; if (!lower.startsWith("/menu") &&!lower.startsWith("/help") && lower!== "/on" && lower!== "/off") return }
                else {
                    if (!lower.startsWith("/menu") &&!lower.startsWith("/help")) {
                        if (now - userSpam.lastTime < 2500) { userSpam.count++; if (userSpam.count >= 4) { userSpam.bannedUntil = now + BAN_TIME; userSpam.count = 0; spamMap.set(senderJid, userSpam); return await sock.sendMessage(chatJid, { text: `💀 @${senderJid.split('@')[0]} BANNATO 10 MIN`, mentions: [senderJid] }) } }
                        else userSpam.count = 1; userSpam.lastTime = now; spamMap.set(senderJid, userSpam)
                    }
                }
            }
            if (lower === "/on" || lower === "/off") { if (senderJid!== OWNER_NUMBER) return; isBotOn = lower === "/on"; return sock.sendMessage(chatJid, { text: isBotOn? `✅ ${BOT_NAME} ON` : `❌ ${BOT_NAME} OFF` }) }
            if (!isBotOn) return

            if (lower === "/menu" || lower === "/help") {
                let banText = ""; if (isBanned) { let min = Math.floor(bannedRemaining / 60000); let sec = Math.floor((bannedRemaining % 60000) / 1000); banText = `\n\n⛔ SEI BANNATO! ${min}m ${sec}s\n` }
                return sock.sendMessage(chatJid, {
                    text: `*🤖 ${BOT_NAME} MENU*${banText}\n\n*💰 TUOI SOLDI*\nMano: ${db[senderJid].soldi}€\nBanca: ${db[senderJid].banca}€\nTotale: ${db[senderJid].soldi + db[senderJid].banca}€\n\n*📜 COMANDI*\n/mina - 0-1000€ ogni 10 min\n/deposit [num]\n/pick [num]\n/slot [num] - es: /slot 100\n/slap @persona\n\n👑 /on /off solo owner`
                })
            }
            if (isBanned) return

            if (lower.startsWith("/mina")) { let now = Date.now(); if (now - db[senderJid].lastMina < 10 * 60 * 1000) { let sec = Math.ceil((10 * 60 * 1000 - (now - db[senderJid].lastMina)) / 1000); return sock.sendMessage(chatJid, { text: `⏳ ${Math.floor(sec/60)}m ${sec%60}s` }) } let guadagno = Math.floor(Math.random() * 1001); db[senderJid].soldi += guadagno; db[senderJid].lastMina = now; saveDB(db); return sock.sendMessage(chatJid, { text: `⛏️ Hai minato ${guadagno}€! /menu` }) }
            else if (lower.startsWith("/deposit")) { let amount = parseInt(lower.split(" ")[1]); if (isNaN(amount) || amount <= 0) return sock.sendMessage(chatJid, { text: `Usa: /deposit 100` }); if (db[senderJid].soldi < amount) return sock.sendMessage(chatJid, { text: `Non hai abbastanza` }); db[senderJid].soldi -= amount; db[senderJid].banca += amount; saveDB(db); return sock.sendMessage(chatJid, { text: `✅ Depositati ${amount}€` }) }
            else if (lower.startsWith("/pick")) { let amount = parseInt(lower.split(" ")[1]); if (isNaN(amount) || amount <= 0) return sock.sendMessage(chatJid, { text: `Usa: /pick 100` }); if (db[senderJid].banca < amount) return sock.sendMessage(chatJid, { text: `Non hai abbastanza in banca` }); db[senderJid].banca -= amount; db[senderJid].soldi += amount; saveDB(db); return sock.sendMessage(chatJid, { text: `✅ Prelevati ${amount}€` }) }
            else if (lower.startsWith("/slot")) {
                let amount = parseInt(lower.split(" ")[1]) || 100
                if (isNaN(amount) || amount <= 0) return sock.sendMessage(chatJid, { text: `Usa: /slot 100` })
                if (amount < 10) return sock.sendMessage(chatJid, { text: `Minimo 10€` })
                if (db[senderJid].soldi < amount) return sock.sendMessage(chatJid, { text: `Non hai ${amount}€, hai ${db[senderJid].soldi}€` })
                const symbols = ["🍒","🍋","🍊","🔔","💎","7️⃣"]
                const r1 = symbols[Math.floor(Math.random()*symbols.length)]
                const r2 = symbols[Math.floor(Math.random()*symbols.length)]
                const r3 = symbols[Math.floor(Math.random()*symbols.length)]
                let win = 0, msg = ""
                if (r1===r2 && r2===r3) { win = amount * 5; msg = `JACKPOT! 🎉 5x` }
                else if (r1===r2 || r2===r3 || r1===r3) { win = amount * 2; msg = `Vinto! 2x` }
                else { win = 0; msg = `Perso!` }
                db[senderJid].soldi -= amount; db[senderJid].soldi += win; saveDB(db)
                return sock.sendMessage(chatJid, { text: `*🎰 SLOT ${amount}€*\n| ${r1} | ${r2} | ${r3} |\n${msg}\n${win>0?`Vinto ${win}€`:`Perso ${amount}€`}\nSaldo: ${db[senderJid].soldi}€` })
            }
            else if (lower.startsWith("/slap")) { let mentioned = m.message.extendedTextMessage?.contextInfo?.mentionedJid; let targetJid = mentioned?.[0]; if (!targetJid) return sock.sendMessage(chatJid, { text: `Usa: /slap @persona` }); if (targetJid === senderJid) return sock.sendMessage(chatJid, { text: `Non puoi da solo` }); if (!db[targetJid]) db[targetJid] = { soldi: 0, banca: 0, lastMina: 0 }; let isHidden = Math.random() < 0.4; if (isHidden) { db[targetJid].soldi = Math.max(0, db[targetJid].soldi - 100); saveDB(db); await sock.sendMessage(chatJid, { text: `👋 @${senderJid.split('@')[0]} SCHIAFFONE a @${targetJid.split('@')[0]}! 🤫 Dentista 100€ 🦷`, mentions: [senderJid, targetJid] }) } else { db[senderJid].soldi = Math.max(0, db[senderJid].soldi - 50); saveDB(db); await sock.sendMessage(chatJid, { text: `👋 @${senderJid.split('@')[0]} beccato! 🚔 Multa 50€`, mentions: [senderJid, targetJid] }) } }
        })
    } catch (e) { console.log('ERRORE:', e) }
}

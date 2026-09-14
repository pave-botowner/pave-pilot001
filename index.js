const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys')
const pino = require('pino')
const fs = require('fs')
const express = require('express')
const qrcode = require('qrcode-terminal')

// WEB SERVER PER RENDER
const app = express()
app.get('/', (req, res) => res.send('Aura Bot Online ✅'))
app.listen(process.env.PORT || 3000, () => console.log('Web server ON'))

const OWNER_NUMBER = "393381532143@s.whatsapp.net"
let isBotOn = true
const spamMap = new Map()
const BAN_TIME = 10 * 60 * 1000

function loadDB() {
    if (!fs.existsSync('./db.json')) fs.writeFileSync('./db.json', JSON.stringify({}))
    return JSON.parse(fs.readFileSync('./db.json'))
}
function saveDB(db) {
    fs.writeFileSync('./db.json', JSON.stringify(db, null, 2))
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth')
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update

        // QUESTO ORA STAMPA IL QR NEI LOG DI RENDER
        if (qr) {
            console.log('QR CODE: Scansiona questo!')
            qrcode.generate(qr, { small: true })
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== 401
            if (shouldReconnect) startBot()
        } else if (connection === 'open') {
            console.log('✅ Bot connesso!')
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

        let isBanned = false
        let bannedRemaining = 0
        if (chatJid.endsWith('@g.us') && senderJid!== OWNER_NUMBER) {
            const now = Date.now()
            let userSpam = spamMap.get(senderJid) || { count: 0, lastTime: 0, bannedUntil: 0 }
            if (userSpam.bannedUntil > now) {
                isBanned = true
                bannedRemaining = userSpam.bannedUntil - now
                if (!lower.startsWith("/menu") &&!lower.startsWith("/help") && lower!== "/on" && lower!== "/off") return
            } else {
                if (!lower.startsWith("/menu") &&!lower.startsWith("/help")) {
                    if (now - userSpam.lastTime < 2500) {
                        userSpam.count++
                        if (userSpam.count >= 4) {
                            userSpam.bannedUntil = now + BAN_TIME
                            userSpam.count = 0
                            spamMap.set(senderJid, userSpam)
                            return await sock.sendMessage(chatJid, { text: `💀 @${senderJid.split('@')[0]} BANNATO 10 MIN PER SPAM\n\nPuoi usare solo /menu`, mentions: [senderJid] })
                        }
                    } else userSpam.count = 1
                    userSpam.lastTime = now
                    spamMap.set(senderJid, userSpam)
                }
            }
        }

        if (lower === "/on" || lower === "/off") {
            if (senderJid!== OWNER_NUMBER) return
            isBotOn = lower === "/on"
            return sock.sendMessage(chatJid, { text: isBotOn? `✅ Bot ON` : `❌ Bot OFF` })
        }
        if (!isBotOn) return

        if (lower === "/menu" || lower === "/help") {
            let banText = ""
            if (isBanned) {
                let min = Math.floor(bannedRemaining / 60000)
                let sec = Math.floor((bannedRemaining % 60000) / 1000)
                banText = `\n\n⛔ SEI BANNATO!\nTi mancano: ${min}m ${sec}s\n`
            }
            return sock.sendMessage(chatJid, { text: `*🤖 AURA BOT MENU*${banText}\n\n💰 /mina - 10min\n/soldi /banca /deposita /preleva /pay @persona\n\n😂 /slap @persona\n\n👑 /on /off` })
        }
        if (isBanned) return

        else if (lower.startsWith("/mina")) {
            let now = Date.now()
            if (now - db[senderJid].lastMina < 10 * 60 * 1000) {
                let sec = Math.ceil((10 * 60 * 1000 - (now - db[senderJid].lastMina)) / 1000)
                return sock.sendMessage(chatJid, { text: `⏳ Aspetta ${Math.floor(sec/60)}m ${sec%60}s` })
            }
            let guadagno = Math.floor(Math.random() * 100) + 50
            db[senderJid].soldi += guadagno
            db[senderJid].lastMina = now
            saveDB(db)
            return sock.sendMessage(chatJid, { text: `⛏️ Hai minato ${guadagno}€!` })
        }
        else if (lower === "/soldi") return sock.sendMessage(chatJid, { text: `💰 ${db[senderJid].soldi}€ mano, ${db[senderJid].banca}€ banca` })
        else if (lower === "/banca") return sock.sendMessage(chatJid, { text: `🏦 ${db[senderJid].banca}€` })
        else if (lower.startsWith("/deposita")) {
            let amount = parseInt(lower.split(" ")[1])
            if (isNaN(amount) || db[senderJid].soldi < amount) return
            db[senderJid].soldi -= amount; db[senderJid].banca += amount; saveDB(db)
            return sock.sendMessage(chatJid, { text: `Depositati ${amount}€` })
        }
        else if (lower.startsWith("/preleva")) {
            let amount = parseInt(lower.split(" ")[1])
            if (isNaN(amount) || db[senderJid].banca < amount) return
            db[senderJid].banca -= amount; db[senderJid].soldi += amount; saveDB(db)
            return sock.sendMessage(chatJid, { text: `Prelevati ${amount}€` })
        }
        else if (lower.startsWith("/pay")) {
            let mentioned = m.message.extendedTextMessage?.contextInfo?.mentionedJid
            let targetJid = mentioned?.[0]; let amount = parseInt(lower.split(" ").pop())
            if (!targetJid || isNaN(amount) || db[senderJid].soldi < amount) return
            if (!db[targetJid]) db[targetJid] = { soldi: 0, banca: 0, lastMina: 0 }
            db[senderJid].soldi -= amount; db[targetJid].soldi += amount; saveDB(db)
            return sock.sendMessage(chatJid, { text: `Pagati ${amount}€ a @${targetJid.split('@')[0]}`, mentions: [targetJid] })
        }
        else if (lower.startsWith("/slap")) {
            let mentioned = m.message.extendedTextMessage?.contextInfo?.mentionedJid
            let targetJid = mentioned?.[0]
            if (!targetJid) return sock.sendMessage(chatJid, { text: `Usa: /slap @persona` })
            if (targetJid === senderJid) return sock.sendMessage(chatJid, { text: `Non puoi da solo 😂` })
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
}

startBot()

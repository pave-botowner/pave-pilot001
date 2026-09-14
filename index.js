const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys')
const pino = require('pino')
const fs = require('fs')

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
        printQRInTerminal: true
    })

    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', (u) => { if (u.connection === 'close') startBot() })

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
                if (!lower.startsWith("/menu") &&!lower.startsWith("/help") && lower!== "/on" && lower!== "/off") {
                    return
                }
            } else {
                if (!lower.startsWith("/menu") &&!lower.startsWith("/help")) {
                    if (now - userSpam.lastTime < 2500) {
                        userSpam.count++
                        if (userSpam.count >= 4) {
                            userSpam.bannedUntil = now + BAN_TIME
                            userSpam.count = 0
                            spamMap.set(senderJid, userSpam)
                            return await sock.sendMessage(chatJid, {
                                text: `💀 @${senderJid.split('@')[0]} BANNATO 10 MIN PER SPAM\n\nPuoi usare solo /menu per vedere quanto manca`,
                                mentions: [senderJid]
                            })
                        }
                    } else {
                        userSpam.count = 1
                    }
                    userSpam.lastTime = now
                    spamMap.set(senderJid, userSpam)
                }
            }
        }

        if (lower === "/on" || lower === "/off") {
            if (senderJid!== OWNER_NUMBER) return sock.sendMessage(chatJid, { text: `Solo il boss @${OWNER_NUMBER.split('@')[0]} può farlo 😎`, mentions: [OWNER_NUMBER] })
            isBotOn = lower === "/on"
            return sock.sendMessage(chatJid, { text: isBotOn? `✅ Bot ON` : `❌ Bot OFF` })
        }

        if (!isBotOn) return

        if (lower === "/menu" || lower === "/help") {
            let banText = ""
            if (isBanned) {
                let min = Math.floor(bannedRemaining / 60000)
                let sec = Math.floor((bannedRemaining % 60000) / 1000)
                banText = `\n\n⛔ SEI BANNATO!\nTi mancano: ${min}m ${sec}s\nPuoi usare SOLO questo comando fino allo sblocco.\n`
            }
            return sock.sendMessage(chatJid, {
                text: `*🤖 AURA BOT MENU*${banText}\n\n💰 ECONOMIA\n/mina - ogni 10 min\n/soldi - vedi soldi\n/banca - vedi banca\n/deposita [num]\n/preleva [num]\n/pay @persona [num]\n\n😂 FUN\n/slap @persona - 40% vince / 60% multa\n\n👑 OWNER\n/on - accende\n/off - spegne`
            })
        }

        if (isBanned) return

        else if (lower.startsWith("/mina")) {
            let now = Date.now()
            if (now - db[senderJid].lastMina < 10 * 60 * 1000) {
                let sec = Math.ceil((10 * 60 * 1000 - (now - db[senderJid].lastMina)) / 1000)
                let min = Math.floor(sec / 60)
                let restoSec = sec % 60
                return sock.sendMessage(chatJid, { text: `⏳ Devi aspettare ancora ${min}m ${restoSec}s per minare!` })
            }
            let guadagno = Math.floor(Math.random() * 100) + 50
            db[senderJid].soldi += guadagno
            db[senderJid].lastMina = now
            saveDB(db)
            return sock.sendMessage(chatJid, { text: `⛏️ Hai minato ${guadagno}€! Torna tra 10 min` })
        }
        else if (lower === "/soldi" || lower === "/bal") {
            return sock.sendMessage(chatJid, { text: `💰 Hai ${db[senderJid].soldi}€ in mano e ${db[senderJid].banca}€ in banca` })
        }
        else if (lower === "/banca") {
            return sock.sendMessage(chatJid, { text: `🏦 Banca: ${db[senderJid].banca}€` })
        }
        else if (lower.startsWith("/deposita")) {
            let amount = parseInt(lower.split(" ")[1])
            if (isNaN(amount) || amount <= 0) return sock.sendMessage(chatJid, { text: `Metti un numero valido` })
            if (db[senderJid].soldi < amount) return sock.sendMessage(chatJid, { text: `Non hai abbastanza soldi` })
            db[senderJid].soldi -= amount
            db[senderJid].banca += amount
            saveDB(db)
            return sock.sendMessage(chatJid, { text: `Depositati ${amount}€` })
        }
        else if (lower.startsWith("/preleva")) {
            let amount = parseInt(lower.split(" ")[1])
            if (isNaN(amount) || amount <= 0) return sock.sendMessage(chatJid, { text: `Metti un numero valido` })
            if (db[senderJid].banca < amount) return sock.sendMessage(chatJid, { text: `Non hai abbastanza in banca` })
            db[senderJid].banca -= amount
            db[senderJid].soldi += amount
            saveDB(db)
            return sock.sendMessage(chatJid, { text: `Prelevati ${amount}€` })
        }
        else if (lower.startsWith("/pay")) {
            let mentioned = m.message.extendedTextMessage?.contextInfo?.mentionedJid
            let targetJid = mentioned && mentioned[0]? mentioned[0] : null
            let amount = parseInt(lower.split(" ").pop())
            if (!targetJid || isNaN(amount)) return sock.sendMessage(chatJid, { text: `Usa: /pay @persona 100` })
            if (db[senderJid].soldi < amount) return sock.sendMessage(chatJid, { text: `Non hai abbastanza soldi` })
            if (!db[targetJid]) db[targetJid] = { soldi: 0, banca: 0, lastMina: 0 }
            db[senderJid].soldi -= amount
            db[targetJid].soldi += amount
            saveDB(db)
            return sock.sendMessage(chatJid, { text: `Hai pagato ${amount}€ a @${targetJid.split('@')[0]}`, mentions: [targetJid] })
        }
        else if (lower.startsWith("/slap")) {
            let mentioned = m.message.extendedTextMessage?.contextInfo?.mentionedJid
            let targetJid = mentioned && mentioned[0]? mentioned[0] : null
            if (!targetJid) return sock.sendMessage(chatJid, { text: `Usa: /slap @persona` })
            if (targetJid === senderJid) return sock.sendMessage(chatJid, { text: `Non puoi schiaffeggiarti da solo scemo 😂` })
            if (!db[targetJid]) db[targetJid] = { soldi: 0, banca: 0, lastMina: 0 }
            let targetName = targetJid.split('@')[0]
            let isHidden = Math.random() < 0.4
            if (isHidden) {
                db[targetJid].soldi = Math.max(0, db[targetJid].soldi - 50)
                saveDB(db)
                await sock.sendMessage(chatJid, {
                    text: `👋 @${senderJid.split('@')[0]} ha tirato uno SCHIAFFONE a @${targetName}!\n\nNessuno ha visto nulla 🤫\n@${targetName} deve pagare 50€ dal dentista 😂🦷`,
                    mentions: [senderJid, targetJid]
                })
            } else {
                db[senderJid].soldi = Math.max(0, db[senderJid].soldi - 50)
                saveDB(db)
                await sock.sendMessage(chatJid, {
                    text: `👋 @${senderJid.split('@')[0]} ha provato a schiaffeggiare @${targetName}!\n\nMa la POLIZIA ti ha visto! 🚔👮‍♂️\nMulta di 50€ per @${senderJid.split('@')[0]} 😂😂😂`,
                    mentions: [senderJid, targetJid]
                })
            }
        }
    })
}

startBot()

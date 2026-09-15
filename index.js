process.on('uncaughtException', e => console.log('CRASH:', e))
process.on('unhandledRejection', e => console.log('CRASH PROMISE:', e))

const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys')
const pino = require('pino')
const fs = require('fs')
const express = require('express')

const app = express()
app.get('/', (req,res)=>res.send('PAVE-BOT ON - ' + new Date().toISOString()))
const PORT = process.env.PORT || 3000
app.listen(PORT, '0.0.0.0', ()=>console.log('WEB SERVER ON PORT ' + PORT))

const BOT_NAME = "PAVE-BOT"
const OWNER_ID = "393381532143"
let isBotOn = true
const spamMap = new Map()
const BAN_TIME = 10 * 60 * 1000

function loadDB() {
    try {
        if (!fs.existsSync('./auth')) fs.mkdirSync('./auth', { recursive: true })
        if (!fs.existsSync('./auth/db.json')) fs.writeFileSync('./auth/db.json', JSON.stringify({}))
        let data = JSON.parse(fs.readFileSync('./auth/db.json'))
        for (let k in data) {
            if (data[k].taxed === undefined) data[k].taxed = false
            if (data[k].taxRate === undefined) data[k].taxRate = 10
        }
        return data
    } catch(e) { return {} }
}
function saveDB(db) { try { fs.writeFileSync('./auth/db.json', JSON.stringify(db, null, 2)) } catch(e) {} }

function getNetto(db, jid, lordo) {
    if (!db[jid] ||!db[jid].taxed) return lordo
    let rate = db[jid].taxRate || 10
    return lordo - Math.floor(lordo * rate / 100)
}

async function startBot() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('./auth')
        const sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }) })
        sock.ev.on('creds.update', saveCreds)
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update
            if (qr) {
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qr)}`
                console.log(`\n\n📸 QR LINK: ${qrUrl}\n\n`)
            }
            if (connection === 'close') {
                if (lastDisconnect?.error?.output?.statusCode!== 401) setTimeout(startBot, 3000)
            } else if (connection === 'open') { console.log(`✅ ${BOT_NAME} CONNESSO`) }
        })
        sock.ev.on('messages.upsert', async ({ messages }) => {
            try {
                const m = messages[0]; if (!m.message) return
                const chatJid = m.key.remoteJid; const senderJid = m.key.participant || m.key.remoteJid
                const text = m.message.conversation || m.message.extendedTextMessage?.text || ""; const lower = text.toLowerCase().trim()
                const isOwner = senderJid.includes(OWNER_ID) || chatJid.includes(OWNER_ID) || m.key.fromMe
                const mentioned = m.message.extendedTextMessage?.contextInfo?.mentionedJid
                const targetJid = mentioned?.[0]

                let db = loadDB()
                if (!db[senderJid]) db[senderJid] = { soldi: 0, banca: 0, lastMina: 0, taxed: false, taxRate: 10 }
                if (targetJid &&!db[targetJid]) db[targetJid] = { soldi: 0, banca: 0, lastMina: 0, taxed: false, taxRate: 10 }

                let isBanned = false, bannedRemaining = 0
                if (chatJid.endsWith('@g.us') &&!isOwner) {
                    const now = Date.now(); let userSpam = spamMap.get(senderJid) || { count: 0, lastTime: 0, bannedUntil: 0 }
                    if (userSpam.bannedUntil > now) { isBanned = true; bannedRemaining = userSpam.bannedUntil - now; if (!lower.startsWith("/menu") &&!lower.startsWith("/help") &&!lower.startsWith("/admenu") && lower!== "/on" && lower!== "/off") return }
                    else {
                        if (!lower.startsWith("/menu") &&!lower.startsWith("/help") &&!lower.startsWith("/admenu")) {
                            if (now - userSpam.lastTime < 2500) { userSpam.count++; if (userSpam.count >= 4) { userSpam.bannedUntil = now + BAN_TIME; userSpam.count = 0; spamMap.set(senderJid, userSpam); return await sock.sendMessage(chatJid, { text: `💀 @${senderJid.split('@')[0]} BANNATO 10 MIN`, mentions: [senderJid] }) } }
                            else userSpam.count = 1; userSpam.lastTime = now; spamMap.set(senderJid, userSpam)
                        }
                    }
                }

                if (lower === "/on" || lower === "/off") {
                    if (!isOwner) return sock.sendMessage(chatJid, { text: `❌ Solo owner` })
                    isBotOn = lower === "/on"; return sock.sendMessage(chatJid, { text: isBotOn? `✅ ${BOT_NAME} ON` : `❌ ${BOT_NAME} OFF` })
                }
                if (!isBotOn) return

                if (lower === "/menu" || lower === "/help") {
                    let banText = ""; if (isBanned) { let min = Math.floor(bannedRemaining / 60000); let sec = Math.floor((bannedRemaining % 60000) / 1000); banText = `\n\n⛔ SEI BANNATO! ${min}m ${sec}s\n` }
                    let taxInfo = db[senderJid].taxed? `\n⚠️ TASSATO ${db[senderJid].taxRate}% SU TUTTO` : ""
                    return sock.sendMessage(chatJid, { text: `*🤖 ${BOT_NAME} MENU*${banText}${taxInfo}\n\n*💰 TUOI SOLDI*\nMano: ${db[senderJid].soldi}€\nBanca: ${db[senderJid].banca}€\nTotale: ${db[senderJid].soldi + db[senderJid].banca}€\n\n*📜 COMANDI*\n/mina\n/deposit\n/pick\n/slot\n/slap @\n/bow @\n/wob @\n/kiss @\n\n👑 /on /off /admenu /tax /untax` })
                }
                if (lower.startsWith("/admenu")) {
                    if (!isOwner) return sock.sendMessage(chatJid, { text: `❌ Solo owner` })
                    let taxedList = Object.keys(db).filter(k=>db[k].taxed).map(k=>`@${k.split('@')[0]} - ${db[k].taxRate}%`).join('\n') || "Nessuno"
                    return sock.sendMessage(chatJid, { text: `*👑 ADMENU*\n\nBOT: ${isBotOn?'ON':'OFF'}\n\n*COMANDI*\n/tax @ [10]\n/untax @\n/untax (tutti)\n/retax @\n/spawngive @ [num]\n\n*💀 TASSATI 10% SU TUTTO:*\n${taxedList}` })
                }
                if (isBanned) return

                if (lower.startsWith("/mina")) {
                    let now = Date.now()
                    if (now - db[senderJid].lastMina < 600000) {
                        let sec = Math.ceil((600000 - (now - db[senderJid].lastMina)) / 1000)
                        return sock.sendMessage(chatJid, { text: `⏳ ${Math.floor(sec/60)}m ${sec%60}s` })
                    }
                    let lordo = Math.floor(Math.random() * 1001)
                    let netto = getNetto(db, senderJid, lordo)
                    db[senderJid].soldi += netto; db[senderJid].lastMina = now; saveDB(db)
                    if (lordo!==netto) return sock.sendMessage(chatJid, { text: `⛏️ Hai minato ${lordo}€ -> ${netto}€! Tassa ${db[senderJid].taxRate}% -${lordo-netto}€` })
                    return sock.sendMessage(chatJid, { text: `⛏️ Hai minato ${netto}€!` })
                }
                else if (lower.startsWith("/deposit")) { let amount = parseInt(lower.split(" ")[1]); if (isNaN(amount) || amount <= 0) return sock.sendMessage(chatJid, { text: `Usa: /deposit 100` }); if (db[senderJid].soldi < amount) return sock.sendMessage(chatJid, { text: `Non hai abbastanza` }); db[senderJid].soldi -= amount; db[senderJid].banca += amount; saveDB(db); return sock.sendMessage(chatJid, { text: `✅ Depositati ${amount}€` }) }
                else if (lower.startsWith("/pick")) { let amount = parseInt(lower.split(" ")[1]); if (isNaN(amount) || amount <= 0) return sock.sendMessage(chatJid, { text: `Usa: /pick 100` }); if (db[senderJid].banca < amount) return sock.sendMessage(chatJid, { text: `Non hai abbastanza` }); db[senderJid].banca -= amount; db[senderJid].soldi += amount; saveDB(db); return sock.sendMessage(chatJid, { text: `✅ Prelevati ${amount}€` }) }
                else if (lower.startsWith("/slot")) {
                    let amount = parseInt(lower.split(" ")[1]) || 100
                    if (amount < 10) return sock.sendMessage(chatJid, { text: `Minimo 10€` })
                    if (db[senderJid].soldi < amount) return sock.sendMessage(chatJid, { text: `Non hai ${amount}€` })
                    const symbols = ["🍒","🍋","🍊","🔔","💎","7️⃣"]
                    const r1 = symbols[Math.floor(Math.random()*symbols.length)]; const r2 = symbols[Math.floor(Math.random()*symbols.length)]; const r3 = symbols[Math.floor(Math.random()*symbols.length)]
                    let winLordo = 0, msg = ""
                    if (r1===r2 && r2===r3) { winLordo = amount * 5; msg = `JACKPOT! 🎉 5x` } else if (r1===r2 || r2===r3 || r1===r3) { winLordo = amount * 2; msg = `Vinto! 2x` } else { winLordo = 0; msg = `Perso!` }
                    let winNetto = winLordo===0?0:getNetto(db, senderJid, winLordo)
                    db[senderJid].soldi -= amount; db[senderJid].soldi += winNetto; saveDB(db)
                    let taxText = winLordo!==winNetto? ` (Tassa -${winLordo-winNetto}€)` : ""
                    return sock.sendMessage(chatJid, { text: `*🎰 SLOT ${amount}€*\n| ${r1} | ${r2} | ${r3} |\n${msg}${taxText}\n${winNetto>0?`Vinto ${winNetto}€`:`Perso ${amount}€`}\nSaldo: ${db[senderJid].soldi}€` })
                }
                else if (lower.startsWith("/slap")) { if (!targetJid) return sock.sendMessage(chatJid, { text: `Usa: /slap @` }); if (targetJid === senderJid) return sock.sendMessage(chatJid, { text: `Non puoi da solo` }); let isHidden = Math.random() < 0.4; if (isHidden) { db[targetJid].soldi = Math.max(0, db[targetJid].soldi - 100); saveDB(db); await sock.sendMessage(chatJid, { text: `👋 @${senderJid.split('@')[0]} SCHIAFFONE a @${targetJid.split('@')[0]}! 🤫 Dentista 100€ 🦷`, mentions: [senderJid, targetJid] }) } else { db[senderJid].soldi = Math.max(0, db[senderJid].soldi - 50); saveDB(db); await sock.sendMessage(chatJid, { text: `👋 @${senderJid.split('@')[0]} beccato! 🚔 Multa 50€`, mentions: [senderJid, targetJid] }) } }
                else if (lower.startsWith("/bow")) { if (!targetJid) return sock.sendMessage(chatJid, { text: `Usa: /bow @` }); return sock.sendMessage(chatJid, { text: `🙇 @${senderJid.split('@')[0]} si inchina a @${targetJid.split('@')[0]} 👑`, mentions: [senderJid, targetJid] }) }
                else if (lower.startsWith("/wob")) { if (!targetJid) return sock.sendMessage(chatJid, { text: `Usa: /wob @` }); return sock.sendMessage(chatJid, { text: `🍑 @${senderJid.split('@')[0]} twerka su @${targetJid.split('@')[0]} 💦`, mentions: [senderJid, targetJid] }) }
                else if (lower.startsWith("/kiss")) { if (!targetJid) return sock.sendMessage(chatJid, { text: `Usa: /kiss @` }); return sock.sendMessage(chatJid, { text: `😘 @${senderJid.split('@')[0]} bacia @${targetJid.split('@')[0]} ❤️`, mentions: [senderJid, targetJid] }) }
                else if (lower.startsWith("/tax")) {
                    if (!isOwner) return sock.sendMessage(chatJid, { text: `❌ Solo owner` })
                    if (!targetJid) return sock.sendMessage(chatJid, { text: `Usa: /tax @persona [10]\nDefault 10% su TUTTO` })
                    let args = lower.split(" "); let rate = parseInt(args[2]) || 10
                    if (rate < 1 || rate > 100) rate = 10
                    db[targetJid].taxed = true; db[targetJid].taxRate = rate; saveDB(db)
                    return sock.sendMessage(chatJid, { text: `💀 @${targetJid.split('@')[0]} TASSATO ${rate}% SU TUTTO!`, mentions: [targetJid] })
                }
                else if (lower.startsWith("/retax")) {
                    if (!isOwner) return sock.sendMessage(chatJid, { text: `❌ Solo owner` })
                    if (!targetJid) return sock.sendMessage(chatJid, { text: `Usa: /retax @` })
                    let rate = parseInt(lower.split(" ")[2]) || db[targetJid]?.taxRate || 10
                    db[targetJid].taxed = true; db[targetJid].taxRate = rate; saveDB(db)
                    return sock.sendMessage(chatJid, { text: `🔄 @${targetJid.split('@')[0]} RI-TASSATO ${rate}%!`, mentions: [targetJid] })
                }
                else if (lower.startsWith("/untax")) {
                    if (!isOwner) return sock.sendMessage(chatJid, { text: `❌ Solo owner` })
                    if (!targetJid) {
                        if (lower.trim() === "/untax") {
                            let count = 0; for (let k in db) if (db[k].taxed) { db[k].taxed = false; count++ }
                            saveDB(db); return sock.sendMessage(chatJid, { text: `✅ Tolte tasse a ${count} utenti` })
                        }
                        return sock.sendMessage(chatJid, { text: `Usa: /untax @ o /untax per tutti` })
                    }
                    db[targetJid].taxed = false; saveDB(db)
                    return sock.sendMessage(chatJid, { text: `✅ @${targetJid.split('@')[0]} non più tassato`, mentions: [targetJid] })
                }
                else if (lower.startsWith("/spawngive")) {
                    if (!isOwner) return sock.sendMessage(chatJid, { text: `❌ Solo owner` })
                    if (!targetJid) return sock.sendMessage(chatJid, { text: `Usa: /spawngive @ 1000` })
                    let amount = parseInt(lower.split(" ")[2]) || parseInt(lower.split(" ")[1]); if (isNaN(amount)) return sock.sendMessage(chatJid, { text: `Usa: /spawngive @ 1000` })
                    db[targetJid].soldi += amount; saveDB(db)
                    return sock.sendMessage(chatJid, { text: `💸 Spawnati ${amount}€ a @${targetJid.split('@')[0]}!`, mentions: [targetJid] })
                }

            } catch(err) { console.log('MSG ERROR:', err) }
        })
    } catch (e) { console.log('ERRORE AVVIO:', e); setTimeout(startBot, 5000) }
}
startBot()

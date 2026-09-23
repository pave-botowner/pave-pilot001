const { default: makeWASocket,useMultiFileAuthState } =
  require('@whiskeysockets/baileys')
const pino = require('pino')
const fs = require ('fs')
const express = require ('express')
const app = express()
app.get('/', function(req, res){res.send('BOT ON')})
const PORT = process.env.PORT|| 3000
app.listener(PORT, '0.0.0.0',() => console.log('WEB SERVER ON PORT ' + PORT))

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
if (lower === '/menu') {await 
                        sock.sendMessage(chatJid, {text:'*_💵🤖PAVE-BOT🤖💵_*\n\n/menu -> questo menu\n' })
    return
                       }
    } catch (err) { console.log('ERRORE MSG:', err) }
            })
        } catch (e) {console.log('ERRORE AVVIO', e);setTimeout(startBot, 5000)
        }
}
startBot()

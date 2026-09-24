const { default: makeWASocket,useMultiFileAuthState, initAuthState, initAuthCreds, BufferJSON  } =
  require('@whiskeysockets/baileys')
const pino = require('pino')
const fs = require ('fs')
const express = require ('express')
const app = express()
app.get('/', function(req, res){res.send('BOT ON')})
const PORT = process.env.PORT|| 3000
app.listen(PORT, '0.0.0.0',() => console.log('WEB SERVER ON PORT ' + PORT))
const mongoose = require('mongoose')
const BOT_NAME = "PAVE-BOT"
mongoose.connect(process.env.MONGODB.URI).then(() => {
  console.log('mongodb connesso')
const OWNER_ID = "393381532143"
let isBotOn = true
const spamMap = new Map()
const BAN_TIME = 10 * 60 * 1000

async function startBot() {
    try {
const col=mongoose.connection.db.collection('auth')
      const w=(d,i)=>col.replaceOne({_id:i},{_id:i,data:JSON.stringify(d,BufferJSON.replacer)},{upsert:true})
      const r=async i=>{let x=await col.findOne({_id:i});return x?
        JSON.parse(x.data,BufferJSON.reviver):null}
      let creds=await r('creds')||initAuthCreds()
      let keys={}
      const saveCreds=async()=>{await w(creds, 'creds')}
      const state={creds, keys:{get:async(t, ids)=>{let o={};for(let i of ids){let k= '${t}-${i}';
     if(keys[k]) o[i]=keys[k];else{let d=await r(k);if(d) {keys[k]=d;o[i]=d}}}return o},set:async(d)=>{for(let c in d) 
      {for(let i in d[c]) {let k= '${c}-${i}';keys[k]=d[c][i];await w (d[c][i],k)}}
                                                                                                                                                saveCreds()}}}
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
           setInterval(() => {
        sock.sendPresenceUpdate('available')
        console.log('keepaliveping')
      }, 4 * 60 * 1000)
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

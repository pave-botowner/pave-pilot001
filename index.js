const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys")
const express = require("express")
const qrcode = require("qrcode")
const app = express()
let latestQR = null
let isConnected = false

app.get("/", async (req,res)=>{
  if(isConnected) return res.send("<h1>BAD-BOT ATTIVO ✅</h1>")
  if(latestQR){
    const img = await qrcode.toDataURL(latestQR)
    return res.send(`<h1>SCANSIONA</h1><img src="${img}" width="300"><script>setTimeout(()=>location.reload(),10000)</script>`)
  }
  res.send("<h1>Avvio BAD-BOT...</h1><script>setTimeout(()=>location.reload(),3000)</script>")
})

async function start(){
  const { state, saveCreds } = await useMultiFileAuthState("auth")
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    browser: ["BAD-BOT","Chrome","1.0"]
  })
  sock.ev.on("creds.update", saveCreds)
  sock.ev.on("connection.update", async (u)=>{
    const { connection, lastDisconnect, qr } = u
    if(qr){ latestQR = qr; isConnected=false }
    if(connection==="open"){ latestQR=null; isConnected=true; console.log("CONNESSO") }
    if(connection==="close" && lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut) start()
  })
  sock.ev.on("messages.upsert", async ({messages})=>{
    const m = messages[0]
    if(!m.message || m.key.fromMe) return
    const from = m.key.remoteJid
    const text = (m.message.conversation || m.message.extendedTextMessage?.text || "").toLowerCase().trim()

    if(text.startsWith("/menu")) await sock.sendMessage(from,{text:"*BAD-BOT MENU*\n/fanm\n/utym\n/carm\n/slotm\n/cars\n/slots\n/luck\n/aura\n/stick"})
    if(text.startsWith("/fanm")) await sock.sendMessage(from,{text:"*FANM* attiva ✅"})
    if(text.startsWith("/utym")) await sock.sendMessage(from,{text:"*UTYM MENU*\n/stick - foto a sticker\n/finall - tagga tutti\n/mtacc"})
    if(text.startsWith("/carm")) await sock.sendMessage(from,{text:"*CARM*\n/cars - garage\n/carshop - compra\n/buycar Z98CAR"})
    if(text.startsWith("/slotm")) {
      let win = Math.random()>0.5
      await sock.sendMessage(from,{text: win? "🎰 HAI VINTO 100!" : "🎰 Perso, riprova /slotm"})
    }
  })
}
start()
app.listen(process.env.PORT||10000)

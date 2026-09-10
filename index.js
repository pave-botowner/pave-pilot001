const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys")
const express = require("express")
const qrcode = require("qrcode")
const app = express()
let latestQR = null
let isConnected = false

app.get("/", async (req,res)=>{
  if(isConnected) return res.send("<h1>BAD-BOT ATTIVO ✅<br>Ora puoi scrivere dal tuo numero!</h1>")
  if(latestQR){
    const img = await qrcode.toDataURL(latestQR)
    return res.send(`<h1>SCANSIONA QR</h1><img src="${img}" width="300"><script>setTimeout(()=>location.reload(),8000)</script>`)
  }
  res.send("<h1>Avvio...</h1><script>setTimeout(()=>location.reload(),3000)</script>")
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
    if(connection==="open"){ latestQR=null; isConnected=true; console.log("CONNESSO - self abilitato") }
    if(connection==="close" && lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut) start()
  })

  sock.ev.on("messages.upsert", async ({messages})=>{
    const m = messages[0]
    if(!m.message) return

    const from = m.key.remoteJid
    const text = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").toLowerCase().trim()

    console.log("MSG:", text, "| fromMe:", m.key.fromMe, "| from:", from)

    if(!text.startsWith("/")) return

    if(text.startsWith("/menu")){
      await sock.sendMessage(from,{text:"*BAD-BOT MENU* 👑\n\n/fanm - famiglia\n/utym - utility\n/carm - auto menu\n/slotm - slot machine\n/cars - garage\n/slots - lista slot\n/luck - fortuna\n/aura - aura\n/stick - sticker"})
    }
    if(text.startsWith("/fanm")) await sock.sendMessage(from,{text:"*FANM* attiva ✅\nComandi famiglia pronti"})
    if(text.startsWith("/utym")) await sock.sendMessage(from,{text:"*UTYM MENU* ⚙️\n/stick - foto > sticker\n/finall - tagga tutti\n/mtacc"})
    if(text.startsWith("/carm")) await sock.sendMessage(from,{text:"*CARM* 🚗\n/cars - garage\n/carshop - compra auto\n/buycar Z98CAR - compra"})
    if(text.startsWith("/slotm")){
      let win = Math.random()>0.45
      await sock.sendMessage(from,{text: win? "🎰 *JACKPOT!* HAI VINTO 100€!\n/slotm per rigiocare" : "🎰 Perso... ritenta /slotm"})
    }
    if(text.startsWith("/cars")) await sock.sendMessage(from,{text:"*GARAGE* 🚙\nNon hai auto - usa /carshop"})
    if(text.startsWith("/stick") && m.message.imageMessage){
      await sock.sendMessage(from,{text:"Sticker creato ✅ (funzione in arrivo)"})
    }
  })
}
start()
app.listen(process.env.PORT||10000, ()=>console.log("Server on"))

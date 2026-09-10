const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys")
const express = require("express")
const qrcode = require("qrcode")

const app = express()
let latestQR = null
let isConnected = false

app.get("/", async (req, res) => {
  if (isConnected) {
    res.send("<h1>PAVE PILOT ONLINE ✅</h1><p>Scrivi /menu su WhatsApp</p>")
  } else if (latestQR) {
    const qrImg = await qrcode.toDataURL(latestQR)
    res.send(`<h1>QR PAVE PILOT</h1><img src="${qrImg}" width="300"><p>WhatsApp > Dispositivi collegati</p><script>setTimeout(()=>location.reload(),15000)</script>`)
  } else {
    res.send("<h1>Avvio... ricarica</h1><script>setTimeout(()=>location.reload(),5000)</script>")
  }
})

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth")
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    browser: ["Pave Pilot", "Chrome", "1.0"]
  })

  sock.ev.on("creds.update", saveCreds)
  sock.ev.on("connection.update", async (u) => {
    const { connection, lastDisconnect, qr } = u
    if (qr) { latestQR = qr; isConnected = false }
    if (connection === "open") { latestQR = null; isConnected = true; console.log("✅ CONNESSO!") }
    if (connection === "close") {
      isConnected = false
      if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot()
    }
  })

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const m = messages[0]
    if (!m.message || m.key.fromMe) return
    const from = m.key.remoteJid
    const raw = (m.message.conversation || m.message.extendedTextMessage?.text || "").trim()
    const text = raw.toLowerCase()

    // MENU
    if (text === "menu" || text === "/menu" || text === ".menu") {
      await sock.sendMessage(from, { text: 
`*🤖 PAVE PILOT - MENU*

📐 *CALCOLI*
/pave 100 5 0.08 - calcola asfalto
Es: lunghezza larghezza spessore

📋 *INFO*
/info - info azienda
/listino - prezzi
/ping - test bot

Scrivi un comando!` })
    }

    // PAVE
    if (text.startsWith("/pave")) {
      let args = raw.split(" ")
      if (args.length < 4) {
        await sock.sendMessage(from, { text: "❌ Usa: /pave 100 5 0.08\n100m lunghezza, 5m larghezza, 8cm spessore" })
        return
      }
      let L = parseFloat(args[1]), W = parseFloat(args[2]), H = parseFloat(args[3])
      let mq = L * W
      let mc = mq * H
      let ton = mc * 2.4
      let costo = ton * 95 // 95€ a tonnellata esempio
      await sock.sendMessage(from, { text: `*📐 CALCOLO PAVE PILOT*\n\n📏 Lunghezza: ${L}m\n📏 Larghezza: ${W}m\n📏 Spessore: ${H}m\n\n🔹 Superficie: ${mq.toFixed(2)} mq\n🔹 Volume: ${mc.toFixed(2)} mc\n🔹 Peso: ${ton.toFixed(2)} ton\n\n💰 Stima costo: ~${costo.toFixed(0)}€ (95€/ton)\n\nScrivi /listino per prezzi precisi` })
    }

    // INFO
    if (text === "/info") {
      await sock.sendMessage(from, { text: `*ℹ️ PAVE PILOT*\n\nAzienda pavimentazioni stradali\n📍 Novara, Piemonte\n\nServizi:\n- Asfaltature\n- Fresature\n- Segnaletica\n\nScrivi /menu` })
    }

    // LISTINO
    if (text === "/listino") {
      await sock.sendMessage(from, { text: `*📋 LISTINO PAVE PILOT*\n\nBINDER 0-20: 90€/ton\nUSURA 0-10: 95€/ton\nTAPPETO DRENANTE: 110€/ton\n\nFRESATURA: 4€/mq\nTRASPORTO: da concordare\n\n*Prezzi IVA esclusa*` })
    }

    // PING
    if (text === "/ping") {
      await sock.sendMessage(from, { text: "🏓 Pong! Bot online al 100% ✅\nLatenza: 0.2s" })
    }
  })
}

startBot()
app.listen(10000, () => console.log("Web attiva"))

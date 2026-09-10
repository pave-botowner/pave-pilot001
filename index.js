const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require("@whiskeysockets/baileys")
const express = require("express")
const qrcode = require("qrcode")
const fs = require("fs")
const { Sticker, StickerTypes } = require("wa-sticker-formatter")

const app = express()
let latestQR = null
let isConnected = false

// DATABASE SEMPLICE
if (!fs.existsSync("./db.json")) fs.writeFileSync("./db.json", JSON.stringify({ users: {}, cars: {}, slots: {} }))
const getDB = () => JSON.parse(fs.readFileSync("./db.json"))
const saveDB = (db) => fs.writeFileSync("./db.json", JSON.stringify(db, null, 2))

app.get("/", async (req, res) => {
  if (isConnected) res.send("<h1>BAD-BOT ONLINE ✅</h1><p>Scrivi /menu</p>")
  else if (latestQR) {
    const qrImg = await qrcode.toDataURL(latestQR)
    res.send(`<h1>BAD-BOT QR</h1><img src="${qrImg}" width="300"><script>setTimeout(()=>location.reload(),15000)</script>`)
  } else res.send("<h1>Avvio...</h1><script>setTimeout(()=>location.reload(),5000)</script>")
})

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth")
  const sock = makeWASocket({
    auth: state, printQRInTerminal: false, syncFullHistory: false, markOnlineOnConnect: false,
    browser: ["BAD-BOT", "Chrome", "1.0"]
  })
  sock.ev.on("creds.update", saveCreds)
  sock.ev.on("connection.update", async (u) => {
    const { connection, lastDisconnect, qr } = u
    if (qr) { latestQR = qr; isConnected = false }
    if (connection === "open") { latestQR = null; isConnected = true; console.log("✅ BAD-BOT CONNESSO!") }
    if (connection === "close") {
      isConnected = false
      if (lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut) startBot()
    }
  })

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const m = messages[0]
    if (!m.message || m.key.fromMe) return
    const from = m.key.remoteJid
    const isGroup = from.endsWith("@g.us")
    const raw = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim()
    if (!raw.startsWith("/")) return
    const args = raw.split(" ")
    const cmd = args[0].toLowerCase()
    const db = getDB()
    const sender = m.key.participant || from
    if (!db.users[sender]) db.users[sender] = { aura: 0, luck: Math.floor(Math.random()*100), cars: [], slots: [] }
    saveDB(db)

    // MENU HOLY
    if (cmd === "/menu") {
      await sock.sendMessage(from, { text: `*😈 BAD-BOT THE HOLY MENU*\n\n*🏎️ CARS*\n/cars /carsgarage - tuo garage\n/sellcar [id] [prezzo] - vendi\n/carshop - mercato\n/buycar [codice] - compra (/buy Z98CAR)\n/addcar - sotto la foto auto\n\n*🎰 SLOTM*\n/slotm - slot machine\n/slot - slot basica\n/buyslot [codice]\n/sellslot [id] [prezzo]\n/slotshop - mercato slot\n/slots - tue slot\n/slotm [id] - slot privata\n\n*😂 FUNN*\n/funn - carrate\n/luck - luck 0% a 100%\n/aura - da -500 a +500\n/myaura - la tua aura\n/allauras - aura di tutti\n/mypro - trova un numero\n\n*🛠️ UTILITY / UTYM*\n/utym - menu utility\n/stick - da foto a sticker\n/franc - da sticker a foto/video\n/finall - tagga tutti\n/mtacc - dati tuo account` })
    }

    // CARS
    if (cmd === "/cars" || cmd === "/carsgarage") {
      const u = db.users[sender]
      await sock.sendMessage(from, { text: `*🏎️ GARAGE*\nHai ${u.cars.length} macchine\n${u.cars.join("\n") || "Vuoto"}` })
    }
    if (cmd === "/carshop") {
      await sock.sendMessage(from, { text: `*🛒 MERCATO CARS*\n${Object.keys(db.cars).map(k=>`${k} - ${db.cars[k].price} - di @${db.cars[k].owner.split("@")[0]}`).join("\n") || "Nessuna in vendita"}` })
    }
    if (cmd === "/buycar" || cmd === "/buy") {
      await sock.sendMessage(from, { text: `*BUY CAR*\nUsi: /buycar Z98CAR\nCodice: ${args[1] || "manca codice"}` })
    }
    if (cmd === "/sellcar") {
      await sock.sendMessage(from, { text: `*SELL CAR*\nUsi: /sellcar ID PREZZO\nEs: /sellcar Z98CAR 5000` })
    }
    if (cmd === "/addcar") {
      if (m.message.imageMessage) await sock.sendMessage(from, { text: `*ADDCAR*\nFoto ricevuta! Aggiunta al garage ✅\nSotto la foto scrivi /addcar` })
      else await sock.sendMessage(from, { text: `*ADDCAR*\nManda una foto con caption /addcar` })
    }

    // SLOTM
    if (cmd === "/slotm" || cmd === "/slot") {
      let win = Math.random() > 0.6
      let premio = win? Math.floor(Math.random()*500) : 0
      await sock.sendMessage(from, { text: `*🎰 SLOT MACHINE*\n${win? `HAI VINTO ${premio} crediti! 🎉` : `Hai perso... riprova!`}` })
    }
    if (cmd === "/buyslot") await sock.sendMessage(from, { text: `*BUY SLOT*\nUsi: /buyslot 003SLOT\nCodice: ${args[1] || "manca"}` })
    if (cmd === "/sellslot") await sock.sendMessage(from, { text: `*SELL SLOT*\nUsi: /sellslot 001SLOT 15000` })
    if (cmd === "/slotshop") await sock.sendMessage(from, { text: `*🛒 MERCATO SLOT*\nSlot in vendita: nessuna` })
    if (cmd === "/slots") {
      const u = db.users[sender]
      await sock.sendMessage(from, { text: `*TUE SLOT*\n${u.slots.join("\n") || "0 slot"}` })
    }

    // FUNN
    if (cmd === "/funn") await sock.sendMessage(from, { text: `*😂 FUNN*\n/funn -> carrate\n/luck\n/aura\n/myaura\n/allauras\n/mypro` })
    if (cmd === "/luck") {
      let l = Math.floor(Math.random()*101)
      db.users[sender].luck = l; saveDB(db)
      await sock.sendMessage(from, { text: `*🍀 LUCK ${l}%*\n${l>80?"Sei fortunatissimo!":l<20?"Sfiga nera...":"Nella media"}` })
    }
    if (cmd === "/aura") {
      let a = Math.floor(Math.random()*1001)-500
      db.users[sender].aura = a; saveDB(db)
      await sock.sendMessage(from, { text: `*💀 AURA: ${a}*\nRange -500 a +500` })
    }
    if (cmd === "/myaura") await sock.sendMessage(from, { text: `*LA TUA AURA: ${db.users[sender].aura}*` })
    if (cmd === "/allauras" || cmd === "/allauras") {
      let txt = Object.keys(db.users).map(k=>`@${k.split("@")[0]}: ${db.users[k].aura}`).join("\n")
      await sock.sendMessage(from, { text: `*AURA DI TUTTI*\n${txt}`, mentions: Object.keys(db.users) })
    }
    if (cmd === "/mypro") await sock.sendMessage(from, { text: `*🔍 MYPRO*\nTrovato numero: @${Object.keys(db.users)[0]?.split("@")[0] || "nessuno"} - dovete diventare amici!`, mentions: Object.keys(db.users) })

    // UTILITY
    if (cmd === "/utym" || cmd === "/utility") await sock.sendMessage(from, { text: `*🛠️ UTYM*\n/stick - foto a sticker\n/franc - sticker a foto/video\n/finall - tagga tutti\n/mtacc - dati account` })
    if (cmd === "/stick" || cmd === "/sticker") {
      if (m.message.imageMessage) {
        const buffer = await downloadMediaMessage(m, "buffer", {})
        const sticker = new Sticker(buffer, { pack: "BAD-BOT", author: "by you", type: StickerTypes.FULL, quality: 70 })
        await sock.sendMessage(from, await sticker.toMessage())
      } else await sock.sendMessage(from, { text: `Manda foto con /stick` })
    }
    if (cmd === "/franc") {
      await sock.sendMessage(from, { text: `Invia uno sticker con /franc per riconvertirlo` })
    }
    if (cmd === "/finall") {
      if (!isGroup) return
      const groupMeta = await sock.groupMetadata(from)
      const members = groupMeta.participants.map(p=>p.id)
      await sock.sendMessage(from, { text: `*TAGGA TUTTI BY BAD-BOT*\n${members.map(m=>`@${m.split("@")[0]}`).join(" ")}`, mentions: members })
    }
    if (cmd === "/mtacc" || cmd === "/myacc") {
      await sock.sendMessage(from, { text: `*📊 DATI TUO ACCOUNT*\nID: ${sender}\nAura: ${db.users[sender].aura}\nLuck: ${db.users[sender].luck}%\nCars: ${db.users[sender].cars.length}\nSlots: ${db.users[sender].slots.length}` })
    }
  })
}
startBot()
app.listen(process.env.PORT || 10000, () => console.log("BAD-BOT Live"))

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys")
const P = require("pino")
const fs = require("fs")
const express = require("express")
const qrcode = require("qrcode")

const app = express()
const PORT = process.env.PORT || 3000
let lastQR = null

function getDB() {
    if (!fs.existsSync("./database.json")) return {}
    try { return JSON.parse(fs.readFileSync("./database.json")) } catch { return {} }
}
function saveDB(db) {
    fs.writeFileSync("./database.json", JSON.stringify(db, null, 2))
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth")
    const sock = makeWASocket({
        auth: state,
        logger: P({ level: "silent" }),
        syncFullHistory: false,
        printQRInTerminal: false
    })

    sock.ev.on("creds.update", saveCreds)
    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update
        if (qr) lastQR = await qrcode.toDataURL(qr)
        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut
            if (shouldReconnect) startBot()
        } else if (connection === "open") {
            lastQR = null
        }
    })

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0]
        if (!m.message) return
        const jid = m.key.remoteJid
        const text = m.message.conversation || m.message.extendedTextMessage?.text || ""
        const lower = text.toLowerCase().trim()

        let db = getDB()
        if (!db[jid]) db[jid] = { soldi: 0, banca: 0, lastMina: 0 }

        // assicura banca esista per vecchi utenti
        if (db[jid].banca === undefined) db[jid].banca = 0

        if (lower === "/menu") {
            await sock.sendMessage(jid, { text: `*BOT - MENU*\n\n⛏️ /mina - 100-500€ (2 min)\n🎰 /slot 100 - scommetti\n🏦 /deposit 100 - deposita in banca\n💸 /pick 100 - preleva dalla banca\n\n💰 Portafoglio: ${db[jid].soldi}€\n🏦 Banca: ${db[jid].banca}€` })
        }
        else if (lower.startsWith("/mina")) {
            let now = Date.now()
            if (now - db[jid].lastMina < 120000) {
                let sec = Math.ceil((120000 - (now - db[jid].lastMina))/1000)
                return sock.sendMessage(jid, { text: `⏳ Aspetta ${sec}s` })
            }
            let guadagno = Math.floor(Math.random() * 401) + 100
            if (Math.random() < 0.15) guadagno = 0
            db[jid].soldi += guadagno
            db[jid].lastMina = now
            saveDB(db)
            await sock.sendMessage(jid, { text: guadagno === 0? `⛏️ Niente...` : `⛏️ Trovato ${guadagno}€! Tot: ${db[jid].soldi}€` })
        }
        else if (lower.startsWith("/slot")) {
            let puntata = parseInt(lower.split(" ")[1])
            if (!puntata || puntata <= 0) return sock.sendMessage(jid, { text: `Usa: /slot 100` })
            if (db[jid].soldi < puntata) return sock.sendMessage(jid, { text: `Non hai abbastanza soldi.` })
            let win = Math.random() < 0.35
            if (win) {
                db[jid].soldi += puntata * 2
                saveDB(db)
                await sock.sendMessage(jid, { text: `🎰 VITTORIA +${puntata*2}€! Tot: ${db[jid].soldi}€` })
            } else {
                db[jid].soldi -= puntata
                saveDB(db)
                await sock.sendMessage(jid, { text: `🎰 PERSO -${puntata}€ Tot: ${db[jid].soldi}€` })
            }
        }
        else if (lower.startsWith("/deposit")) {
            let amount = parseInt(lower.split(" ")[1])
            if (!amount || amount <= 0) return sock.sendMessage(jid, { text: `Usa: /deposit 100` })
            if (db[jid].soldi < amount) return sock.sendMessage(jid, { text: `Non hai abbastanza soldi.` })
            db[jid].soldi -= amount
            db[jid].banca += amount
            saveDB(db)
            await sock.sendMessage(jid, { text: `Transito completato!` })
        }
        else if (lower.startsWith("/pick")) {
            let amount = parseInt(lower.split(" ")[1])
            if (!amount || amount <= 0) return sock.sendMessage(jid, { text: `Usa: /pick 100` })
            if (db[jid].banca < amount) return sock.sendMessage(jid, { text: `Non hai abbastanza soldi.` })
            db[jid].banca -= amount
            db[jid].soldi += amount
            saveDB(db)
            await sock.sendMessage(jid, { text: `Transito completato!` })
        }
    })
}

app.get("/", (req, res) => {
    if (lastQR) res.send(`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#111;color:white;font-family:sans-serif"><h2>Scansiona QR BOT</h2><img src="${lastQR}" style="width:300px"></div>`)
    else res.send("<h1>BOT ONLINE</h1>")
})

app.listen(PORT, () => console.log("Web on " + PORT))
startBot()

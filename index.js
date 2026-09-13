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

        const chatJid = m.key.remoteJid
        // FIX: in gruppo usa chi scrive, non il gruppo stesso
        const senderJid = m.key.participant || chatJid

        const text = m.message.conversation || m.message.extendedTextMessage?.text || ""
        const lower = text.toLowerCase().trim()

        let db = getDB()
        if (!db[senderJid]) db[senderJid] = { soldi: 0, banca: 0, lastMina: 0 }
        if (db[senderJid].banca === undefined) db[senderJid].banca = 0

        if (lower === "/menu") {
            await sock.sendMessage(chatJid, { text: `*BOT - MENU*\n\n⛏️ /mina - 100-500€ (2 min)\n🎰 /slot 100 - scommetti\n🏦 /deposit 100 - deposita\n💸 /pick 100 - preleva\n\n💰 Portafoglio: ${db[senderJid].soldi}€\n🏦 Banca: ${db[senderJid].banca}€`, mentions: [senderJid] })
        }
        else if (lower.startsWith("/mina")) {
            let now = Date.now()
            if (now - db[senderJid].lastMina < 120000) {
                let sec = Math.ceil((120000 - (now - db[senderJid].lastMina))/1000)
                return sock.sendMessage(chatJid, { text: `⏳ @${senderJid.split('@')[0]} aspetta ${sec}s`, mentions: [senderJid] })
            }
            let guadagno = Math.floor(Math.random() * 401) + 100
            if (Math.random() < 0.15) guadagno = 0
            db[senderJid].soldi += guadagno
            db[senderJid].lastMina = now
            saveDB(db)
            await sock.sendMessage(chatJid, { text: guadagno === 0? `⛏️ @${senderJid.split('@')[0]} Niente...` : `⛏️ @${senderJid.split('@')[0]} Trovato ${guadagno}€! Tot: ${db[senderJid].soldi}€`, mentions: [senderJid] })
        }
        else if (lower.startsWith("/slot")) {
            let puntata = parseInt(lower.split(" ")[1])
            if (!puntata || puntata <= 0) return sock.sendMessage(chatJid, { text: `Usa: /slot 100` })
            if (db[senderJid].soldi < puntata) return sock.sendMessage(chatJid, { text: `Non hai abbastanza soldi.`, mentions: [senderJid] })
            let win = Math.random() < 0.35
            if (win) {
                db[senderJid].soldi += puntata * 2
                saveDB(db)
                await sock.sendMessage(chatJid, { text: `🎰 VITTORIA +${puntata*2}€! Tot: ${db[senderJid].soldi}€`, mentions: [senderJid] })
            } else {
                db[senderJid].soldi -= puntata
                saveDB(db)
                await sock.sendMessage(chatJid, { text: `🎰 PERSO -${puntata}€ Tot: ${db[senderJid].soldi}€`, mentions: [senderJid] })
            }
        }
        else if (lower.startsWith("/deposit")) {
            let amount = parseInt(lower.split(" ")[1])
            if (!amount || amount <= 0) return sock.sendMessage(chatJid, { text: `Usa: /deposit 100` })
            if (db[senderJid].soldi < amount) return sock.sendMessage(chatJid, { text: `Non hai abbastanza soldi.` })
            db[senderJid].soldi -= amount
            db[senderJid].banca += amount
            saveDB(db)
            await sock.sendMessage(chatJid, { text: `Transito completato!` })
        }
        else if (lower.startsWith("/pick")) {
            let amount = parseInt(lower.split(" ")[1])
            if (!amount || amount <= 0) return sock.sendMessage(chatJid, { text: `Usa: /pick 100` })
            if (db[senderJid].banca < amount) return sock.sendMessage(chatJid, { text: `Non hai abbastanza soldi.` })
            db[senderJid].banca -= amount
            db[senderJid].soldi += amount
            saveDB(db)
            await sock.sendMessage(chatJid, { text: `Transito completato!` })
        }
    })
}

app.get("/", (req, res) => {
    if (lastQR) res.send(`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#111;color:white;font-family:sans-serif"><h2>Scansiona QR BOT</h2><img src="${lastQR}" style="width:300px"></div>`)
    else res.send("<h1>BOT ONLINE</h1>")
})

app.listen(PORT, () => console.log("Web on " + PORT))
startBot()

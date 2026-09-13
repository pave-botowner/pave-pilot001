const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys")
const P = require("pino")
const fs = require("fs")
const express = require("express")

const app = express()
const PORT = process.env.PORT || 3000

// --- DATABASE SEMPLICE ---
function getDB() {
    if (!fs.existsSync("./database.json")) return {}
    return JSON.parse(fs.readFileSync("./database.json"))
}
function saveDB(db) {
    fs.writeFileSync("./database.json", JSON.stringify(db, null, 2))
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth")

    const sock = makeWASocket({
        auth: state,
        logger: P({ level: "silent" }),
        syncFullHistory: false
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update
        if (connection === "close") {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode!== DisconnectReason.loggedOut
            if (shouldReconnect) startBot()
        } else if (connection === "open") {
            console.log("BOT ONLINE - Reo Fikugi Bot")
        }
    })

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0]
        if (!m.message) return
        // permetti di testare su te stesso
        // if (m.key.fromMe) return

        const jid = m.key.remoteJid
        const text = m.message.conversation || m.message.extendedTextMessage?.text || ""
        const lower = text.toLowerCase().trim()

        let db = getDB()
        if (!db[jid]) db[jid] = { soldi: 0, lastMina: 0 }

        // /menu
        if (lower === "/menu" || lower === "menu") {
            await sock.sendMessage(jid, { text: `*REO FIKUGI BOT - MENU*\n\n⛏️ /mina - mina 100-500 (cooldown 2 min)\n🎰 /slot 100 - scommetti\n\n💰 Soldi: ${db[jid].soldi}€` })
        }

        // /mina
        else if (lower.startsWith("/mina")) {
            let now = Date.now()
            if (now - db[jid].lastMina < 120000) {
                let sec = Math.ceil((120000 - (now - db[jid].lastMina))/1000)
                return sock.sendMessage(jid, { text: `⏳ Aspetta ${sec}s prima di minare di nuovo` })
            }
            let guadagno = Math.floor(Math.random() * 400) + 100
            if (Math.random() < 0.15) guadagno = 0 // 15% trovi niente

            db[jid].soldi += guadagno
            db[jid].lastMina = now
            saveDB(db)

            if (guadagno === 0) {
                await sock.sendMessage(jid, { text: `⛏️ Hai minato ma non hai trovato nulla...` })
            } else {
                await sock.sendMessage(jid, { text: `⛏️ Hai minato e trovato ${guadagno}€!\n💰 Totale: ${db[jid].soldi}€` })
            }
        }

        // /slot 100
        else if (lower.startsWith("/slot")) {
            let puntata = parseInt(lower.split(" ")[1])
            if (!puntata || puntata <= 0) return sock.sendMessage(jid, { text: `Usa: /slot 100` })
            if (db[jid].soldi < puntata) return sock.sendMessage(jid, { text: `Non hai abbastanza soldi. Hai ${db[jid].soldi}€` })

            let win = Math.random() < 0.35 // 35% vinci
            if (win) {
                let vincita = puntata * 2
                db[jid].soldi += vincita
                saveDB(db)
                await sock.sendMessage(jid, { text: `🎰 *VITTORIA* 🎰\nHai puntato ${puntata}€ e vinto ${vincita}€!\n💰 Totale: ${db[jid].soldi}€` })
            } else {
                db[jid].soldi -= puntata
                saveDB(db)
                await sock.sendMessage(jid, { text: `🎰 *HAI PERSO* 🎰\nHai perso ${puntata}€\n💰 Totale: ${db[jid].soldi}€` })
            }
        }
    })
}

app.get("/", (req, res) => res.send("BOT ONLINE"))
app.listen(PORT, () => console.log("Server on " + PORT))

startBot()

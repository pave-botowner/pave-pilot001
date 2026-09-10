const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const P = require('pino')
const express = require('express')
const fs = require('fs')
const app = express()
app.get('/', (req,res) => res.send('Bot Holy Attivo ✅'))
app.listen(process.env.PORT || 10000)

if (!fs.existsSync('./garage.json')) fs.writeFileSync('./garage.json', '{}')
if (!fs.existsSync('./money.json')) fs.writeFileSync('./money.json', '{}')
if (!fs.existsSync('./market.json')) fs.writeFileSync('./market.json', '[]')
if (!fs.existsSync('./slot.json')) fs.writeFileSync('./slot.json', '{}')
if (!fs.existsSync('./slotmarket.json')) fs.writeFileSync('./slotmarket.json', '[]')

// FORZA NUOVO LOGIN - togli questa riga dopo che ti sei connesso
if (fs.existsSync('./auth')) fs.rmSync('./auth', {recursive:true, force:true})

const getGarage = () => JSON.parse(fs.readFileSync('./garage.json'))
const saveGarage = (d) => fs.writeFileSync('./garage.json', JSON.stringify(d,null,2))
const getMoney = () => JSON.parse(fs.readFileSync('./money.json'))
const saveMoney = (d) => fs.writeFileSync('./money.json', JSON.stringify(d,null,2))
const getMarket = () => JSON.parse(fs.readFileSync('./market.json'))
const saveMarket = (d) => fs.writeFileSync('./market.json', JSON.stringify(d,null,2))
const getSlot = () => JSON.parse(fs.readFileSync('./slot.json'))
const saveSlot = (d) => fs.writeFileSync('./slot.json', JSON.stringify(d,null,2))
const getSlotMarket = () => JSON.parse(fs.readFileSync('./slotmarket.json'))
const saveSlotMarket = (d) => fs.writeFileSync('./slotmarket.json', JSON.stringify(d,null,2))
const genCode = () => Math.floor(1000 + Math.random()*9000).toString()

let shop = [
    { name: "Nissan GT-R R35", price: 120000, code: "3333" },
    { name: "Lamborghini Huracan", price: 253560, code: "2222" },
    { name: "Ferrari F40", price: 2500000, code: "1111" }
]
let slotshop = [
    { name: "Holy Basic Slot", price: 50000, win: 40, code: "S111" },
    { name: "Holy Gold Slot", price: 150000, win: 55, code: "S222" },
    { name: "Holy Diamond Slot", price: 500000, win: 70, code: "S333" }
]

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const sock = makeWASocket({ 
        auth: state, 
        logger: P({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ["Holy Bot", "Chrome", "1.0"]
    })
    sock.ev.on('creds.update', saveCreds)

    // CHIEDI IL PAIRING CODE
    if (!sock.authState.creds.registered) {
        let number = "39TUONUMERO" // <--- METTI QUI IL TUO NUMERO CON 39 DAVANTI ES: 393331234567
        setTimeout(async () => {
            let code = await sock.requestPairingCode(number)
            console.log(`\n\n=== IL TUO CODICE PAIRING: ${code} ===\n\n`)
        }, 3000)
    }

    sock.ev.on('connection.update', (u) => {
        if (u.connection === 'close' && u.lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut) startBot()
        if (u.connection === 'open') console.log("✅ CONNESSO!")
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0]; if (!m.message || m.key.fromMe) return
        const text = (m.message.conversation || m.message.extendedTextMessage?.text || '').trim()
        const lower = text.toLowerCase(); const jid = m.key.remoteJid
        let garage = getGarage()
        if (lower === '/menu') await sock.sendMessage(jid, { text: `*🔱☁️The Holy Menus☁️🔱*\n/carm\n/slotm\n/acc` })
        else if (lower === '/carm') await sock.sendMessage(jid, { text: `*🛞⚙️Car Menu⚙️🛞*\n\n/mycar\n/sell CODICE PREZZO\n/autosell CODICE\n/car\n/carshop\n/buy CODICE` })
        else if (lower === '/acc') { let db=getMoney(); await sock.sendMessage(jid,{text:`*🏦 Saldo: ${(db[jid]||0).toLocaleString()}€*`}) }
    })
}
startBot()
setInterval(()=>{},1000*60*4)

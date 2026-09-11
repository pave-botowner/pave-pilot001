const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const P = require('pino')
const express = require('express')
const fs = require('fs')
const app = express()
app.get('/', (req,res) => res.send('Bot FINAL SELF ✅'))
app.listen(process.env.PORT || 10000)

if (!fs.existsSync('./money.json')) fs.writeFileSync('./money.json', '{}')
if (!fs.existsSync('./slot.json')) fs.writeFileSync('./slot.json', '{}')
if (!fs.existsSync('./slotmarket.json')) fs.writeFileSync('./slotmarket.json', '[]')
if (!fs.existsSync('./mina.json')) fs.writeFileSync('./mina.json', '{}')

const getMoney = () => JSON.parse(fs.readFileSync('./money.json'))
const saveMoney = (d) => fs.writeFileSync('./money.json', JSON.stringify(d,null,2))
const getSlot = () => JSON.parse(fs.readFileSync('./slot.json'))
const saveSlot = (d) => fs.writeFileSync('./slot.json', JSON.stringify(d,null,2))
const getSlotMarket = () => JSON.parse(fs.readFileSync('./slotmarket.json'))
const saveSlotMarket = (d) => fs.writeFileSync('./slotmarket.json', JSON.stringify(d,null,2))
const getMina = () => JSON.parse(fs.readFileSync('./mina.json'))
const saveMina = (d) => fs.writeFileSync('./mina.json', JSON.stringify(d,null,2))
const genCode = () => Math.floor(1000 + Math.random()*9000).toString()

let slotshop = [
    { name: "Holy Basic Slot", price: 50000, win: 40, code: "S111" },
    { name: "Holy Gold Slot", price: 150000, win: 55, code: "S222" },
    { name: "Holy Diamond Slot", price: 500000, win: 70, code: "S333" }
]

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth')
    const sock = makeWASocket({ auth: state, logger: P({ level: 'silent' }), printQRInTerminal: true, browser: ["Holy Bot", "Chrome", "1.0"] })
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', (u) => {
        if (u.qr) console.log(`\nQR LINK:\nhttps://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(u.qr)}\n`)
        if (u.connection === 'open') console.log("✅ CONNESSO SELF OK!")
        if (u.connection === 'close' && u.lastDisconnect?.error?.output?.statusCode!==DisconnectReason.loggedOut) startBot()
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0]
        // FIX: permette anche i messaggi inviati da te stesso
        if (!m.message) return
        const text = (m.message.conversation || m.message.extendedTextMessage?.text || '').trim()
        if(!text) return
        console.log("COMANDO RICEVUTO:", text, "da", m.key.remoteJid, "fromMe:", m.key.fromMe)
        const lower = text.toLowerCase()
        const jid = m.key.remoteJid

        if (lower === '/menu') {
            await sock.sendMessage(jid, { text: `*_💶👤Menu👤💶_*\n/slotm -> _Menu Slot_🎰\n/acc -> _Account_🪪\n/funm -> _Divertimento_😂` })
        }
        else if (lower === '/slotm') {
            await sock.sendMessage(jid, { text: `*_🎰Menu Slot🎰_*\n/slotshop -> _Negozio Slot_🏪\n/myslot -> _Le Tue Slot_💼\n/slot CODICE -> _Usa Slot_🎲\n/buyslotCODICE -> _Compra Slot_🛒\n/sellslotCODICE_PREZZO -> _Vendi Slot_💸\n/autosellslotCODICE -> _Vendi al Sistema_♻️\n/slot -> _Mercato Slot_🌐` })
        }
        else if (lower === '/funm') {
            await sock.sendMessage(jid, { text: `*_😂Menu Divertimento😂_*\n/mina -> _Mina Soldi_⛏️` })
        }
        else if (lower === '/acc') {
            let db=getMoney();
            await sock.sendMessage(jid,{text:`*_🪪Account🪪_*\n💶 Saldo: _${(db[jid]||0).toLocaleString()}€_`})
        }
        else if (lower === '/mina') {
            let minaDb = getMina(); let now = Date.now(); let last = minaDb[jid] || 0; let diff = now - last; let oneHour = 60*60*1000
            if (diff < oneHour) { let left = Math.ceil((oneHour - diff)/60000); return await sock.sendMessage(jid, { text: `*_⛏️Mina⛏️_*\n_Hai già minato!_ 😤\nRiprova tra _${left} min_ ⏳` }) }
            let amount = Math.floor(Math.random()*3001); let moneyDb = getMoney(); moneyDb[jid] = (moneyDb[jid]||0)+amount; saveMoney(moneyDb); minaDb[jid] = now; saveMina(minaDb)
            await sock.sendMessage(jid, { text: `*_⛏️Mina Trovata!⛏️_*\nHai minato _${amount}€_ 💰\n🏦 Saldo: _${moneyDb[jid].toLocaleString()}€_` })
        }
        else if (lower === '/slotshop') {
            let txt=`*_🏪Negozio Slot🏪_*\n`; slotshop.forEach(s=>txt+=`🎰 ${s.name} - _${s.price}€_ -> /buyslot${s.code}\n`)
            await sock.sendMessage(jid,{text:txt})
        }
        else if (lower === '/myslot') {
            let slots=getSlot()[jid]||[]; if(slots.length===0) return sock.sendMessage(jid,{text:`*_💼Le Tue Slot💼_*\n_Nessuna slot_ 😢`})
            await sock.sendMessage(jid,{text:`*_💼Le Tue Slot💼_*\n`+slots.map(s=>`🎰 ${s.name} - _${s.code}_`).join('\n')})
        }
        else if (lower === '/slot' || lower === '/slots') {
            let market=getSlotMarket(); if(market.length===0) return sock.sendMessage(jid,{text:`*_🌐Mercato Slot🌐_*\n_Vuoto_ 🍃`})
            await sock.sendMessage(jid,{text:`*_🌐Mercato Slot🌐_*\n`+market.map(m=>`🎰 ${m.name} - _${m.price}€_`).join('\n')})
        }
        else if (lower.startsWith('/slot ') ) {
            let code=lower.split(' ')[1]; let mySlots=getSlot()[jid]||[]; let slot=mySlots.find(s=>s.code===code); if(!slot) return sock.sendMessage(jid,{text:`_Slot non trovata_ ❌`})
            let moneyDb=getMoney(); if(Math.random()*100<=slot.win){ moneyDb[jid]=(moneyDb[jid]||0)+slot.payout; saveMoney(moneyDb); await sock.sendMessage(jid,{text:`*_🎰WIN!🎰_*\nHai vinto _${slot.payout}€_! 💸`}) } else await sock.sendMessage(jid,{text:`*_🎰LOST😭_*\n_Ritenta_ 🍀`})
        }
        else if (lower.startsWith('/buyslot')) {
            let code=lower.replace('/buyslot','').trim(); let moneyDb=getMoney(); let all=getSlot(); let sh=slotshop.find(s=>s.code===code); if(!sh) return await sock.sendMessage(jid,{text:`_Codice slot non valido_ ❌`});
            moneyDb[jid]=(moneyDb[jid]||0)-sh.price; if(!all[jid]) all[jid]=[]; all[jid].push({name:sh.name,code:genCode(),win:sh.win,payout:Math.floor(sh.price*0.3),value:sh.price}); saveSlot(all); saveMoney(moneyDb); await sock.sendMessage(jid,{text:`*_🛒Acquistata!🛒_*\n_${sh.name}_ 🎰`})
        }
        else if (lower.startsWith('/sellslot')) {
            let args = lower.replace('/sellslot','').trim(); let parts = args.split('_'); if(parts.length < 2) return await sock.sendMessage(jid,{text:`_Usa: /sellslotCODICE_PREZZO_\n_Es: /sellslot8581_90000_`})
            let code = parts[0]; let price = parseInt(parts[1]); let all=getSlot(); let my=all[jid]||[]; let i=my.findIndex(s=>s.code===code); if(i===-1) return await sock.sendMessage(jid,{text:`_Slot ${code} non trovata_ ❌`})
            let s=my[i]; my.splice(i,1); all[jid]=my; saveSlot(all); let market=getSlotMarket(); market.push({name:s.name,code:s.code,price:price,win:s.win,payout:s.payout,seller:jid}); saveSlotMarket(market)
            await sock.sendMessage(jid,{text:`*_💸In Vendita💸_*\n_${s.name}_ per _${price}€_ 🌐`})
        }
        else if (lower.startsWith('/autosellslot')) {
            let code=lower.replace('/autosellslot','').trim(); let all=getSlot(); let my=all[jid]||[]; let i=my.findIndex(s=>s.code===code); if(i===-1) return
            let s=my[i]; let half=Math.floor(s.value*0.5); my.splice(i,1); all[jid]=my; saveSlot(all); let moneyDb=getMoney(); moneyDb[jid]=(moneyDb[jid]||0)+half; saveMoney(moneyDb)
            await sock.sendMessage(jid,{text:`*_♻️Venduta♻️_*\n+${half}€ 💶`})
        }
        else if (lower.startsWith('/addmoney')) { let a=parseInt(lower.split(' ')[1])||100000; let db=getMoney(); db[jid]=(db[jid]||0)+a; saveMoney(db); await sock.sendMessage(jid,{text:`*_💶+${a}€_ aggiunto*`}) }
    })
}
startBot()

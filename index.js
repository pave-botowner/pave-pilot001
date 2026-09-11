const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const P = require('pino')
const express = require('express')
const fs = require('fs')
const app = express()
app.get('/', (req,res) => res.send('Bot Holy SENZA CARM ✅'))
app.listen(process.env.PORT || 10000)

if (!fs.existsSync('./garage.json')) fs.writeFileSync('./garage.json', '{}')
if (!fs.existsSync('./money.json')) fs.writeFileSync('./money.json', '{}')
if (!fs.existsSync('./market.json')) fs.writeFileSync('./market.json', '[]')
if (!fs.existsSync('./slot.json')) fs.writeFileSync('./slot.json', '{}')
if (!fs.existsSync('./slotmarket.json')) fs.writeFileSync('./slotmarket.json', '[]')
if (!fs.existsSync('./mina.json')) fs.writeFileSync('./mina.json', '{}')

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
const getMina = () => JSON.parse(fs.readFileSync('./mina.json'))
const saveMina = (d) => fs.writeFileSync('./mina.json', JSON.stringify(d,null,2))
const genCode = () => Math.floor(1000 + Math.random()*9000).toString()

let shop = [
    { name: "Nissan GT-R R35", price: 120000, code: "3333" },
    { name: "Lamborghini Huracan", price: 253560, code: "2222" },
    { name: "Ferrari F40", price: 2500000, code: "1111" },
    { name: "Pagani Zonda", price: 3000000, code: "4444" },
    { name: "Bugatti Chiron", price: 4000000, code: "5555" }
]
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
        if (u.qr) console.log(`\n=== QR LINK ===\nhttps://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(u.qr)}\n`)
        if (u.connection === 'open') console.log("✅ BOT CONNESSO SENZA CARM!")
        if (u.connection === 'close' && u.lastDisconnect?.error?.output?.statusCode!==DisconnectReason.loggedOut) startBot()
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0]; if (!m.message) return
        const text = (m.message.conversation || m.message.extendedTextMessage?.text || '').trim()
        const lower = text.toLowerCase(); const jid = m.key.remoteJid
        let garage = getGarage()

        if (lower === '/menu') await sock.sendMessage(jid, { text: `*🔱☁️The Holy Menus☁️🔱*\n\n🛞 *Auto:*\n/mycar /car /carshop /buy /sell /autosell\n\n🎰 *Slot:*\n/slotm\n\n💰 *Soldi:*\n/acc /mina` })
        else if (lower === '/mina') {
            let minaDb = getMina(); let now = Date.now()
            let last = minaDb[jid] || 0
            let diff = now - last
            let oneHour = 60*60*1000
            if (diff < oneHour) {
                let left = Math.ceil((oneHour - diff)/60000)
                return await sock.sendMessage(jid, { text: `⛏️ Hai già minato! Riprova tra ${left} min` })
            }
            let amount = Math.floor(Math.random()*3001)
            let moneyDb = getMoney(); moneyDb[jid] = (moneyDb[jid]||0)+amount; saveMoney(moneyDb)
            minaDb[jid] = now; saveMina(minaDb)
            await sock.sendMessage(jid, { text: `⛏️ *MINA*\nHai minato ${amount}€!\n🏦 Saldo: ${moneyDb[jid].toLocaleString()}€` })
        }
        // COMANDI AUTO DIRETTI (senza /carm)
        else if (lower === '/mycar') {
            let cars = garage[jid]||[]; if(cars.length===0) return sock.sendMessage(jid,{text:`*🏎️Garage Vuoto*`})
            await sock.sendMessage(jid,{text:`*🏎️💶Your Garage💶🏎️*\n\n`+cars.map(c=>`• ${c.name} - ${c.code}`).join('\n')})
        }
        else if (lower === '/carshop') {
            let txt=`*🏪🔱 CAR SHOP 🔱🏪*\n`; shop.forEach(c=>txt+=`• ${c.name} - ${c.price.toLocaleString()}€ - /buy ${c.code}\n`)
            await sock.sendMessage(jid,{text:txt})
        }
        else if (lower === '/car') {
            let market=getMarket(); if(market.length===0) return sock.sendMessage(jid,{text:`*🌐 On Market Vuoto*`})
            let txt=`*🌐 On Market 🌐*\n`; market.forEach(m=>txt+=`• ${m.name} - ${m.price.toLocaleString()}€ - /buy ${m.code}\n`)
            await sock.sendMessage(jid,{text:txt})
        }
        else if (lower.startsWith('/sell ') &&!lower.includes('slot')) {
            let p=lower.split(' '); let code=p[1]; let price=parseInt(p[2]); let cars=garage[jid]||[]; let i=cars.findIndex(c=>c.code===code); if(i===-1) return
            let car=cars[i]; cars.splice(i,1); saveGarage({...garage,[jid]:cars})
            let market=getMarket(); market.push({name:car.name,code:car.code,price:price,seller:jid,value:price}); saveMarket(market)
            await sock.sendMessage(jid,{text:`In vendita per ${price}€`})
        }
        else if (lower.startsWith('/autosell ') &&!lower.includes('slot')) {
            let code=lower.split(' ')[1]; let cars=garage[jid]||[]; let i=cars.findIndex(c=>c.code===code); if(i===-1) return
            let car=cars[i]; let full=shop.find(s=>s.name===car.name)?.price||car.value||100000; let half=Math.floor(full*0.5)
            cars.splice(i,1); saveGarage({...garage,[jid]:cars})
            let moneyDb=getMoney(); moneyDb[jid]=(moneyDb[jid]||0)+half; saveMoney(moneyDb)
            let market=getMarket(); market.push({name:car.name,code:car.code,price:full,seller:"BOT",value:full}); saveMarket(market)
            await sock.sendMessage(jid,{text:`AutoSell +${half}€`})
        }
        else if (lower.startsWith('/buy ') &&!lower.includes('slot')) {
            let code=lower.split(' ')[1]; let market=getMarket(); let moneyDb=getMoney()
            let mc=market.find(c=>c.code===code)
            if(mc){ moneyDb[jid]=(moneyDb[jid]||0)-mc.price; if(!garage[jid]) garage[jid]=[]; garage[jid].push({name:mc.name,code:genCode(),value:mc.price}); saveMarket(market.filter(c=>c.code!==code)); saveMoney(moneyDb); saveGarage(garage); await sock.sendMessage(jid,{text:`✅ Comprata ${mc.name}`}); return }
            let sc=shop.find(c=>c.code===code)
            if(sc){ moneyDb[jid]=(moneyDb[jid]||0)-sc.price; if(!garage[jid]) garage[jid]=[]; garage[jid].push({name:sc.name,code:genCode(),value:sc.price}); saveMoney(moneyDb); saveGarage(garage); await sock.sendMessage(jid,{text:`✅ Comprata ${sc.name}`}); return }
        }
        else if (lower === '/slotm') await sock.sendMessage(jid, { text: `*🎰Slot Menu*\n/slotshop\n/myslot\n/slot CODICE\n/buyslot CODICE\n/sellslot CODICE PREZZO\n/autosellslot CODICE\n/slot\n/slot% CODICE 60\n/slot$ CODICE 10000` })
        else if (lower === '/slotshop') {
            let txt=`*🎰 SLOT SHOP*\n`; slotshop.forEach(s=>txt+=`• ${s.name} - ${s.price}€ Win ${s.win}% - /buyslot ${s.code}\n`)
            await sock.sendMessage(jid,{text:txt})
        }
        else if (lower === '/myslot') {
            let slots=getSlot()[jid]||[]; await sock.sendMessage(jid,{text:slots.map(s=>`• ${s.name} - ${s.code} Win ${s.win}%`).join('\n')||'Vuoto'})
        }
        else if (lower === '/slot' || lower === '/slots') {
            let market=getSlotMarket(); await sock.sendMessage(jid,{text:market.map(m=>`• ${m.name} - ${m.price}€`).join('\n')||'Vuoto'})
        }
        else if (lower.startsWith('/slot ') &&!lower.includes('%') &&!lower.includes('$')) {
            let code=lower.split(' ')[1]; let mySlots=getSlot()[jid]||[]; let slot=mySlots.find(s=>s.code===code); if(!slot) return
            let moneyDb=getMoney(); if(Math.random()*100<=slot.win){ moneyDb[jid]=(moneyDb[jid]||0)+slot.payout; saveMoney(moneyDb); await sock.sendMessage(jid,{text:`🎰 WIN +${slot.payout}€`}) } else await sock.sendMessage(jid,{text:`🎰 LOST`})
        }
        else if (lower.startsWith('/buyslot ')) {
            let code=lower.split(' ')[1]; let moneyDb=getMoney(); let all=getSlot();
            let sh=slotshop.find(s=>s.code===code); if(!sh) return; moneyDb[jid]=(moneyDb[jid]||0)-sh.price; if(!all[jid]) all[jid]=[]; all[jid].push({name:sh.name,code:genCode(),win:sh.win,payout:Math.floor(sh.price*0.3),value:sh.price}); saveSlot(all); saveMoney(moneyDb); await sock.sendMessage(jid,{text:`✅ Slot ${sh.name}`})
        }
        else if (lower.startsWith('/sellslot ')) {
            let p=lower.split(' '); let code=p[1]; let price=parseInt(p[2]); let all=getSlot(); let my=all[jid]||[]; let i=my.findIndex(s=>s.code===code); if(i===-1) return
            let s=my[i]; my.splice(i,1); all[jid]=my; saveSlot(all); let market=getSlotMarket(); market.push({name:s.name,code:s.code,price:price,win:s.win,payout:s.payout,seller:jid}); saveSlotMarket(market)
            await sock.sendMessage(jid,{text:`Slot in vendita`})
        }
        else if (lower.startsWith('/autosellslot ')) {
            let code=lower.split(' ')[1]; let all=getSlot(); let my=all[jid]||[]; let i=my.findIndex(s=>s.code===code); if(i===-1) return
            let s=my[i]; let half=Math.floor(s.value*0.5); my.splice(i,1); all[jid]=my; saveSlot(all); let moneyDb=getMoney(); moneyDb[jid]=(moneyDb[jid]||0)+half; saveMoney(moneyDb)
            await sock.sendMessage(jid,{text:`♻️ +${half}€`})
        }
        else if (lower.startsWith('/slot% ')) {
            let p=lower.split(' '); let code=p[1]; let perc=parseInt(p[2]); let all=getSlot(); for(let u in all){ let idx=all[u].findIndex(s=>s.code===code); if(idx!==-1){ all[u][idx].win=perc; saveSlot(all); await sock.sendMessage(jid,{text:`Win ${perc}%`}); return } }
        }
        else if (lower.startsWith('/slot$ ')) {
            let p=lower.split(' '); let code=p[1]; let pay=parseInt(p[2]); let all=getSlot(); for(let u in all){ let idx=all[u].findIndex(s=>s.code===code); if(idx!==-1){ all[u][idx].payout=pay; saveSlot(all); await sock.sendMessage(jid,{text:`Payout ${pay}€`}); return } }
        }
        else if (lower === '/acc') { let db=getMoney(); await sock.sendMessage(jid,{text:`🏦 Saldo: ${(db[jid]||0).toLocaleString()}€`}) }
        else if (lower.startsWith('/addmoney')) { let a=parseInt(lower.split(' ')[1])||100000; let db=getMoney(); db[jid]=(db[jid]||0)+a; saveMoney(db); await sock.sendMessage(jid,{text:`+${a}€`}) }
    })
}
startBot()

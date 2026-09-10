const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const P = require('pino')
const express = require('express')
const fs = require('fs')
const app = express()
app.get('/', (req,res) => res.send('Bot Holy Attivo ✅'))
app.listen(process.env.PORT || 10000)

// DB FILES
if (!fs.existsSync('./garage.json')) fs.writeFileSync('./garage.json', '{}')
if (!fs.existsSync('./money.json')) fs.writeFileSync('./money.json', '{}')
if (!fs.existsSync('./market.json')) fs.writeFileSync('./market.json', '[]')
if (!fs.existsSync('./slot.json')) fs.writeFileSync('./slot.json', '{}')
if (!fs.existsSync('./slotmarket.json')) fs.writeFileSync('./slotmarket.json', '[]')

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
    const sock = makeWASocket({ auth: state, logger: P({ level: 'silent' }) })
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', (u) => { if (u.connection === 'close' && u.lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut) startBot() })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0]; if (!m.message || m.key.fromMe) return
        const text = (m.message.conversation || m.message.extendedTextMessage?.text || '').trim()
        const lower = text.toLowerCase(); const jid = m.key.remoteJid
        let garage = getGarage()

        if (lower === '/menu') await sock.sendMessage(jid, { text: `*🔱☁️The Holy Menus☁️🔱*\n/carm\n/slotm\n/acc` })

        // ========= CAR MENU =========
        else if (lower === '/carm') await sock.sendMessage(jid, { text: `*🛞⚙️Car Menu⚙️🛞*\n\n/mycar\n/sell CODICE PREZZO\n/autosell CODICE\n/car\n/carshop\n/buy CODICE` })
        else if (lower === '/mycar') {
            let cars = garage[jid]||[]; if(cars.length===0) return sock.sendMessage(jid,{text:`*🏎️Garage Vuoto*`})
            await sock.sendMessage(jid,{text:`*🏎️💶Your Garage💶🏎️*\n\n`+cars.map(c=>`• ${c.name} - ${c.code}`).join('\n')})
        }
        else if (lower === '/carshop') {
            let txt=`*🏪🔱 THE HOLY CAR SHOP 🔱🏪*\n*━━━━━━━━━━━━━━━━━━*\n\n`
            shop.forEach(c=>{ let e=c.name.includes('Nissan')?'🇯🇵':c.name.includes('Lambo')?'🇮🇹':'🔴'; txt+=`${e} *${c.name}*\n 💰 ${c.price.toLocaleString()}€\n 🔑 /buy ${c.code}\n ━━━━━━━━━━━━━\n` })
            await sock.sendMessage(jid,{text:txt})
        }
        else if (lower === '/car') {
            let market=getMarket(); if(market.length===0) return sock.sendMessage(jid,{text:`*🌐 On Market Vuoto*`})
            let txt=`*🌐🏪 On Market 🌐*\n\n`; market.forEach(m=>txt+=`🏷️ ${m.name} - ${m.price.toLocaleString()}€ - /buy ${m.code}\n`)
            await sock.sendMessage(jid,{text:txt})
        }
        else if (lower.startsWith('/sell') &&!lower.includes('slot')) {
            let p=lower.split(' '); let code=p[1]; let price=parseInt(p[2]); if(!code||!price) return sock.sendMessage(jid,{text:"Usa: /sell CODICE PREZZO"})
            let cars=garage[jid]||[]; let i=cars.findIndex(c=>c.code===code); if(i===-1) return sock.sendMessage(jid,{text:"Non hai quella macchina"})
            let car=cars[i]; cars.splice(i,1); saveGarage({...garage,[jid]:cars})
            let market=getMarket(); market.push({name:car.name,code:car.code,price:price,seller:jid,value:price}); saveMarket(market)
            await sock.sendMessage(jid,{text:`*🏷️🔥 On Market 🔥🏷️*\n\n${car.name} in vendita per ${price.toLocaleString()}€`})
        }
        else if (lower.startsWith('/autosell') &&!lower.includes('slot')) {
            let code=lower.split(' ')[1]; let cars=garage[jid]||[]; let i=cars.findIndex(c=>c.code===code); if(i===-1) return sock.sendMessage(jid,{text:"Non hai quella macchina"})
            let car=cars[i]; let full=shop.find(s=>s.name===car.name)?.price||car.value||100000; let half=Math.floor(full*0.5)
            cars.splice(i,1); saveGarage({...garage,[jid]:cars})
            let moneyDb=getMoney(); moneyDb[jid]=(moneyDb[jid]||0)+half; saveMoney(moneyDb)
            let market=getMarket(); market.push({name:car.name,code:car.code,price:full,seller:"BOT",value:full}); saveMarket(market)
            await sock.sendMessage(jid,{text:`*🤖⚡ AutoSell ⚡🤖*\n${car.name}\n+${half.toLocaleString()}€ Saldo: ${moneyDb[jid].toLocaleString()}€\nOra On Market a ${full.toLocaleString()}€`})
        }
        else if (lower.startsWith('/buy') &&!lower.includes('slot')) {
            let code=lower.split(' ')[1]; let market=getMarket(); let moneyDb=getMoney(); let myMoney=moneyDb[jid]||0
            let mc=market.find(c=>c.code===code)
            if(mc){ if(myMoney<mc.price) return sock.sendMessage(jid,{text:`Ti servono ${mc.price}€`})
                moneyDb[jid]-=mc.price; if(mc.seller!=="BOT") moneyDb[mc.seller]=(moneyDb[mc.seller]||0)+mc.price
                if(!garage[jid]) garage[jid]=[]; garage[jid].push({name:mc.name,code:genCode(),value:mc.price})
                saveMarket(market.filter(c=>c.code!==code)); saveMoney(moneyDb); saveGarage(garage)
                await sock.sendMessage(jid,{text:`*✅💎 Acquisto Completato 💎✅*\n\n🏎️ ${mc.name}\n💰 ${mc.price.toLocaleString()}€\n🏦 Saldo Bancario: ${moneyDb[jid].toLocaleString()}€`}); return
            }
            let sc=shop.find(c=>c.code===code)
            if(sc){ if(myMoney<sc.price) return sock.sendMessage(jid,{text:`Ti servono ${sc.price}€`})
                moneyDb[jid]-=sc.price; if(!garage[jid]) garage[jid]=[]; garage[jid].push({name:sc.name,code:genCode(),value:sc.price})
                saveMoney(moneyDb); saveGarage(garage)
                await sock.sendMessage(jid,{text:`*✅💎 Acquisto Completato 💎✅*\n\n🏎️ ${sc.name}\n💰 ${sc.price.toLocaleString()}€\n🏦 Saldo: ${moneyDb[jid].toLocaleString()}€ 🔥`}); return
            }
        }

        // ========= SLOT MENU =========
        else if (lower === '/slotm') await sock.sendMessage(jid, { text: `*🎰⚙️Slot Menu⚙️🎰*\n\n/slotshop\n/myslot\n/slot CODICE\n/buyslot CODICE\n/sellslot CODICE PREZZO\n/autosellslot CODICE\n/slot\n\n*Admin:*\n/slot% CODICE PERC\n/slot$ CODICE PAYOUT` })
        else if (lower === '/slotshop') {
            let txt=`*🎰🔱 SLOT SHOP 🔱🎰*\n*━━━━━━━━━━━━━━━━━━*\n\n`; slotshop.forEach(s=>txt+=`🎰 *${s.name}*\n 💰 ${s.price.toLocaleString()}€ | 🍀 ${s.win}%\n 🔑 /buyslot ${s.code}\n ━━━━━━━━━━━━━\n`)
            await sock.sendMessage(jid,{text:txt})
        }
        else if (lower === '/myslot') {
            let slots=getSlot()[jid]||[]; if(slots.length===0) return sock.sendMessage(jid,{text:`*🎰 Slots Vuoto*`})
            await sock.sendMessage(jid,{text:`*🎰 Your Slots*\n\n`+slots.map(s=>`• ${s.name} - Win ${s.win}% - ${s.code} - Payout ${s.payout}€`).join('\n')})
        }
        else if (lower === '/slot' || lower === '/slots') {
            let market=getSlotMarket(); if(market.length===0) return sock.sendMessage(jid,{text:`*🌐 Slot On Market Vuoto*`})
            let txt=`*🌐 Slot On Market 🌐*\n\n`; market.forEach(m=>txt+=`• ${m.name} - ${m.price.toLocaleString()}€ - Win ${m.win}% - /buyslot ${m.code}\n`)
            await sock.sendMessage(jid,{text:txt})
        }
        else if (lower.startsWith('/slot ') &&!lower.includes('%') &&!lower.includes('$')) {
            let code=lower.split(' ')[1]; let mySlots=getSlot()[jid]||[]; let slot=mySlots.find(s=>s.code===code)
            if(!slot) return sock.sendMessage(jid,{text:`Non hai ${code}`})
            let moneyDb=getMoney(); let roll=Math.random()*100
            if(roll<=slot.win){ moneyDb[jid]=(moneyDb[jid]||0)+slot.payout; saveMoney(moneyDb); await sock.sendMessage(jid,{text:`*🎰💸 WIN! 💸🎰*\n\n${slot.name}\n+${slot.payout.toLocaleString()}€\n🏦 Saldo: ${moneyDb[jid].toLocaleString()}€`}) }
            else await sock.sendMessage(jid,{text:`*🎰💀 LOST 💀🎰*\n${slot.name} perso... 🍀 ${slot.win}%`})
        }
        else if (lower.startsWith('/buyslot')) {
            let code=lower.split(' ')[1]; let moneyDb=getMoney(); let myMoney=moneyDb[jid]||0
            let market=getSlotMarket(); let ms=market.find(s=>s.code===code)
            if(ms){ if(myMoney<ms.price) return sock.sendMessage(jid,{text:`Ti servono ${ms.price}€`}); moneyDb[jid]-=ms.price; if(ms.seller!=="BOT") moneyDb[ms.seller]=(moneyDb[ms.seller]||0)+ms.price
                let all=getSlot(); if(!all[jid]) all[jid]=[]; all[jid].push({name:ms.name,code:genCode(),win:ms.win,payout:ms.payout,value:ms.price}); saveSlot(all); saveMoney(moneyDb); saveSlotMarket(market.filter(s=>s.code!==code))
                await sock.sendMessage(jid,{text:`*✅ Slot Comprata*\n${ms.name} - Saldo: ${moneyDb[jid].toLocaleString()}€`}); return
            }
            let sh=slotshop.find(s=>s.code===code); if(!sh) return sock.sendMessage(jid,{text:"Codice non trovato"})
            if(myMoney<sh.price) return sock.sendMessage(jid,{text:`Ti servono ${sh.price}€`}); moneyDb[jid]-=sh.price
            let all=getSlot(); if(!all[jid]) all[jid]=[]; all[jid].push({name:sh.name,code:genCode(),win:sh.win,payout:Math.floor(sh.price*0.3),value:sh.price}); saveSlot(all); saveMoney(moneyDb)
            await sock.sendMessage(jid,{text:`*✅ Slot Comprata*\n${sh.name} Win ${sh.win}% - Saldo: ${moneyDb[jid].toLocaleString()}€`})
        }
        else if (lower.startsWith('/sellslot')) {
            let p=lower.split(' '); let code=p[1]; let price=parseInt(p[2]); if(!code||!price) return sock.sendMessage(jid,{text:"Usa: /sellslot CODICE PREZZO"})
            let all=getSlot(); let my=all[jid]||[]; let i=my.findIndex(s=>s.code===code); if(i===-1) return sock.sendMessage(jid,{text:"Non hai quella slot"})
            let s=my[i]; my.splice(i,1); saveSlot(all); let market=getSlotMarket(); market.push({name:s.name,code:s.code,price:price,win:s.win,payout:s.payout,seller:jid}); saveSlotMarket(market)
            await sock.sendMessage(jid,{text:`*🏷️🔥 On Market 🔥🏷️*\n${s.name} a ${price}€`})
        }
        else if (lower.startsWith('/autosellslot')) {
            let code=lower.split(' ')[1]; let all=getSlot(); let my=all[jid]||[]; let i=my.findIndex(s=>s.code===code); if(i===-1) return sock.sendMessage(jid,{text:"Non hai quella slot"})
            let s=my[i]; let half=Math.floor(s.value*0.5); my.splice(i,1); saveSlot(all)
            let moneyDb=getMoney(); moneyDb[jid]=(moneyDb[jid]||0)+half; saveMoney(moneyDb)
            let market=getSlotMarket(); market.push({name:s.name,code:s.code,price:s.value,win:s.win,payout:s.payout,seller:"BOT"}); saveSlotMarket(market)
            await sock.sendMessage(jid,{text:`*🤖 AutoSell Slot*\n+${half}€ Saldo: ${moneyDb[jid].toLocaleString()}€\nOra On Market a ${s.value}€`})
        }
        else if (lower.startsWith('/slot%')) {
            let p=lower.split(' '); let code=p[1]; let perc=parseInt(p[2]); let all=getSlot()
            for(let uid in all){ let f=all[uid].find(s=>s.code===code); if(f){ f.win=perc; saveSlot(all); return sock.sendMessage(jid,{text:`✅ Win ${f.name} -> ${perc}%`}) } }
            let sh=slotshop.find(s=>s.code===code); if(sh){ sh.win=perc; return sock.sendMessage(jid,{text:`✅ Shop win -> ${perc}%`}) }
        }
        else if (lower.startsWith('/slot$')) {
            let p=lower.split(' '); let code=p[1]; let pay=parseInt(p[2]); let all=getSlot()
            for(let uid in all){ let f=all[uid].find(s=>s.code===code); if(f){ f.payout=pay; saveSlot(all); return sock.sendMessage(jid,{text:`✅ Payout ${f.name} -> ${pay}€`}) } }
        }

        // MONEY / ACC
        else if (lower.startsWith('/addmoney')) { let a=parseInt(lower.split(' ')[1])||100000; let db=getMoney(); db[jid]=(db[jid]||0)+a; saveMoney(db); await sock.sendMessage(jid,{text:`+${a}€ Saldo: ${db[jid]}€`}) }
        else if (lower === '/acc') { let db=getMoney(); await sock.sendMessage(jid,{text:`*🏦 Saldo: ${(db[jid]||0).toLocaleString()}€*`}) }
    })
}
startBot()
setInterval(()=>{},1000*60*4)

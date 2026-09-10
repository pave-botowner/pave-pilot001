import { Telegraf } from 'telegraf';

const bot = new Telegraf(process.env.BOT_TOKEN);

// DATABASE SEMPLICE IN MEMORIA (poi lo facciamo con file)
const db = {
  users: {}
};

function getUser(id) {
  if (!db.users[id]) {
    db.users[id] = { cars: [], slots: [], aura: 0, balance: 1000 };
  }
  return db.users[id];
}

// START
bot.start((ctx) => ctx.reply('Yo PAVE! Bot online 🔥 Scrivi /menu'));

// MENU PRINCIPALE - I 4 HOLY
bot.command('menu', (ctx) => {
  ctx.reply(
`🏁 PAVE PILOT - MAIN MENU

/carm - Menu Macchine
/slotm - Menu Slot
/funm - Menu Fun
/utym - Menu Utility

Scrivi un comando per aprire un holy!`
  );
});

// CARM
bot.command('carm', (ctx) => {
  ctx.reply(
`🚗 CAR MENU - /carm

/cars - Le tue macchine
/carshop - Negozio macchine
/buycar <nome> - Compra
/sellcar <nome> - Vendi`
  );
});

bot.command('cars', (ctx) => {
  const u = getUser(ctx.from.id);
  ctx.reply(u.cars.length? `Le tue cars: ${u.cars.join(', ')}` : 'Non hai cars, vai su /carshop');
});

bot.command('carshop', (ctx) => {
  ctx.reply('CARSHOP:\n- Panda - 500\n- M3 - 2000\n- Supra - 5000\nUsa /buycar <nome>');
});

bot.command('buycar', (ctx) => {
  const name = ctx.message.text.split(' ')[1];
  if(!name) return ctx.reply('Usa: /buycar <nome>');
  const u = getUser(ctx.from.id);
  u.cars.push(name);
  ctx.reply(`Hai comprato ${name}! 🏁`);
});

// SLOTM
bot.command('slotm', (ctx) => {
  ctx.reply(
`🎰 SLOT MENU - /slotm

/slot - Vedi i tuoi slot
/slotshop - Compra slot
/buyslot - Compra slot
/sellslot - Vendi slot`
  );
});

bot.command('slot', (ctx) => {
  const u = getUser(ctx.from.id);
  ctx.reply(`Hai ${u.slots.length} slot`);
});

// FUNM
bot.command('funm', (ctx) => {
  ctx.reply(
`🎲 FUN MENU - /funm

/luck - Testa la fortuna
/aura - Aura random
/myaura - La tua aura`
  );
});

bot.command('luck', (ctx) => {
  const luck = Math.floor(Math.random()*100);
  ctx.reply(`La tua fortuna: ${luck}% 🍀`);
});

bot.command('aura', (ctx) => {
  const u = getUser(ctx.from.id);
  const add = Math.floor(Math.random()*50);
  u.aura += add;
  ctx.reply(`+${add} aura! Ora hai ${u.aura}`);
});

bot.command('myaura', (ctx) => {
  const u = getUser(ctx.from.id);
  ctx.reply(`La tua aura: ${u.aura} ✨`);
});

// UTYM - QUELLO CHE VOLEVI SISTEMARE
bot.command('utym', (ctx) => {
  ctx.reply(
`🛠️ UTY MENU - /utym

/stick - Sticker
/frame - Frame per foto profilo
/pinall - Pinna tutto
/myacc - Il tuo account`
  );
});

bot.command('frame', (ctx) => ctx.reply('FRAME: manda una foto e ti metto il frame PAVE! (arriva presto) 🖼️'));
bot.command('pinall', (ctx) => ctx.reply('PINALL: dovrei pinnare tutto 😎 (serve admin)'));
bot.command('myacc', (ctx) => {
  const u = getUser(ctx.from.id);
  ctx.reply(`ACCOUNT:\nID: ${ctx.from.id}\nCars: ${u.cars.length}\nAura: ${u.aura}\nBalance: ${u.balance}`);
});

bot.launch();
console.log('PAVE BOT ONLINE');

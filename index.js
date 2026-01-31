require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const OpenAI = require('openai');

const LEVELS = [
  { level: 1, min: 0 },
  { level: 2, min: 50 },
  { level: 3, min: 120 },
  { level: 4, min: 250 },
  { level: 5, min: 500 }
];

function calculateLevel(points) {
  let current = 1;
  for (const l of LEVELS) {
    if (points >= l.min) current = l.level;
  }
  return current;
}


const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

const User = require('./models/User');

const bot = new Telegraf(process.env.BOT_TOKEN);

// DeepSeek (OpenAI-compatible)
const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com'
});

// simple in-memory store
const users = {};

bot.start((ctx) => {
  users[ctx.from.id] = { step: 1 };
  ctx.reply(
    "👋 Hey, I’m Coach Leo.\n" +
    "I’ll help you reach your goal step by step.\n\n" +
    "🎯 What’s your main goal?"
  );
});

bot.on('text', async (ctx) => {
  const user = users[ctx.from.id];
  if (!user) return;

  const text = ctx.message.text;

  switch (user.step) {
    case 1:
      user.goal = text;
      user.step = 2;
      return ctx.reply("⏳ When do you want to achieve it? (date or weeks)");

    case 2:
      user.deadline = text;
      user.step = 3;
      return ctx.reply(
        "⏱ How much time can you give daily?",
        Markup.keyboard([['15 min', '30 min', '60 min']]).oneTime().resize()
      );

    case 3:
      user.time = text;
      user.step = 4;
      return ctx.reply(
        "🔥 How strict should I be?",
        Markup.keyboard([['Soft', 'Balanced', 'Tough']]).oneTime().resize()
      );

   case 4:
  user.style = text;
  user.step = 999;

  await User.findOneAndUpdate(
    { telegramId: ctx.from.id },
    {
      telegramId: ctx.from.id,
      goal: user.goal,
      deadline: user.deadline,
      time: user.time,
      style: user.style
    },
    { upsert: true, new: true }
  );

  return sendDailyTask(ctx);
  }
});

async function generateDailyTask(user) {
  const prompt = `
You are Coach Leo, a tough but supportive personal coach.

User goal: ${user.goal}
Deadline: ${user.deadline}
Daily time available: ${user.time}
Coaching style: ${user.style}

Rules you MUST follow:
- The task MUST fit strictly within ${user.time}
- NEVER exceed the time limit
- If unsure, make the task smaller, not bigger
- The task must be doable today

Create ONE personalized daily task that:
- Is concrete and actionable
- Moves the user closer to the goal
- Builds discipline and momentum

Format exactly like this:
Task:
Why:
Estimated time:

`;

  const response = await openai.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7
  });

  return response.choices[0].message.content;
}

async function sendDailyTask(ctx) {
  const user = users[ctx.from.id];
  const task = await generateDailyTask(user);

  ctx.reply(
    `🎯 *Today’s Task*\n\n${task}`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        Markup.button.callback('✅ Done', 'done'),
        Markup.button.callback('⏭ Skip', 'skip')
      ])
    }
  );
}

bot.action('done', async (ctx) => {
  const user = await User.findOne({ telegramId: ctx.from.id });

  if (!user) {
  await ctx.answerCbQuery();
  return ctx.reply("⚠️ Please restart with /start");
}

  // prevent double completion
  if (user.taskCompletedToday) {
    await ctx.answerCbQuery();
    return ctx.reply("⚠️ You already completed today’s task.");
  }


  user.streak += 1;

  const reward = user.streak >= 3 ? 15 : 10;
  user.points += reward;
  user.lastAction = 'done';

  user.taskCompletedToday = true;
  user.lastTaskDate = new Date();


  const oldLevel = user.level;
  user.level = calculateLevel(user.points);

  await user.save();

  ctx.answerCbQuery();

  let message = `✅ Task completed!\n+${reward} points\n🔥 Streak: ${user.streak} days`;

  if (user.level > oldLevel) {
    message += `\n\n🏆 LEVEL UP!\nYou are now Level ${user.level}`;
  }

  ctx.reply(message);
});


bot.action('skip', async (ctx) => {
  const user = await User.findOne({ telegramId: ctx.from.id });

  if (!user) {
  await ctx.answerCbQuery();
  return ctx.reply("⚠️ Please restart with /start");
}

  const penalty = user.lastAction === 'skip' ? 20 : 10;

  user.points = Math.max(0, user.points - penalty);
  user.streak = 0;
  user.lastAction = 'skip';

  const oldLevel = user.level;
  user.level = calculateLevel(user.points);

  await user.save();

  ctx.answerCbQuery();

  let message = `⏭ Task skipped.\n−${penalty} points\nStreak reset.`;

  if (user.level < oldLevel) {
    message += `\n\n⬇️ Level dropped to ${user.level}`;
  }

  ctx.reply(message);
});


// EXPRESS FIRST
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Coach Leo is alive 🚀');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

// THEN BOT
bot.launch();
console.log('Coach Leo is running 🚀');


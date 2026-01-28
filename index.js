require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const OpenAI = require('openai');

const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

const UserSchema = new mongoose.Schema({
  telegramId: { type: String, unique: true },
  goal: String,
  deadline: String,
  time: String,
  style: String,
  lastAction: String,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);



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

bot.action('done', (ctx) => {
  ctx.answerCbQuery('Nice work 💪');
  ctx.reply("Great job. Tomorrow I’ll raise the bar slightly.");
});

bot.action('skip', (ctx) => {
  ctx.answerCbQuery('No worries');
  ctx.reply("Got it. Tomorrow we’ll go smaller, not easier.");
});

bot.launch();
console.log('Coach Leo is running 🚀');

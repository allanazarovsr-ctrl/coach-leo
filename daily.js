require('dotenv').config();
const mongoose = require('mongoose');
const { Telegraf } = require('telegraf');
const OpenAI = require('openai');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Mongo
mongoose.connect(process.env.MONGODB_URI);

// User model (must MATCH index.js)
const User = mongoose.model('User', new mongoose.Schema({
  telegramId: String,
  goal: String,
  deadline: String,
  time: String,
  style: String,
  taskCompletedToday: Boolean,
  lastTaskDate: Date
}));

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com'
});

async function generateDailyTask(user) {
  const prompt = `
User goal: ${user.goal}
Deadline: ${user.deadline}
Daily time: ${user.time}
Style: ${user.style}

Create ONE task for today.
Format:
Task:
Why:
Estimated time:
`;

  const res = await openai.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7
  });

  return res.choices[0].message.content;
}

(async () => {
  console.log('Daily cron started');

  const users = await User.find();

  for (const user of users) {
    const today = new Date().toDateString();

    if (user.lastTaskDate?.toDateString() === today) continue;

    const task = await generateDailyTask(user);

    await bot.telegram.sendMessage(
      user.telegramId,
      `🎯 *Today’s Task*\n\n${task}`,
      { parse_mode: 'Markdown' }
    );

    user.lastTaskDate = new Date();
    user.taskCompletedToday = false;
    await user.save();
  }

  console.log('Daily cron finished');
  process.exit(0);
})();


require('dotenv').config();
const mongoose = require('mongoose');
const { Telegraf } = require('telegraf');
const OpenAI = require('openai');

// ===== DB =====
mongoose.connect(process.env.MONGODB_URI);

// ===== BOT =====
const bot = new Telegraf(process.env.BOT_TOKEN);

// ===== AI =====
const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com'
});

// ===== MODEL (reuse same schema) =====
const User = mongoose.model('User');

// ===== TASK GEN =====
async function generateDailyTask(user) {
  const prompt = `
User goal: ${user.goal}
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
    messages: [{ role: 'user', content: prompt }]
  });

  return res.choices[0].message.content;
}

// ===== CRON ENTRY =====
(async () => {
  const users = await User.find();

  for (const user of users) {
    const task = await generateDailyTask(user);

    await bot.telegram.sendMessage(
      user.telegramId,
      `🌅 *Today's Task*\n\n${task}`,
      { parse_mode: 'Markdown' }
    );

    user.taskCompletedToday = false;
    user.lastTaskDate = new Date();
    await user.save();
  }

  console.log('✅ Daily tasks sent');
  process.exit(0);
})();

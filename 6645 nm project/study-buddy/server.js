require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const { Topic, Session, Quiz, Attempt } = require('./models');
const { generateQuiz } = require('./ai');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const wrap = fn => (req, res) => fn(req, res).catch(e => {
  console.error(e);
  res.status(e.status || 500).json({ error: e.message });
});
const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });

// ---- Topics ----
app.get('/api/topics', wrap(async (req, res) => {
  res.json(await Topic.find().sort({ createdAt: -1 }));
}));

app.post('/api/topics', wrap(async (req, res) => {
  const { subject, title, notes } = req.body;
  if (!subject || !title) throw bad('subject and title are required');
  res.status(201).json(await Topic.create({ subject, title, notes }));
}));

app.put('/api/topics/:id', wrap(async (req, res) => {
  const { subject, title, notes } = req.body;
  const t = await Topic.findByIdAndUpdate(req.params.id, { subject, title, notes }, { new: true });
  if (!t) throw bad('topic not found', 404);
  res.json(t);
}));

app.delete('/api/topics/:id', wrap(async (req, res) => {
  const id = req.params.id;
  await Promise.all([Topic.findByIdAndDelete(id), Session.deleteMany({ topic: id }),
    Quiz.deleteMany({ topic: id }), Attempt.deleteMany({ topic: id })]);
  res.json({ ok: true });
}));

// ---- Study sessions ----
app.post('/api/sessions', wrap(async (req, res) => {
  const { topicId, minutes, note } = req.body;
  const mins = Number(minutes);
  if (!topicId || !(mins > 0)) throw bad('topicId and positive minutes are required');
  const topic = await Topic.findByIdAndUpdate(topicId, { $inc: { minutesStudied: mins } }, { new: true });
  if (!topic) throw bad('topic not found', 404);
  res.status(201).json(await Session.create({ topic: topicId, minutes: mins, note }));
}));

app.get('/api/sessions', wrap(async (req, res) => {
  res.json(await Session.find().sort({ date: -1 }).limit(50).populate('topic', 'title subject'));
}));

// ---- Quizzes ----
app.post('/api/topics/:id/quiz', wrap(async (req, res) => {
  const topic = await Topic.findById(req.params.id);
  if (!topic) throw bad('topic not found', 404);
  const count = Math.min(Math.max(parseInt(req.body.count) || 5, 1), 15);
  const { source, questions } = await generateQuiz(topic, count);
  if (!questions.length) throw bad('Could not build a quiz. Add more detailed notes (a few full sentences) or set GEMINI_API_KEY.');
  const quiz = await Quiz.create({ topic: topic._id, source, questions });
  // never send the answers to the client
  res.status(201).json({
    _id: quiz._id, source,
    questions: quiz.questions.map(q => ({ q: q.q, options: q.options }))
  });
}));

app.post('/api/quizzes/:id/submit', wrap(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id);
  if (!quiz) throw bad('quiz not found', 404);
  const answers = req.body.answers || [];
  let score = 0; const wrong = [];
  quiz.questions.forEach((q, i) => {
    if (answers[i] === q.answer) score++;
    else wrong.push({ q: q.q, chosen: q.options[answers[i]] ?? '(skipped)', correct: q.options[q.answer], explanation: q.explanation });
  });
  const total = quiz.questions.length;
  const pct = Math.round((score / total) * 100);
  const topic = await Topic.findById(quiz.topic);
  if (topic) {
    topic.mastery = topic.attempts ? Math.round(topic.mastery * 0.5 + pct * 0.5) : pct;
    topic.attempts += 1;
    await topic.save();
  }
  await Attempt.create({ topic: quiz.topic, quiz: quiz._id, score, total, wrong });
  res.json({ score, total, percent: pct, wrong, mastery: topic?.mastery });
}));

// ---- Stats ----
app.get('/api/stats', wrap(async (req, res) => {
  const [topics, sessions, attempts] = await Promise.all([
    Topic.find(), Session.find().sort({ date: -1 }), Attempt.find().sort({ date: -1 }).limit(20).populate('topic', 'title')
  ]);
  const days = new Set(sessions.map(s => s.date.toISOString().slice(0, 10)));
  let streak = 0; const d = new Date();
  if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1); // today not yet studied is OK
  while (days.has(d.toISOString().slice(0, 10))) { streak++; d.setDate(d.getDate() - 1); }
  const sorted = [...topics].filter(t => t.attempts).sort((a, b) => a.mastery - b.mastery);
  res.json({
    totalMinutes: topics.reduce((n, t) => n + t.minutesStudied, 0),
    streak,
    quizzesTaken: await Attempt.countDocuments(),
    weakest: sorted.slice(0, 3).map(t => ({ title: t.title, mastery: t.mastery })),
    strongest: sorted.slice(-3).reverse().map(t => ({ title: t.title, mastery: t.mastery })),
    recentAttempts: attempts.map(a => ({ topic: a.topic?.title, score: a.score, total: a.total, date: a.date }))
  });
}));

const PORT = process.env.PORT || 3000;
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/studybuddy')
  .then(() => app.listen(PORT, () => console.log(`Study Buddy running: http://localhost:${PORT}`)))
  .catch(e => { console.error('MongoDB connection failed:', e.message); process.exit(1); });

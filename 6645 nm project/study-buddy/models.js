const mongoose = require('mongoose');
const { Schema } = mongoose;

const Topic = mongoose.model('Topic', new Schema({
  subject: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true },
  notes: { type: String, default: '' },
  minutesStudied: { type: Number, default: 0 },
  mastery: { type: Number, default: 0 },      // 0-100, updated by quiz results
  attempts: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
}));

const Session = mongoose.model('Session', new Schema({
  topic: { type: Schema.Types.ObjectId, ref: 'Topic', required: true },
  minutes: { type: Number, required: true, min: 1 },
  note: String,
  date: { type: Date, default: Date.now }
}));

const Quiz = mongoose.model('Quiz', new Schema({
  topic: { type: Schema.Types.ObjectId, ref: 'Topic', required: true },
  source: String, // 'ai' or 'fallback'
  questions: [{ q: String, options: [String], answer: Number, explanation: String }],
  createdAt: { type: Date, default: Date.now }
}));

const Attempt = mongoose.model('Attempt', new Schema({
  topic: { type: Schema.Types.ObjectId, ref: 'Topic', required: true },
  quiz: { type: Schema.Types.ObjectId, ref: 'Quiz' },
  score: Number,
  total: Number,
  wrong: [{ q: String, chosen: String, correct: String, explanation: String }],
  date: { type: Date, default: Date.now }
}));

module.exports = { Topic, Session, Quiz, Attempt };

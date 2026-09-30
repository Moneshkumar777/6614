# Study Buddy

Track study time per topic, then quiz yourself on your notes to see what actually stuck.

## Run (about 1 minute)
1. Have Node 18+ and MongoDB running (local, or a free Atlas URI).
2. `npm install`
3. `cp .env.example .env` and edit if needed (set `MONGO_URI`; optionally `GEMINI_API_KEY` for AI-written quizzes; free key at https://aistudio.google.com/apikey)
4. `npm start`, then open http://localhost:3000

## How it works
- **Topics**: add subject, title, notes.
- **Log study**: record minutes per topic; streak and totals update.
- **Take a quiz**: Google Gemini (or the fallback generator) builds questions from your notes; answers stay on the server, and wrong answers come back with explanations.
- **Progress**: mastery per topic (blends past and latest quiz scores), weakest topics, streak, quiz history.

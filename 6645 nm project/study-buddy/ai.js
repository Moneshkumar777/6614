// Quiz generation: Google Gemini API if a key is set, otherwise a simple fill-in-the-blank fallback.
const shuffle = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1]);

async function generateWithGemini(topic, count) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const prompt = `Write ${count} multiple-choice questions testing real understanding of this topic.
Subject: ${topic.subject}
Topic: ${topic.title}
Study notes:
${topic.notes || '(no notes; use general knowledge of the topic)'}

Return ONLY a JSON array in this format:
[{"q":"...","options":["A","B","C","D"],"answer":0,"explanation":"..."}]
"answer" is the index (0-3) of the correct option. Exactly 4 options each.`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.7 }
    })
  });
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').replace(/```json|```/g, '').trim();
  const qs = JSON.parse(text);
  return qs.filter(x => x.q && Array.isArray(x.options) && x.options.length >= 2 && Number.isInteger(x.answer) && x.answer < x.options.length);
}

function generateFallback(topic, count) {
  const sentences = (topic.notes || '').split(/(?<=[.!?])\s+|\n+/).filter(s => s.trim().split(/\s+/).length >= 6);
  const clean = w => w.replace(/[^\p{L}\p{N}-]/gu, '');
  const pool = [...new Set((topic.notes || '').split(/\s+/).map(clean).filter(w => w.length >= 5))];
  if (sentences.length === 0 || pool.length < 4) return [];
  return shuffle(sentences).slice(0, count).map(s => {
    const words = s.split(/\s+/);
    const target = words.map(clean).sort((a, b) => b.length - a.length)[0];
    const q = 'Fill in the blank: ' + s.replace(new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), '_____');
    const distractors = shuffle(pool.filter(w => w.toLowerCase() !== target.toLowerCase())).slice(0, 3);
    const options = shuffle([target, ...distractors]);
    return { q, options, answer: options.indexOf(target), explanation: `From your notes: "${s.trim()}"` };
  });
}

async function generateQuiz(topic, count = 5) {
  if (process.env.GEMINI_API_KEY) {
    try {
      const questions = await generateWithGemini(topic, count);
      if (questions.length) return { source: 'ai', questions };
    } catch (e) { console.warn('AI quiz failed, using fallback:', e.message); }
  }
  return { source: 'fallback', questions: generateFallback(topic, count) };
}

module.exports = { generateQuiz };

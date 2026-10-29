// Naadamy багш: local Ollama model-г Node-оос дуудах жишээ (Node 18+, нэмэлт сангүй).
// Урьдчилсан нөхцөл: `ollama create naadamy -f Modelfile` хийгдсэн, Ollama ажиллаж байх.
// Ажиллуулах: node ollama_example.mjs "Наадам гэж юу вэ?"

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL || "naadamy";

export async function askTeacher(question, { timeoutMs = 60000 } = {}) {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      messages: [{ role: "user", content: question }],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.message.content;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const question = process.argv[2] || "Наадам гэж юу вэ?";
  askTeacher(question)
    .then((answer) => console.log(answer))
    .catch((err) => {
      console.error("Алдаа:", err.message);
      process.exit(1);
    });
}

# Алхам B: base model-уудыг Монгол хэлээр шалгах. Google Colab (T4) дээр ажиллуулна.
# Colab-д эхний cell: !pip install unsloth
# Үр дүн: model_test_results.md (хариулт бүрийг "зөв/буруу" гэж гараар үнэлнэ)

import gc, torch
from unsloth import FastLanguageModel

# Нэр шалгах: Unsloth-ийн HF хуудаст эдгээр repo байгаа эсэхийг батлах (нэр өөрчлөгдсөн байж болно).
# Llama 3B, Qwen 2.5 3B нь Монгол хэлээр утгагүй хариулсан (бүгд буруу), тиймээс хаясан.
MODELS = [
    "unsloth/gemma-3-4b-it-unsloth-bnb-4bit",
]

SYSTEM = "Чи Монгол өв соёлын багш. Хүүхдэд ойлгомжтой, энгийн Монгол хэлээр хариул. Мэдэхгүй зүйлээ мэдэхгүй гэж хэл."

# (асуулт, зөв хариулт - таны naadam_unesco_medeelel.md-ээс)
QUESTIONS = [
    ("Наадам гэж юу вэ?", "Монголын уламжлалт баяр; эрийн гурван наадам"),
    ("Эрийн гурван наадам гэж юу юу вэ?", "бөх, морь урлаа (морин уралдаан), сур харваа"),
    ("Наадам жил бүр хэдний өдөр болдог вэ?", "7-р сарын 11-13 (UNESCO)"),
    ("UNESCO Наадмыг хэдэн онд соёлын өвөөр бүртгэсэн бэ?", "2010"),
    ("Бөхийн хувцас юу юу вэ?", "зодог, шуудаг, монгол гутал"),
    ("Монгол бөхөд жингийн ангилал байдаг уу?", "Үгүй, байхгүй"),
    ("Девэх гэж юу вэ?", "бөхчүүдийн бүргэдийн бүжиг"),
    ("Монгол бөхийн хамгийн дээд цол юу вэ?", "аварга"),
    ("Эмэгтэй хүн Наадмын бөхөд оролцдог уу?", "Үгүй"),
    ("Наадмын бөх яагаад хоёр дахь удаагаа 1789 онд аварга болсон бэ?", "Мэдэхгүй гэх ёстой (хуурамч асуулт: hallucination шалгалт)"),
]

out = ["# Base model шалгалт (гараар үнэлнэ: ✅ зөв / ⚠️ хагас / ❌ буруу)\n"]
for name in MODELS:
    out.append(f"\n## {name}\n")
    try:
        model, tok = FastLanguageModel.from_pretrained(name, max_seq_length=1024, load_in_4bit=True)
        FastLanguageModel.for_inference(model)
        tok = getattr(tok, "tokenizer", tok)  # Gemma 3 нь processor буцаадаг, дотор нь tokenizer байна
        for q, key in QUESTIONS:
            msgs = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": q}]
            text = tok.apply_chat_template(msgs, add_generation_prompt=True, tokenize=False)
            ids = tok(text, add_special_tokens=False, return_tensors="pt").input_ids.to("cuda")
            gen = model.generate(input_ids=ids, max_new_tokens=200, do_sample=False, repetition_penalty=1.1)
            ans = tok.decode(gen[0][ids.shape[1]:], skip_special_tokens=True).strip()
            out.append(f"**Асуулт:** {q}\n- Зөв хариулт: {key}\n- Model: {ans}\n- Үнэлгээ: ?\n")
            print(f"[{name}] {q}\n  -> {ans}\n")
        del model, tok
    except Exception as e:  # model нэр буруу эсвэл санах ой дутвал дараагийнх руу
        out.append(f"АЛДАА: {e}\n")
        print("АЛДАА", name, e)
    gc.collect(); torch.cuda.empty_cache()

open("model_test_results.md", "w", encoding="utf-8").write("\n".join(out))
print("Дууслаа: model_test_results.md")

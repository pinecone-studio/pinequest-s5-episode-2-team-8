# Naadamy багш model: Llama 3.2 3B Instruct + LoRA (Unsloth). Google Colab (T4) дээр ажиллуулна.
# Colab-д эхний cell-д: !pip install unsloth   (дараа нь файлаа upload хийж, энэ кодыг cell-үүдэд хуваан ажиллуулна)

from unsloth import FastLanguageModel
from unsloth.chat_templates import get_chat_template
from datasets import load_dataset
from trl import SFTTrainer, SFTConfig

MODEL = "unsloth/Llama-3.2-3B-Instruct-bnb-4bit"  # 4-bit (QLoRA)
MAX_LEN = 1024

# 1) Model ачаалах
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name=MODEL, max_seq_length=MAX_LEN, load_in_4bit=True,
)

# 2) LoRA adapter нэмэх
model = FastLanguageModel.get_peft_model(
    model,
    r=64, lora_alpha=64, lora_dropout=0,  # 2-р оролдлого: rank 16 -> 64 (илүү их баримт тогтооно)
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    use_gradient_checkpointing="unsloth",
    random_state=3407,
)

# 3) Dataset: 90% сургалт, 10% шалгалт
tokenizer = get_chat_template(tokenizer, chat_template="llama-3.1")
ds = load_dataset("json", data_files="naadamy_data_train.jsonl", split="train")  # Colab-д upload хийнэ
ds = ds.train_test_split(test_size=0.1, seed=42)

def fmt(batch):
    return {"text": [tokenizer.apply_chat_template(m, tokenize=False) for m in batch["messages"]]}

train_ds = ds["train"].map(fmt, batched=True)
eval_ds = ds["test"].map(fmt, batched=True)

# 4) Сургах. 1-р оролдлого 3 epoch дээр model сураагүй (4/4 буруу) тул 8 epoch болгов.
#    Eval loss өсөж эхэлбэл (train loss буурсаар байхад) overfit: тэр epoch-д зогсоно.
trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=train_ds,
    eval_dataset=eval_ds,
    args=SFTConfig(
        dataset_text_field="text",
        max_seq_length=MAX_LEN,
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        num_train_epochs=8,
        learning_rate=2e-4,
        logging_steps=1,
        eval_strategy="epoch",
        output_dir="outputs",
        report_to="none",
    ),
)
trainer.train()

# 4b) Түргэн шалгалт (сургалтад орсон асуулт тул бүрэн шалгалт биш; жинхэнэ шалгалт нь алхам D)
FastLanguageModel.for_inference(model)
SYSTEM = "Чи Naadamy тоглоомын Монгол өв соёлын багш. Хүүхдэд ойлгомжтой, энгийн Монгол хэлээр хариул. Мэдэхгүй зүйлээ мэдэхгүй гэж хэл."
for q in ["Наадам гэж юу вэ?", "Бөхийн хувцас юу юу вэ?", "Монгол бөхийн хамгийн дээд цол юу вэ?",
          "Наадмын бөх яагаад хоёр дахь удаагаа 1789 онд аварга болсон бэ?"]:
    msgs = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": q}]
    ids = tokenizer.apply_chat_template(msgs, add_generation_prompt=True, return_tensors="pt").to("cuda")
    out = model.generate(input_ids=ids, max_new_tokens=150, do_sample=False, repetition_penalty=1.1)
    print(q, "->", tokenizer.decode(out[0][ids.shape[1]:], skip_special_tokens=True), "\n")

# 5) Хадгалах + GGUF (Ollama-д зориулсан q4_k_m)
model.save_pretrained("naadamy_lora")
tokenizer.save_pretrained("naadamy_lora")
model.save_pretrained_gguf("naadamy_gguf", tokenizer, quantization_method="q4_k_m")

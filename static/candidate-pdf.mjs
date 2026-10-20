// The questionnaire is parsed locally. Its bytes are never uploaded.
function candidatePdfError(message) {
  const error = new Error(message);
  error.userFacing = true;
  return error;
}

export function candidateFromText(text) {
  const match = (pattern) => text.match(pattern)?.[1]?.trim() || "";
  const cleanName = (value) => value.replace(/\s+(Да|Нет)$/iu, "").trim();
  const name = cleanName(match(/Фамилия\s+Имя\s*\n([^\n]+)/iu));
  let patronymic = cleanName(match(/Отчество\s+Отсутствует\s*\n([^\n]+)/iu));
  if (/^(нет|да|---|отсутствует)$/iu.test(patronymic)) patronymic = "";
  const result = {
    full_name: [name, patronymic].filter(Boolean).join(" "),
    birth_date: match(/Дата рождения\s+Гражданство\s*\n(\d{2}\.\d{2}\.\d{4})/iu),
    gender: match(/Пол\s+Вы меняли[^\n]*\n(Мужской|Женский)/iu),
    oms_number: match(/Номер полиса ОМС\s*\n([\d\s-]+)/iu).replace(/\D/g, ""),
    warnings: [],
  };
  const missing = [["ФИО", result.full_name], ["дата рождения", result.birth_date],
    ["пол", result.gender], ["номер полиса ОМС", result.oms_number]]
    .filter(([, value]) => !value).map(([label]) => label);
  if (missing.length) result.warnings.push(`Не удалось автоматически определить: ${missing.join(", ")}.`);
  return result;
}

export function textFromItems(items) {
  const rows = [];
  const pieces = items.filter((item) => item.str?.trim())
    .sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]);
  for (const item of pieces) {
    const y = item.transform[5];
    let row = rows.at(-1);
    if (!row || Math.abs(row.y - y) > 3) {
      row = { y, items: [] };
      rows.push(row);
    }
    row.items.push(item);
  }
  return rows.map((row) => row.items.sort((a, b) => a.transform[4] - b.transform[4])
    .map((item) => item.str).join(" ").replace(/[^\S\n]+/g, " ").trim()).join("\n");
}

export async function readPageTextItems(page, signal) {
  const reader = page.streamTextContent().getReader();
  const items = [];
  try {
    while (true) {
      signal?.throwIfAborted();
      const { value, done } = await reader.read();
      if (done) return items;
      items.push(...value.items);
    }
  } finally {
    reader.releaseLock();
  }
}

export async function parseCandidatePdf(file, { signal } = {}) {
  if (!file.name?.toLowerCase().endsWith(".pdf")) throw candidatePdfError("Выберите PDF-анкету.");
  if (file.size > 20 * 1024 * 1024) throw candidatePdfError("PDF превышает допустимый размер 20 МБ.");
  signal?.throwIfAborted();
  let task;
  let timedOut = false;
  let timer;
  const stop = () => { if (task) void task.destroy().catch(() => {}); };
  try {
    const pdfjs = await import("./vendor/pdfjs/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdfjs/pdf.worker.mjs", import.meta.url).href;
    const data = new Uint8Array(await file.arrayBuffer());
    signal?.throwIfAborted();
    task = pdfjs.getDocument({ data, isEvalSupported: false, useWorkerFetch: false,
      disableFontFace: true, useSystemFonts: false });
    timer = setTimeout(() => { timedOut = true; stop(); }, 30000);
    signal?.addEventListener("abort", stop, { once: true });
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const items = await readPageTextItems(page, signal);
    const text = textFromItems(items);
    signal?.throwIfAborted();
    if (!text.trim()) throw candidatePdfError("В PDF не найден текст. Заполните данные вручную.");
    return candidateFromText(text);
  } catch (error) {
    signal?.throwIfAborted();
    if (timedOut) throw candidatePdfError("Обработка PDF заняла слишком много времени. Заполните данные вручную.");
    if (error.name === "PasswordException") throw candidatePdfError("PDF защищён паролем. Выберите файл без пароля или заполните данные вручную.");
    if (error.name === "InvalidPDFException") throw candidatePdfError("Не удалось прочитать PDF. Проверьте файл или заполните данные вручную.");
    if (error.userFacing) throw error;
    throw candidatePdfError("Не удалось обработать PDF-анкету. Проверьте файл или заполните данные вручную.");
  } finally {
    if (timer) clearTimeout(timer);
    signal?.removeEventListener("abort", stop);
    if (task) await task.destroy().catch(() => {});
  }
}

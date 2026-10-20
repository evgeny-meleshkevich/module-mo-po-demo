import assert from "node:assert/strict";
import test from "node:test";

import { candidateFromText, parseCandidatePdf, readPageTextItems, textFromItems } from "../static/candidate-pdf.mjs";

test("PDF text extraction works without ReadableStream async iteration", async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue({ items: [
        { str: "Фамилия Имя", transform: [1, 0, 0, 1, 10, 80] },
        { str: "Примерный Пример", transform: [1, 0, 0, 1, 10, 70] },
      ] });
      controller.enqueue({ items: [
        { str: "Отчество Отсутствует", transform: [1, 0, 0, 1, 10, 60] },
        { str: "Примерович", transform: [1, 0, 0, 1, 10, 50] },
      ] });
      controller.close();
    },
  });
  Object.defineProperty(stream, Symbol.asyncIterator, { value: undefined });
  assert.equal(stream[Symbol.asyncIterator], undefined);

  const items = await readPageTextItems({ streamTextContent: () => stream });
  assert.equal(candidateFromText(textFromItems(items)).full_name, "Примерный Пример Примерович");
});

test("invalid and unexpected PDF errors are presented in Russian", async () => {
  const badFile = {
    name: "sample.pdf",
    size: 3,
    arrayBuffer: async () => Uint8Array.of(1, 2, 3).buffer,
  };
  await assert.rejects(parseCandidatePdf(badFile), error =>
    error.userFacing === true &&
    error.message === "Не удалось прочитать PDF. Проверьте файл или заполните данные вручную."
  );
  const unreadableFile = {
    name: "sample.pdf",
    size: 3,
    arrayBuffer: async () => { throw new TypeError("internal browser failure"); },
  };
  await assert.rejects(parseCandidatePdf(unreadableFile), error =>
    error.userFacing === true &&
    error.message === "Не удалось обработать PDF-анкету. Проверьте файл или заполните данные вручную."
  );
});

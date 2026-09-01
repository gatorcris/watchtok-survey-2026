import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "docs/WatchTok_Enthusiast_Survey_Production_Draft_V7.md");
const output = resolve(root, "src/survey-data.js");
const lines = readFileSync(source, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/);

const sectionMap = new Map();
let currentSection = null;
for (let index = 0; index < lines.length; index += 1) {
  const sectionMatch = lines[index].match(/^## Section (\d+) — (.+)$/);
  if (sectionMatch) {
    currentSection = {
      number: Number(sectionMatch[1]),
      title: sectionMatch[2].trim()
    };
    sectionMap.set(currentSection.number, currentSection);
    continue;
  }
  if (lines[index].startsWith("# Production implementation notes")) break;
}

const questions = [];
for (let index = 0; index < lines.length; index += 1) {
  const idMatch = lines[index].match(/<!-- stable_id: (Q\d+) -->/);
  if (!idMatch) continue;
  const headingIndex = index + 1 + lines.slice(index + 1).findIndex((line) => /^### \d+\./.test(line));
  const heading = lines[headingIndex].match(/^### (\d+)\. (.+)$/);
  if (!heading) throw new Error(`Missing display heading after ${idMatch[1]}`);

  const previousSections = lines.slice(0, headingIndex).filter((line) => /^## Section \d+ —/.test(line));
  const sectionHeading = previousSections.at(-1).match(/^## Section (\d+) — (.+)$/);
  const question = {
    id: idMatch[1],
    display: Number(heading[1]),
    section: Number(sectionHeading[1]),
    sectionTitle: sectionHeading[2],
    label: heading[2].trim(),
    hint: "",
    statement: "",
    type: "single",
    maxSelections: null,
    options: []
  };

  let cursor = headingIndex + 1;
  while (cursor < lines.length && !/^(<!-- stable_id:|## Section|## Thank you|# Production)/.test(lines[cursor])) {
    const line = lines[cursor].trim();
    if (/^\*.+\*$/.test(line) && !question.hint) question.hint = line.slice(1, -1);
    if (/^> /.test(line) && !line.includes("You’ve") && !line.includes("You’re") && !line.includes("Final stretch")) {
      question.statement = line.slice(2).replaceAll("**", "").trim();
    }
    if (/^\*\*Select all that apply\.\*\*$/.test(line)) question.type = "multi";
    if (/^\*\*Select up to three\.\*\*$/.test(line)) {
      question.type = "multi";
      question.maxSelections = 3;
    }
    const option = line.match(/^(\d+)\. (.+)$/);
    if (option) question.options.push({ code: option[1], label: option[2].trim() });
    cursor += 1;
  }
  if (!question.options.length) throw new Error(`No options found for ${question.id}`);
  questions.push(question);
}

if (questions.length !== 43) throw new Error(`Expected 43 questions, found ${questions.length}`);

const content = `// Generated from the frozen V7 instrument. Do not hand-edit.\nexport const surveyQuestions = ${JSON.stringify(questions, null, 2)};\n`;
writeFileSync(output, content);
console.log(`Generated ${questions.length} questions at ${output}`);

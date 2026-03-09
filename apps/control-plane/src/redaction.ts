import { readFileSync } from "fs";
import { parse } from "yaml";
import { resolve } from "path";

interface RedactionRule {
  pattern: string;
  replacement: string;
  description: string;
}

let rules: RedactionRule[] = [];

try {
  const path = resolve("policies/redaction-rules.yml");
  const config = parse(readFileSync(path, "utf-8"));
  rules = [
    ...(config.regex_patterns || []).map((r: any) => ({
      pattern: r.pattern,
      replacement: r.replacement,
      description: r.description,
    })),
  ];
} catch { /* policies not yet deployed */ }

export function redactPublic(text: string): string {
  let result = text;
  for (const rule of rules) {
    try {
      result = result.replace(new RegExp(rule.pattern, "gi"), rule.replacement);
    } catch { /* invalid regex, skip */ }
  }
  return result;
}

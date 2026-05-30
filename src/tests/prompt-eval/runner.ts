import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildSystemPrompt } from '../../backend/prompts/build-system-prompt';
import { testShop } from './fixtures/test-shop';
import {
  hairSalonInboundScenarios,
  type EvalRule,
  type TestScenario,
} from './scenarios/hair-salon-inbound';

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';
const EVAL_CALLER_PHONE = '+15125550199';
const REQUEST_DELAY_MS = 300;

type OpenAiChatMessage = {
  role: 'system' | 'user';
  content: string;
};

type OpenAiChatResponse = {
  choices?: {
    message?: {
      content?: string | null;
    };
  }[];
  error?: {
    message?: string;
  };
};

type RuleResult = {
  description: string;
  pass: boolean;
  reason: string;
};

type ScenarioResult = {
  scenario: string;
  category: string;
  utterance: string;
  aiResponse: string;
  rules: RuleResult[];
  passed: boolean;
};

function loadLocalEnv(): void {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || line.trim().startsWith('#') || process.env[match[1]]) continue;

    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function getOpenAiApiKey(): string {
  loadLocalEnv();
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required to run prompt evals.');
  }
  return apiKey;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function callOpenAiChat(input: {
  apiKey: string;
  model: string;
  messages: OpenAiChatMessage[];
  maxTokens: number;
  temperature: number;
}): Promise<string> {
  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      max_tokens: input.maxTokens,
      temperature: input.temperature,
    }),
  });

  const body = (await response.json().catch(() => ({}))) as OpenAiChatResponse;
  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status} ${body.error?.message ?? response.statusText}`);
  }

  const content = body.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('OpenAI response did not include text content.');
  return content;
}

function getSystemPrompt(): string {
  return buildSystemPrompt({
    shop: testShop,
    customer: null,
    mode: 'inbound',
    callerPhone: EVAL_CALLER_PHONE,
  });
}

async function getAIResponse(input: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  callerUtterance: string;
}): Promise<string> {
  return callOpenAiChat({
    apiKey: input.apiKey,
    model: input.model,
    maxTokens: 300,
    temperature: 0.2,
    messages: [
      { role: 'system', content: input.systemPrompt },
      { role: 'user', content: input.callerUtterance },
    ],
  });
}

function evalStringRule(response: string, rule: EvalRule): { pass: boolean; reason: string } {
  const normalizedResponse = response.toLowerCase();
  const normalizedValue = rule.value?.toLowerCase() ?? '';

  if (rule.check === 'contains') {
    const pass = normalizedResponse.includes(normalizedValue);
    return { pass, reason: pass ? 'Found expected content' : `Missing: "${rule.value}"` };
  }

  if (rule.check === 'not_contains') {
    const pass = !normalizedResponse.includes(normalizedValue);
    return { pass, reason: pass ? 'Correctly absent' : `Should not contain: "${rule.value}"` };
  }

  if (rule.check === 'starts_with') {
    const pass = normalizedResponse.startsWith(normalizedValue);
    return { pass, reason: pass ? 'Starts correctly' : `Should start with: "${rule.value}"` };
  }

  return { pass: false, reason: 'Not a string rule' };
}

async function evalLlmJudge(input: {
  apiKey: string;
  model: string;
  response: string;
  rule: EvalRule;
}): Promise<{ pass: boolean; reason: string }> {
  if (!input.rule.prompt) return { pass: false, reason: 'Missing judge prompt' };

  const judgment = await callOpenAiChat({
    apiKey: input.apiKey,
    model: input.model,
    maxTokens: 10,
    temperature: 0,
    messages: [
      {
        role: 'system',
        content: 'You are an evaluator. Answer only YES or NO.',
      },
      {
        role: 'user',
        content: `Response to evaluate:\n"${input.response}"\n\nQuestion: ${input.rule.prompt}`,
      },
    ],
  });

  const answer = judgment.trim().toUpperCase().match(/\b(YES|NO)\b/)?.[1] ?? 'INVALID';
  const yesMeansFail = input.rule.prompt.includes('YES means FAIL');
  const pass = yesMeansFail ? answer === 'NO' : answer === 'YES';
  return { pass, reason: `Judge answered: ${answer}` };
}

async function evalRule(input: {
  apiKey: string;
  judgeModel: string;
  response: string;
  rule: EvalRule;
}): Promise<{ pass: boolean; reason: string }> {
  if (input.rule.check === 'llm_judge') {
    return evalLlmJudge({
      apiKey: input.apiKey,
      model: input.judgeModel,
      response: input.response,
      rule: input.rule,
    });
  }

  return evalStringRule(input.response, input.rule);
}

async function runScenario(input: {
  apiKey: string;
  model: string;
  judgeModel: string;
  systemPrompt: string;
  scenario: TestScenario;
}): Promise<ScenarioResult> {
  const aiResponse = await getAIResponse({
    apiKey: input.apiKey,
    model: input.model,
    systemPrompt: input.systemPrompt,
    callerUtterance: input.scenario.callerUtterance,
  });

  const rules: RuleResult[] = [];
  for (const rule of input.scenario.rules) {
    const result = await evalRule({
      apiKey: input.apiKey,
      judgeModel: input.judgeModel,
      response: aiResponse,
      rule,
    });
    rules.push({ description: rule.description, ...result });
  }

  return {
    scenario: input.scenario.id,
    category: input.scenario.category,
    utterance: input.scenario.callerUtterance,
    aiResponse,
    rules,
    passed: rules.every((rule) => rule.pass),
  };
}

async function runEval(): Promise<void> {
  const apiKey = getOpenAiApiKey();
  const model = process.env.PROMPT_EVAL_OPENAI_MODEL?.trim() || DEFAULT_MODEL;
  const judgeModel = process.env.PROMPT_EVAL_OPENAI_JUDGE_MODEL?.trim() || model;

  console.log('Building system prompt...');
  const systemPrompt = getSystemPrompt();
  console.log(`System prompt length: ${systemPrompt.length} chars`);
  console.log(`OpenAI model: ${model}`);
  console.log(`OpenAI judge model: ${judgeModel}\n`);

  const results: ScenarioResult[] = [];
  for (const scenario of hairSalonInboundScenarios) {
    process.stdout.write(`Testing: ${scenario.id}... `);
    const result = await runScenario({
      apiKey,
      model,
      judgeModel,
      systemPrompt,
      scenario,
    });
    process.stdout.write(result.passed ? 'PASS\n' : 'FAIL\n');
    results.push(result);
    await sleep(REQUEST_DELAY_MS);
  }

  console.log('\n=== EVAL REPORT ===\n');
  const passed = results.filter((result) => result.passed).length;
  const total = results.length;
  console.log(`Overall: ${passed}/${total} passed\n`);

  const categories = [...new Set(results.map((result) => result.category))];
  for (const category of categories) {
    const categoryResults = results.filter((result) => result.category === category);
    const categoryPassed = categoryResults.filter((result) => result.passed).length;
    console.log(`${category}: ${categoryPassed}/${categoryResults.length}`);
  }

  const failures = results.filter((result) => !result.passed);
  if (failures.length > 0) {
    console.log('\n=== FAILURES ===\n');
    for (const failure of failures) {
      console.log(`FAIL ${failure.scenario}`);
      console.log(`   Caller: "${failure.utterance}"`);
      console.log(`   AI said: "${failure.aiResponse.slice(0, 180)}${failure.aiResponse.length > 180 ? '...' : ''}"`);
      for (const rule of failure.rules.filter((result) => !result.pass)) {
        console.log(`   FAIL: ${rule.description} - ${rule.reason}`);
      }
      console.log();
    }
  }

  process.exitCode = failures.length > 0 ? 1 : 0;
}

runEval().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

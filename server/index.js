const express = require('express');
const cors = require('cors');
const { ChatOpenAI } = require('@langchain/openai');
const { HumanMessage, SystemMessage, AIMessage } = require('@langchain/core/messages');

const app = express();
app.use(cors());
app.use(express.json());

const prompts = {
  clarifier: 'You are Clarifier, an AI assistant that reformulates and clarifies user startup ideas. Generate a concise improved description and list any follow-up questions.',
  critic: 'You are Critic, a skeptical investor. Point out feasibility issues, market doubts and any missing information about the startup.',
  defender: 'You are Defender, the startup founder. Answer the critic and refine the idea addressing concerns in a constructive way.',
  investor: 'You are Investor, an angel willing to invest if the proposal looks promising. Summarize the final concept and reply strictly in JSON as {"startupPitch":{...},"investmentVerdict":{...}}.'
};

const TOKEN_PRICE = 0.002 / 1000; // Approx cost for gpt-3.5-turbo
const MAX_ROUNDS = 3;

async function callAgent(chat, systemPrompt, history) {
  const res = await chat.invoke([
    new SystemMessage(systemPrompt),
    ...history
  ]);
  const usage = res.usage_metadata || res.response_metadata?.tokenUsage || res.llmOutput?.tokenUsage || res.llmOutput?.estimatedTokenUsage || {};
  const tokens = usage.total_tokens || usage.totalTokens || 0;
  const cost = tokens * TOKEN_PRICE;
  return { text: res.content, tokens, cost };
}

async function runEvaluation(idea, apiKey, budget) {
  const chat = new ChatOpenAI({ openAIApiKey: apiKey, modelName: 'gpt-3.5-turbo' });
  const history = [new HumanMessage(idea)];
  const conversation = [];
  let cost = 0;
  let round = 1;

  const clarifier = await callAgent(chat, prompts.clarifier, history);
  conversation.push({ id: `clarifier-${Date.now()}`, agent: 'clarifier', content: clarifier.text, timestamp: new Date().toISOString(), round, cost: clarifier.cost });
  history.push(new AIMessage(clarifier.text));
  cost += clarifier.cost;

  while (round <= MAX_ROUNDS && cost < budget) {
    const critic = await callAgent(chat, prompts.critic, history);
    conversation.push({ id: `critic-${Date.now()}`, agent: 'critic', content: critic.text, timestamp: new Date().toISOString(), round, cost: critic.cost });
    history.push(new AIMessage(critic.text));
    cost += critic.cost;
    if (cost >= budget) break;

    const defender = await callAgent(chat, prompts.defender, history);
    conversation.push({ id: `defender-${Date.now()}`, agent: 'defender', content: defender.text, timestamp: new Date().toISOString(), round, cost: defender.cost });
    history.push(new AIMessage(defender.text));
    cost += defender.cost;
    if (cost >= budget) break;

    round += 1;
  }

  const investor = await callAgent(chat, prompts.investor, history);
  conversation.push({ id: `investor-${Date.now()}`, agent: 'investor', content: investor.text, timestamp: new Date().toISOString(), round, cost: investor.cost });
  cost += investor.cost;
  const summary = extractJson(investor.text);

  return {
    startupPitch: summary.startupPitch || {},
    investmentVerdict: summary.investmentVerdict || {},
    conversationHistory: conversation,
    cost
  };
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]);
  } catch {
    return {};
  }
}

app.post('/api/evaluate', async (req, res) => {
  const { idea, apiKey, budget = 10 } = req.body || {};
  if (!idea || !apiKey) return res.status(400).json({ error: 'Missing idea or apiKey' });
  try {
    const result = await runEvaluation(idea, apiKey, Number(budget));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Evaluation failed' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));

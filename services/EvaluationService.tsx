import OpenAI from 'openai';

interface Message {
  id: string;
  agent: 'clarifier' | 'critic' | 'defender' | 'investor';
  content: string;
  timestamp: string;
  round: number;
}

interface StartupPitch {
  name: string;
  problem: string;
  solution: string;
  market: string;
  businessModel: string;
  competitive: string;
  execution: string;
}

interface InvestmentVerdict {
  decision: 'invest' | 'pass';
  confidence: number;
  reasoning: string;
  strengths: string[];
  concerns: string[];
  recommendedNext: string[];
}

type ChatMessage = { role: 'user' | 'assistant'; content: string };

type PartialResult = { startupPitch?: StartupPitch; investmentVerdict?: InvestmentVerdict };

export class EvaluationService {
  private openai: OpenAI;
  private budget: number;
  private currentCost = 0;
  private shouldStop = false;
  private currentRound = 1;
  private maxRounds = 3;
  private conversationHistory: Message[] = [];
  private chatHistory: ChatMessage[] = [];

  constructor(apiKey: string, budget: number) {
    this.openai = new OpenAI({ apiKey });
    this.budget = budget;
  }

  stop() {
    this.shouldStop = true;
  }

  async evaluateIdea(
    idea: string,
    onProgress: (step: number, message: Message, cost: number) => void,
    onComplete: (summary: { startupPitch: StartupPitch; investmentVerdict: InvestmentVerdict; conversationHistory: Message[] }) => void,
    onResultUpdate?: (partialResult: PartialResult) => void
  ) {
    this.shouldStop = false;
    this.currentRound = 1;
    this.currentCost = 0;
    this.conversationHistory = [];
    this.chatHistory = [{ role: 'user', content: idea }];

    // Clarifier step
    const clarifier = await this.callAgent('clarifier');
    const clarifierMsg = this.addMessage('clarifier', clarifier, this.currentRound);
    onProgress(0, clarifierMsg, clarifier.cost);
    if (onResultUpdate) {
      const pitch = await this.summarizePitch();
      onResultUpdate({ startupPitch: pitch });
    }

    // Critic/Defender rounds
    for (let r = 1; r <= this.maxRounds && !this.shouldStop; r++) {
      // Critic
      const critic = await this.callAgent('critic');
      const criticMsg = this.addMessage('critic', critic, this.currentRound);
      onProgress(1, criticMsg, critic.cost);
      if (this.checkBudget()) break;

      // Defender
      const defender = await this.callAgent('defender');
      const defenderMsg = this.addMessage('defender', defender, this.currentRound);
      onProgress(2, defenderMsg, defender.cost);
      if (this.checkBudget()) break;

      this.currentRound++;

      if (onResultUpdate) {
        const pitch = await this.summarizePitch();
        const verdict = await this.summarizeVerdict();
        onResultUpdate({ startupPitch: pitch, investmentVerdict: verdict });
      }
    }

    if (!this.shouldStop) {
      const investor = await this.callAgent('investor');
      const investorMsg = this.addMessage('investor', investor, this.currentRound);
      onProgress(3, investorMsg, investor.cost);
      const summary = this.parseFinalSummary(investor.content);
      onComplete({
        startupPitch: summary.startupPitch,
        investmentVerdict: summary.investmentVerdict,
        conversationHistory: this.conversationHistory,
      });
    }
  }

  async continueEvaluation(
    onProgress: (step: number, message: Message, cost: number) => void,
    onComplete: (summary: { startupPitch: StartupPitch; investmentVerdict: InvestmentVerdict; conversationHistory: Message[] }) => void,
    onResultUpdate?: (partialResult: PartialResult) => void
  ) {
    this.shouldStop = false;
    this.maxRounds += 2;
    await this.evaluateIdea(this.chatHistory[0].content, onProgress, onComplete, onResultUpdate);
  }

  private async callAgent(agent: 'clarifier' | 'critic' | 'defender' | 'investor') {
    const systemPrompts: Record<typeof agent, string> = {
      clarifier: 'You are Clarifier, an AI agent that summarizes and asks clarifying questions about startup ideas.',
      critic: 'You are Critic, an AI agent that highlights potential issues, risks, and challenges with the startup idea discussed so far.',
      defender: 'You are Defender, an AI agent that responds to the critic\'s concerns and proposes improvements.',
      investor: 'You are Investor, a venture capitalist who will provide a final investment verdict in JSON as {"startupPitch":{...},"investmentVerdict":{...}}.'
    };

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompts[agent] },
      ...this.chatHistory
    ];

    const response = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages
    });

    const content = response.choices[0].message?.content?.trim() || '';
    const tokens = response.usage?.total_tokens || 0;
    const cost = tokens * 0.002 / 1000; // approx cost for gpt-3.5-turbo
    this.currentCost += cost;
    this.chatHistory.push({ role: 'assistant', content });
    return { content, cost };
  }

  private addMessage(agent: Message['agent'], res: { content: string; cost: number }, round: number): Message {
    const message: Message = {
      id: `${agent}-${round}-${Date.now()}`,
      agent,
      content: res.content,
      timestamp: new Date().toLocaleTimeString(),
      round
    };
    this.conversationHistory.push(message);
    return message;
  }

  private async summarizePitch(): Promise<StartupPitch> {
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: 'Summarize the startup concept discussed so far as JSON {"name":"","problem":"","solution":"","market":"","businessModel":"","competitive":"","execution":""}.' },
      ...this.chatHistory
    ];
    const res = await this.openai.chat.completions.create({ model: 'gpt-3.5-turbo', messages });
    const text = res.choices[0].message?.content || '{}';
    const json = this.extractJson(text);
    const tokens = res.usage?.total_tokens || 0;
    this.currentCost += tokens * 0.002 / 1000;
    return json as StartupPitch;
  }

  private async summarizeVerdict(): Promise<InvestmentVerdict> {
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: 'Provide an interim investment analysis as JSON {"decision":"invest"|"pass","confidence":0,"reasoning":"","strengths":[],"concerns":[],"recommendedNext":[]}. Keep it short.' },
      ...this.chatHistory
    ];
    const res = await this.openai.chat.completions.create({ model: 'gpt-3.5-turbo', messages });
    const text = res.choices[0].message?.content || '{}';
    const json = this.extractJson(text);
    const tokens = res.usage?.total_tokens || 0;
    this.currentCost += tokens * 0.002 / 1000;
    return json as InvestmentVerdict;
  }

  private parseFinalSummary(text: string): { startupPitch: StartupPitch; investmentVerdict: InvestmentVerdict } {
    const data = this.extractJson(text);
    return data as { startupPitch: StartupPitch; investmentVerdict: InvestmentVerdict };
  }

  private extractJson(text: string): any {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
  }

  private checkBudget(): boolean {
    if (this.currentCost >= this.budget) {
      this.shouldStop = true;
      return true;
    }
    return false;
  }
}

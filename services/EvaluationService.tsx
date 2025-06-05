export interface Message {
  id: string;
  agent: 'clarifier' | 'critic' | 'defender' | 'investor';
  content: string;
  timestamp: string;
  round: number;
  cost: number;
}

export interface StartupPitch {
  name: string;
  problem: string;
  solution: string;
  market: string;
  businessModel: string;
  competitive: string;
  execution: string;
}

export interface InvestmentVerdict {
  decision: 'invest' | 'pass';
  confidence: number;
  reasoning: string;
  strengths: string[];
  concerns: string[];
  recommendedNext: string[];
}

export type PartialResult = { startupPitch?: StartupPitch; investmentVerdict?: InvestmentVerdict };

export class EvaluationService {
  private apiKey: string;
  private budget: number;

  constructor(apiKey: string, budget: number) {
    this.apiKey = apiKey;
    this.budget = budget;
  }

  stop() {
    // no-op for server based evaluation
  }

  async evaluateIdea(
    idea: string,
    onProgress: (step: number, message: Message, cost: number) => void,
    onComplete: (summary: { startupPitch: StartupPitch; investmentVerdict: InvestmentVerdict; conversationHistory: Message[] }) => void,
    _onResultUpdate?: (partialResult: PartialResult) => void
  ) {
    this.lastIdea = idea;
    const res = await fetch('http://localhost:3001/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea, apiKey: this.apiKey, budget: this.budget })
    });
    const data = await res.json();
    const messages: Message[] = data.conversationHistory || [];
    messages.forEach(msg => {
      const step = ['clarifier','critic','defender','investor'].indexOf(msg.agent);
      onProgress(step, msg, msg.cost || 0);
    });
    onComplete({ startupPitch: data.startupPitch, investmentVerdict: data.investmentVerdict, conversationHistory: messages });
  }

  async continueEvaluation(
    onProgress: (step: number, message: Message, cost: number) => void,
    onComplete: (summary: { startupPitch: StartupPitch; investmentVerdict: InvestmentVerdict; conversationHistory: Message[] }) => void,
    onResultUpdate?: (partialResult: PartialResult) => void
  ) {
    // For simplicity rerun evaluation
    if (this.lastIdea) {
      await this.evaluateIdea(this.lastIdea, onProgress, onComplete, onResultUpdate);
    }
  }

  private lastIdea = '';
}

// Real API service for AI agent evaluation
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

export class ApiEvaluationService {
  private apiBaseUrl: string;
  private evaluationId: string | null = null;
  private shouldStop: boolean = false;
  private pollingInterval: number | null = null;

  constructor() {
    // Determine API base URL based on environment
    this.apiBaseUrl = process.env.NODE_ENV === 'production' 
      ? '' // Use relative URLs in production (same domain)
      : 'http://localhost:3001'; // Use localhost:3001 in development
  }

  stop() {
    this.shouldStop = true;
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    if (this.evaluationId) {
      this.stopEvaluation(this.evaluationId);
    }
  }

  async evaluateIdea(
    idea: string,
    apiKey: string,
    budget: number,
    onProgress: (step: number, message: Message, cost: number) => void,
    onComplete: (summary: { startupPitch: StartupPitch; investmentVerdict: InvestmentVerdict; conversationHistory: Message[] }) => void,
    onResultUpdate?: (partialResult: { startupPitch?: StartupPitch; investmentVerdict?: InvestmentVerdict }) => void
  ) {
    this.shouldStop = false;
    
    try {
      // Start the evaluation
      const response = await fetch(`${this.apiBaseUrl}/api/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idea,
          apiKey,
          budget
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start evaluation');
      }

      const { evaluationId } = await response.json();
      this.evaluationId = evaluationId;

      // Start polling for updates
      this.pollEvaluationStatus(evaluationId, onProgress, onComplete, onResultUpdate);

    } catch (error) {
      console.error('Failed to start evaluation:', error);
      throw error;
    }
  }

  async continueEvaluation(
    onProgress: (step: number, message: Message, cost: number) => void,
    onComplete: (summary: { startupPitch: StartupPitch; investmentVerdict: InvestmentVerdict; conversationHistory: Message[] }) => void,
    onResultUpdate?: (partialResult: { startupPitch?: StartupPitch; investmentVerdict?: InvestmentVerdict }) => void
  ) {
    if (!this.evaluationId) {
      throw new Error('No active evaluation to continue');
    }

    this.shouldStop = false;

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/evaluate/${this.evaluationId}/continue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to continue evaluation');
      }

      // Resume polling for updates
      this.pollEvaluationStatus(this.evaluationId, onProgress, onComplete, onResultUpdate);

    } catch (error) {
      console.error('Failed to continue evaluation:', error);
      throw error;
    }
  }

  private async pollEvaluationStatus(
    evaluationId: string,
    onProgress: (step: number, message: Message, cost: number) => void,
    onComplete: (summary: { startupPitch: StartupPitch; investmentVerdict: InvestmentVerdict; conversationHistory: Message[] }) => void,
    onResultUpdate?: (partialResult: { startupPitch?: StartupPitch; investmentVerdict?: InvestmentVerdict }) => void
  ) {
    let lastMessageCount = 0;
    let step = 0;

    const poll = async () => {
      if (this.shouldStop) {
        if (this.pollingInterval) {
          clearInterval(this.pollingInterval);
          this.pollingInterval = null;
        }
        return;
      }

      try {
        const response = await fetch(`${this.apiBaseUrl}/api/evaluate/${evaluationId}`);
        
        if (!response.ok) {
          throw new Error('Failed to get evaluation status');
        }

        const data = await response.json();

        // Process new messages
        if (data.conversationHistory.length > lastMessageCount) {
          const newMessages = data.conversationHistory.slice(lastMessageCount);
          
          for (const message of newMessages) {
            // Calculate cost per message (approximate)
            const costPerMessage = data.currentCost / data.conversationHistory.length;
            onProgress(step, message, costPerMessage);
            step++;
          }
          
          lastMessageCount = data.conversationHistory.length;
        }

        // Update partial results
        if (data.partialResult && onResultUpdate) {
          onResultUpdate(data.partialResult);
        }

        // Check if evaluation is complete
        if (data.status === 'completed' && data.finalSummary) {
          if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
          }
          
          onComplete({
            startupPitch: data.finalSummary.startupPitch,
            investmentVerdict: data.finalSummary.investmentVerdict,
            conversationHistory: data.conversationHistory
          });
        } else if (data.status === 'error') {
          if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
          }
          
          throw new Error(data.error || 'Evaluation failed');
        }

      } catch (error) {
        console.error('Polling error:', error);
        if (this.pollingInterval) {
          clearInterval(this.pollingInterval);
          this.pollingInterval = null;
        }
        throw error;
      }
    };

    // Start immediate poll
    await poll();

    // Continue polling every 2 seconds
    this.pollingInterval = window.setInterval(poll, 2000);
  }

  private async stopEvaluation(evaluationId: string) {
    try {
      await fetch(`${this.apiBaseUrl}/api/evaluate/${evaluationId}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
    } catch (error) {
      console.error('Failed to stop evaluation:', error);
    }
  }
} 
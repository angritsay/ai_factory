// Real API service for AI agent evaluation
interface Message {
  id: string;
  agent: 'proposer' | 'critic' | 'investor' | 'system';
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

    // Just resume polling for the existing evaluation
    this.pollEvaluationStatus(this.evaluationId, onProgress, onComplete, onResultUpdate);
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
          
          for (const messageData of newMessages) {
            // Transform server message format to UI format
            const message: Message = {
              id: `msg_${Date.now()}_${Math.random()}`,
              agent: this.mapAgent(messageData.agent),
              content: messageData.message || messageData.content || '',
              timestamp: messageData.timestamp || new Date().toISOString(),
              round: messageData.iteration || 1
            };
            
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
            conversationHistory: data.conversationHistory.map((msg: any) => ({
              id: `msg_${Date.now()}_${Math.random()}`,
              agent: this.mapAgent(msg.agent),
              content: msg.message || msg.content || '',
              timestamp: msg.timestamp || new Date().toISOString(),
              round: msg.iteration || 1
            }))
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

  private mapAgent(agent: string): 'proposer' | 'critic' | 'investor' | 'system' {
    // Map server agent names to UI agent names
    switch (agent?.toLowerCase()) {
      case 'proposer':
        return 'proposer';
      case 'critic':
        return 'critic';
      case 'investor':
        return 'investor';
      case 'system':
      default:
        return 'system';
    }
  }
} 
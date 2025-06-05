const { ChatOpenAI } = require('@langchain/openai');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const { encoding_for_model } = require('tiktoken');
const fs = require('fs');
const path = require('path');

class LangChainEvaluationService {
  constructor(apiKey, budget) {
    this.budget = budget;
    this.currentCost = 0;
    this.shouldStop = false;
    this.conversationHistory = [];
    this.encoder = encoding_for_model('gpt-4');
    
    // Initialize LangChain ChatOpenAI
    this.llm = new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: 'gpt-4',
      temperature: 0.7,
      maxTokens: 800,
    });

    // Load base prompt
    this.basePrompt = this.loadBasePrompt();
    
    // Define agent system prompts
    this.agentPrompts = this.initializeAgentPrompts();
    
    // Evaluation state
    this.currentIteration = 0;
    this.maxIterations = 5;
    this.currentIdea = '';
    this.conversationTurns = [];
  }

  loadBasePrompt() {
    try {
      const promptPath = path.join(__dirname, '../../PROMPT.md');
      return fs.readFileSync(promptPath, 'utf8');
    } catch (error) {
      console.error('Failed to load base prompt:', error);
      return 'Base prompt not found';
    }
  }

  initializeAgentPrompts() {
    const baseContext = this.basePrompt;
    
    return {
      proposer: {
        system: `${baseContext}

You are the Proposer. Your role:

1. Propose or refine startup ideas
2. Clearly formulate problems and solutions
3. Consider criticism to improve ideas
4. Provide brief, reasoned responses (maximum 200-300 words)
5. Focus on key business aspects

Respond professionally and constructively. Be ready to adapt ideas based on criticism.`,
        temperature: 0.7
      },
      
      critic: {
        system: `${baseContext}

You are the Critic. Your role:

1. Critically analyze startup ideas
2. Ask sharp questions about feasibility and market potential
3. Identify weaknesses and risks
4. Provide short, focused responses (maximum 200-300 words)
5. Be constructive in criticism

Your goal is to improve the idea through reasoned criticism, not to destroy it.`,
        temperature: 0.3
      },
      
      investor: {
        system: `${baseContext}

You are the Investor. Your role:

1. Observe the discussion between Proposer and Critic
2. Make final decision about idea readiness
3. Clearly formulate the startup idea

MANDATORY requirements:

**Idea formulation:**
- What is the product?
- Who is it for?
- What problem does it solve?
- How does it make money?

**Investment decision:**
- Will I invest? (Yes/No)
- Why yes or why not?
- Confidence level (1-10)
- What needs improvement?

**Readiness verdict:**
- "ready" - ready for implementation
- "not ready" - requires further development

If verdict is "not ready", reformulate the idea for the next iteration.`,
        temperature: 0.4
      }
    };
  }

  stop() {
    this.shouldStop = true;
  }

  async evaluateIdea(idea, onProgress, onComplete, onResultUpdate) {
    this.shouldStop = false;
    this.conversationHistory = [];
    this.currentCost = 0;
    this.currentIteration = 0;
    this.currentIdea = idea;

    try {
      await this.runIterations(onProgress, onComplete, onResultUpdate);
    } catch (error) {
      console.error('Evaluation error:', error);
      throw error;
    }
  }

  async runIterations(onProgress, onComplete, onResultUpdate) {
    let lastVerdict = null;
    
    for (let iteration = 0; iteration < this.maxIterations && !this.shouldStop; iteration++) {
      this.currentIteration = iteration + 1;
      
      await this.reportProgress(
        `Iteration ${this.currentIteration}/${this.maxIterations}: Starting idea evaluation`,
        'system',
        onProgress
      );

      // Run debates between Proposer and Critic
      const debateResult = await this.runDebate(onProgress, onResultUpdate);
      
      if (this.shouldStop) break;

      // Investor evaluation
      const investorDecision = await this.getInvestorDecision(debateResult, onProgress);
      
      if (this.shouldStop) break;

      lastVerdict = investorDecision;

      // Check Investor verdict
      if (investorDecision.verdict === 'ready') {
        await this.reportProgress(
          'Investor considers the idea ready for implementation. Evaluation completed.',
          'system',
          onProgress
        );
        break;
      } else {
        // If idea is not ready, use reformulated version for next iteration
        if (investorDecision.reformulatedIdea) {
          this.currentIdea = investorDecision.reformulatedIdea;
          await this.reportProgress(
            `Investor reformulated idea for next iteration: ${this.currentIdea.substring(0, 100)}...`,
            'system',
            onProgress
          );
        }
      }

      // Budget check
      if (this.currentCost >= this.budget * 0.9) {
        await this.reportProgress(
          `Budget almost exhausted (${this.currentCost.toFixed(2)}/${this.budget}). Ending evaluation.`,
          'system',
          onProgress
        );
        break;
      }
    }

    // Generate final report
    const finalSummary = this.generateFinalSummary(lastVerdict);
    onComplete(finalSummary);
  }

  async runDebate(onProgress, onResultUpdate) {
    const maxTurnsPerAgent = 10;
    let currentTurn = 0;
    let proposerTurns = 0;
    let criticTurns = 0;
    
    this.conversationTurns = [];
    
    while (currentTurn < maxTurnsPerAgent * 2 && !this.shouldStop) {
      const isProposerTurn = currentTurn % 2 === 0;
      
      if (isProposerTurn && proposerTurns < maxTurnsPerAgent) {
        // Proposer turn
        const context = this.buildProposerContext();
        const response = await this.callAgent('proposer', context);
        
        if (this.shouldStop) break;
        
        this.conversationTurns.push({
          agent: 'proposer',
          turn: proposerTurns + 1,
          message: response,
          timestamp: new Date()
        });
        
        await this.reportProgress(response, 'proposer', onProgress);
        proposerTurns++;
        
      } else if (!isProposerTurn && criticTurns < maxTurnsPerAgent) {
        // Critic turn
        const context = this.buildCriticContext();
        const response = await this.callAgent('critic', context);
        
        if (this.shouldStop) break;
        
        this.conversationTurns.push({
          agent: 'critic',
          turn: criticTurns + 1,
          message: response,
          timestamp: new Date()
        });
        
        await this.reportProgress(response, 'critic', onProgress);
        criticTurns++;
      }
      
      currentTurn++;
      
      // Update partial results
      if (onResultUpdate && currentTurn % 2 === 0) {
        const partialResults = this.generatePartialResults();
        onResultUpdate(partialResults);
      }
    }
    
    return {
      turns: this.conversationTurns,
      proposerTurns,
      criticTurns
    };
  }

  async getInvestorDecision(debateResult, onProgress) {
    const context = this.buildInvestorContext(debateResult);
    const response = await this.callAgent('investor', context);
    
    await this.reportProgress(response, 'investor', onProgress);
    
    // Parse investor response
    const decision = this.parseInvestorResponse(response);
    
    return decision;
  }

  buildProposerContext() {
    let context = `Current startup idea: ${this.currentIdea}\n\n`;
    
    if (this.conversationTurns.length > 0) {
      context += "Discussion history:\n";
      this.conversationTurns.slice(-4).forEach(turn => {
        context += `${turn.agent}: ${turn.message}\n\n`;
      });
    }
    
    context += "Improve or defend the idea, considering the discussion:";
    
    return context;
  }

  buildCriticContext() {
    let context = `Current startup idea: ${this.currentIdea}\n\n`;
    
    if (this.conversationTurns.length > 0) {
      context += "Discussion history:\n";
      this.conversationTurns.slice(-4).forEach(turn => {
        context += `${turn.agent}: ${turn.message}\n\n`;
      });
    }
    
    context += "Analyze and critically evaluate the idea:";
    
    return context;
  }

  buildInvestorContext(debateResult) {
    let context = `Startup idea evaluation (Iteration ${this.currentIteration})\n\n`;
    context += `Original idea: ${this.currentIdea}\n\n`;
    context += `Discussion (${debateResult.proposerTurns} Proposer turns, ${debateResult.criticTurns} Critic turns):\n\n`;
    
    debateResult.turns.forEach(turn => {
      context += `${turn.agent.toUpperCase()} (turn ${turn.turn}): ${turn.message}\n\n`;
    });
    
    context += `Make investment decision and readiness verdict:`;
    
    return context;
  }

  async callAgent(agentType, context) {
    const prompt = this.agentPrompts[agentType];
    
    // Budget check
    const estimatedCost = this.estimateRequestCost(prompt.system, context);
    if (this.currentCost + estimatedCost > this.budget) {
      throw new Error(`Budget exceeded. Current: $${this.currentCost.toFixed(2)}, Estimated: $${estimatedCost.toFixed(2)}, Budget: $${this.budget}`);
    }

    const messages = [
      new SystemMessage(prompt.system),
      new HumanMessage(context)
    ];

    // Create model with appropriate temperature
    const agentLlm = new ChatOpenAI({
      openAIApiKey: this.llm.openAIApiKey,
      modelName: 'gpt-4',
      temperature: prompt.temperature,
      maxTokens: 800
    });

    const response = await agentLlm.invoke(messages);
    
    // Update cost (approximately)
    this.currentCost += estimatedCost;
    
    return response.content;
  }

  parseInvestorResponse(response) {
    // Parse investor response to extract structured data
    const decision = {
      originalResponse: response,
      verdict: 'not ready', // default
      willInvest: false,
      confidence: 1,
      reasoning: '',
      product: '',
      targetAudience: '',
      problemSolved: '',
      monetization: '',
      reformulatedIdea: null
    };

    // Simple parsing based on keywords
    const lowerResponse = response.toLowerCase();
    
    if (lowerResponse.includes('ready') && !lowerResponse.includes('not ready')) {
      decision.verdict = 'ready';
    }
    
    if (lowerResponse.includes('yes') || lowerResponse.includes('will invest')) {
      decision.willInvest = true;
    }

    // Extract confidence level
    const confidenceMatch = response.match(/confidence[:\-]?\s*(\d+)/i);
    if (confidenceMatch) {
      decision.confidence = parseInt(confidenceMatch[1]);
    }

    // Try to extract reformulated idea
    const reformulatedMatch = response.match(/reformulated idea[:\-]?\s*(.+?)(?:\n\n|\n$|$)/is);
    if (reformulatedMatch) {
      decision.reformulatedIdea = reformulatedMatch[1].trim();
    }

    decision.reasoning = response;
    
    return decision;
  }

  generatePartialResults() {
    const lastProposerTurn = this.conversationTurns.filter(t => t.agent === 'proposer').pop();
    const lastCriticTurn = this.conversationTurns.filter(t => t.agent === 'critic').pop();
    
    return {
      startupPitch: {
        idea: this.currentIdea,
        lastProposerInput: lastProposerTurn?.message || '',
        lastCriticInput: lastCriticTurn?.message || '',
        status: 'in_progress'
      },
      investmentVerdict: {
        decision: 'pending',
        confidence: 50,
        reasoning: 'Evaluation in progress...'
      }
    };
  }

  generateFinalSummary(lastVerdict) {
    return {
      startupPitch: {
        idea: this.currentIdea,
        finalFormulation: lastVerdict?.reformulatedIdea || this.currentIdea,
        product: lastVerdict?.product || 'Not defined',
        targetAudience: lastVerdict?.targetAudience || 'Not defined',
        problemSolved: lastVerdict?.problemSolved || 'Not defined',
        monetization: lastVerdict?.monetization || 'Not defined'
      },
      investmentVerdict: {
        decision: lastVerdict?.willInvest ? 'invest' : 'pass',
        verdict: lastVerdict?.verdict || 'not ready',
        confidence: lastVerdict?.confidence || 1,
        reasoning: lastVerdict?.reasoning || 'No data available',
        totalCost: this.currentCost,
        iterations: this.currentIteration
      },
      conversationHistory: this.conversationHistory,
      metadata: {
        totalCost: this.currentCost,
        budget: this.budget,
        iterations: this.currentIteration,
        maxIterations: this.maxIterations,
        completedAt: new Date()
      }
    };
  }

  async reportProgress(message, agent, onProgress) {
    const progressData = {
      agent,
      message,
      timestamp: new Date(),
      cost: this.currentCost,
      iteration: this.currentIteration
    };
    
    this.conversationHistory.push(progressData);
    
    if (onProgress) {
      onProgress('step', progressData, 0);
    }
  }

  estimateRequestCost(systemPrompt, userPrompt) {
    // Approximate request cost estimation
    const inputTokens = this.encoder.encode(systemPrompt + userPrompt).length;
    const estimatedOutputTokens = 300; // average response length
    
    // Approximate GPT-4 prices (as of March 2024)
    const inputCostPer1K = 0.03;
    const outputCostPer1K = 0.06;
    
    return (inputTokens / 1000) * inputCostPer1K + (estimatedOutputTokens / 1000) * outputCostPer1K;
  }
}

module.exports = { LangChainEvaluationService }; 
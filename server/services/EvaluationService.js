const OpenAI = require('openai');
const { encoding_for_model } = require('tiktoken');

class EvaluationService {
  constructor(apiKey, budget) {
    this.openai = new OpenAI({ apiKey });
    this.budget = budget;
    this.currentCost = 0;
    this.shouldStop = false;
    this.currentRound = 1;
    this.maxRounds = 3;
    this.conversationHistory = [];
    this.encoder = encoding_for_model('gpt-4');
    
    // Agent system prompts
    this.agentPrompts = {
      clarifier: {
        system: `You are the Clarifier Agent, an expert at interpreting and reformulating raw startup ideas. Your role is to:

1. Take rough, unstructured startup concepts and clarify them into coherent business ideas
2. Identify the core problem being solved and target market
3. Ask clarifying questions about assumptions and scope
4. Provide a structured interpretation without being overly critical

Be thorough but concise. Focus on understanding and articulating the concept clearly for further evaluation.`,
        temperature: 0.7
      },
      
      critic: {
        system: `You are the Critic Agent, a skeptical investor who challenges startup ideas. Your role is to:

1. Act as a realistic, experienced investor with high standards
2. Challenge the idea on feasibility, market potential, and competitive positioning
3. Point out potential flaws, risks, and obstacles
4. Ask tough questions about unit economics, scalability, and defensibility
5. Be constructively critical but not dismissive

Focus on real market conditions, competition, and execution challenges. Your goal is to stress-test the idea thoroughly.`,
        temperature: 0.3
      },
      
      defender: {
        system: `You are the Defender Agent, an optimistic entrepreneur who improves and defends startup ideas. Your role is to:

1. Respond constructively to criticism and challenges
2. Elaborate on the idea's strengths and potential solutions to identified problems
3. Suggest improvements, pivots, or additional features that address concerns
4. Remain realistic while being optimistic about possibilities
5. Build upon the concept without user input

Focus on problem-solving and strengthening the business case. Help evolve the idea based on feedback.`,
        temperature: 0.8
      },
      
      investor: {
        system: `You are the Investor Agent, a professional angel investor making final investment decisions. Your role is to:

1. Evaluate the final version of the startup concept after the debate
2. Make a clear "invest" or "pass" decision with confidence level
3. Provide detailed reasoning for your decision
4. Consider market size, team requirements, competitive advantage, and execution risk
5. Generate a structured summary including strengths, concerns, and recommendations

Be decisive but thorough. Your evaluation should simulate a real investment committee decision.`,
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
    this.currentRound = 1;
    this.currentCost = 0;

    try {
      // Start the evaluation process
      await this.runEvaluation(idea, onProgress, onComplete, onResultUpdate);
    } catch (error) {
      console.error('Evaluation failed:', error);
      throw error;
    }
  }

  async continueEvaluation(onProgress, onComplete, onResultUpdate) {
    this.shouldStop = false;
    this.maxRounds += 2; // Add 2 more rounds
    
    const lastIdea = this.extractLastIdea();
    await this.runEvaluation(lastIdea, onProgress, onComplete, onResultUpdate);
  }

  async runEvaluation(idea, onProgress, onComplete, onResultUpdate) {
    let currentIdea = idea;
    
    // Phase 1: Clarifier processes the initial idea
    if (this.conversationHistory.length === 0) {
      const clarifierResponse = await this.callAgent('clarifier', currentIdea);
      if (this.shouldStop) return;
      
      await this.simulateAgentResponse('clarifier', clarifierResponse, 1, 0, onProgress);
      currentIdea = clarifierResponse;

      // Generate initial partial result
      if (onResultUpdate) {
        const initialPitch = await this.generateInitialPitch(clarifierResponse);
        onResultUpdate({ startupPitch: initialPitch });
      }
    }

    // Phase 2: Conversation rounds between Critic and Defender
    for (let round = Math.max(this.currentRound - 1, 0); round < this.maxRounds && !this.shouldStop; round++) {
      // Critic challenges the idea
      const criticContext = this.buildConversationContext('critic', currentIdea);
      const criticResponse = await this.callAgent('critic', criticContext);
      if (this.shouldStop) break;
      
      await this.simulateAgentResponse('critic', criticResponse, round + 1, 1, onProgress);

      // Defender responds to criticism
      const defenderContext = this.buildConversationContext('defender', currentIdea);
      const defenderResponse = await this.callAgent('defender', defenderContext);
      if (this.shouldStop) break;
      
      await this.simulateAgentResponse('defender', defenderResponse, round + 1, 2, onProgress);
      currentIdea = defenderResponse; // Update the evolved idea

      // Update partial results after each round
      if (onResultUpdate) {
        const partialPitch = await this.generatePartialPitch(currentIdea);
        const partialVerdict = {
          decision: 'pending',
          confidence: Math.min(50 + (round * 10), 85),
          reasoning: "Evaluation in progress... Agents are refining the concept and addressing concerns.",
          strengths: [],
          concerns: [],
          recommendedNext: []
        };
        onResultUpdate({ 
          startupPitch: partialPitch, 
          investmentVerdict: partialVerdict 
        });
      }

      this.currentRound = round + 2;
    }

    // Phase 3: Final investor decision
    if (!this.shouldStop) {
      const investorContext = this.buildConversationContext('investor', currentIdea);
      const investorResponse = await this.callAgent('investor', investorContext);
      
      await this.simulateAgentResponse('investor', investorResponse, this.maxRounds, 3, onProgress);

      // Generate final summary
      const finalPitch = await this.generateFinalPitch(currentIdea);
      const finalVerdict = await this.generateFinalVerdict(investorResponse);

      onComplete({
        startupPitch: finalPitch,
        investmentVerdict: finalVerdict,
        conversationHistory: this.conversationHistory
      });
    }
  }

  async callAgent(agentType, context) {
    const prompt = this.agentPrompts[agentType];
    const messages = [
      { role: 'system', content: prompt.system },
      { role: 'user', content: context }
    ];

    // Calculate token cost before making the call
    const inputTokens = this.calculateTokens(messages);
    const estimatedCost = this.estimateOpenAICost(inputTokens, 0);
    
    if (this.currentCost + estimatedCost > this.budget) {
      throw new Error(`Budget exceeded. Current: $${this.currentCost.toFixed(2)}, Estimated: $${estimatedCost.toFixed(2)}, Budget: $${this.budget}`);
    }

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      max_tokens: 800,
      temperature: prompt.temperature
    });

    // Calculate actual cost
    const outputTokens = response.usage.completion_tokens;
    const actualCost = this.estimateOpenAICost(inputTokens, outputTokens);
    this.currentCost += actualCost;

    return response.choices[0].message.content;
  }

  buildConversationContext(agentType, currentIdea) {
    let context = `Original idea: ${currentIdea}\n\n`;
    
    if (this.conversationHistory.length > 0) {
      context += "Conversation so far:\n";
      this.conversationHistory.forEach(msg => {
        context += `${msg.agent}: ${msg.content}\n\n`;
      });
    }

    if (agentType === 'critic') {
      context += "Please provide your critical analysis of this startup idea. Focus on potential weaknesses, market challenges, and execution risks.";
    } else if (agentType === 'defender') {
      context += "Please address the criticisms raised and strengthen the startup concept. Suggest improvements and highlight the idea's potential.";
    } else if (agentType === 'investor') {
      context += "Based on the entire conversation, make your final investment decision and provide a comprehensive evaluation.";
    }

    return context;
  }

  async generateInitialPitch(clarifiedIdea) {
    const prompt = `Based on this clarified startup idea, generate a structured pitch with the following fields:
    
Idea: ${clarifiedIdea}

Format your response as JSON with these exact fields:
- name: A catchy startup name
- problem: The core problem being solved
- solution: The proposed solution
- market: Target market description
- businessModel: How the company makes money
- competitive: Competitive advantages
- execution: Basic execution plan

Keep each field concise (1-2 sentences).`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.7
      });

      const content = response.choices[0].message.content;
      // Try to parse JSON, fallback to basic structure if needed
      try {
        return JSON.parse(content);
      } catch {
        return this.parseStructuredResponse(content);
      }
    } catch (error) {
      console.error('Error generating initial pitch:', error);
      return this.getDefaultPitch(clarifiedIdea);
    }
  }

  async generatePartialPitch(evolvedIdea) {
    return this.generateInitialPitch(evolvedIdea);
  }

  async generateFinalPitch(finalIdea) {
    return this.generateInitialPitch(finalIdea);
  }

  async generateFinalVerdict(investorResponse) {
    const prompt = `Based on this investor response, extract a structured investment verdict:

Response: ${investorResponse}

Format as JSON with these exact fields:
- decision: "invest" or "pass"
- confidence: number 0-100
- reasoning: brief explanation
- strengths: array of strength points
- concerns: array of concern points  
- recommendedNext: array of next steps

Keep it concise and accurate to the investor's analysis.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
        temperature: 0.3
      });

      const content = response.choices[0].message.content;
      try {
        return JSON.parse(content);
      } catch {
        return this.parseVerdictResponse(content, investorResponse);
      }
    } catch (error) {
      console.error('Error generating final verdict:', error);
      return this.getDefaultVerdict(investorResponse);
    }
  }

  async simulateAgentResponse(agent, content, round, step, onProgress) {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (this.shouldStop) {
          resolve();
          return;
        }

        const message = {
          id: `${agent}-${round}-${Date.now()}`,
          agent,
          content,
          timestamp: new Date().toLocaleTimeString(),
          round
        };

        this.conversationHistory.push(message);
        
        // Use actual cost from OpenAI API calls
        const recentCost = Math.max(this.currentCost - (this.conversationHistory.length - 1) * 0.1, 0.1);
        onProgress(step, message, recentCost);
        resolve();
      }, Math.random() * 1000 + 500); // Shorter delay for real responses
    });
  }

  calculateTokens(messages) {
    let totalTokens = 0;
    messages.forEach(message => {
      totalTokens += this.encoder.encode(message.content).length;
    });
    return totalTokens;
  }

  estimateOpenAICost(inputTokens, outputTokens) {
    // GPT-4 pricing (as of 2024)
    const inputCostPer1K = 0.03;   // $0.03 per 1K input tokens
    const outputCostPer1K = 0.06;  // $0.06 per 1K output tokens
    
    return (inputTokens / 1000 * inputCostPer1K) + (outputTokens / 1000 * outputCostPer1K);
  }

  parseStructuredResponse(content) {
    // Fallback parser for non-JSON responses
    return {
      name: this.extractField(content, 'name') || 'Startup Concept',
      problem: this.extractField(content, 'problem') || 'Problem to be determined',
      solution: this.extractField(content, 'solution') || 'Solution in development',
      market: this.extractField(content, 'market') || 'Market analysis needed',
      businessModel: this.extractField(content, 'businessModel') || 'Business model TBD',
      competitive: this.extractField(content, 'competitive') || 'Competitive analysis needed',
      execution: this.extractField(content, 'execution') || 'Execution plan in progress'
    };
  }

  parseVerdictResponse(content, originalResponse) {
    const decision = originalResponse.toLowerCase().includes('invest') && 
                    !originalResponse.toLowerCase().includes('not invest') ? 'invest' : 'pass';
    
    return {
      decision,
      confidence: this.extractNumber(content) || (decision === 'invest' ? 70 : 40),
      reasoning: this.extractField(content, 'reasoning') || 'Based on comprehensive analysis',
      strengths: this.extractList(content, 'strengths') || ['Concept has potential'],
      concerns: this.extractList(content, 'concerns') || ['Execution challenges exist'],
      recommendedNext: this.extractList(content, 'recommendedNext') || ['Develop MVP', 'Market validation']
    };
  }

  extractField(content, fieldName) {
    const regex = new RegExp(`${fieldName}[:\-]\\s*(.+?)(?=\\n|$)`, 'i');
    const match = content.match(regex);
    return match ? match[1].trim() : null;
  }

  extractNumber(content) {
    const match = content.match(/(\d+)%?/);
    return match ? parseInt(match[1]) : null;
  }

  extractList(content, fieldName) {
    const regex = new RegExp(`${fieldName}[:\-]\\s*\\[(.+?)\\]`, 'is');
    const match = content.match(regex);
    if (match) {
      return match[1].split(',').map(item => item.trim().replace(/['"]/g, ''));
    }
    return null;
  }

  extractLastIdea() {
    if (this.conversationHistory.length === 0) return '';
    
    // Get the last defender or clarifier response as the evolved idea
    for (let i = this.conversationHistory.length - 1; i >= 0; i--) {
      if (this.conversationHistory[i].agent === 'defender' || 
          this.conversationHistory[i].agent === 'clarifier') {
        return this.conversationHistory[i].content;
      }
    }
    
    return this.conversationHistory[this.conversationHistory.length - 1].content;
  }

  getDefaultPitch(idea) {
    return {
      name: 'Startup Concept',
      problem: 'Addressing market needs',
      solution: idea.substring(0, 100) + '...',
      market: 'Target market analysis in progress',
      businessModel: 'Revenue model to be determined',
      competitive: 'Competitive analysis needed',
      execution: 'Execution strategy under development'
    };
  }

  getDefaultVerdict(response) {
    const decision = response.toLowerCase().includes('invest') ? 'invest' : 'pass';
    return {
      decision,
      confidence: decision === 'invest' ? 65 : 35,
      reasoning: 'Investment decision based on comprehensive evaluation',
      strengths: ['Potential market opportunity'],
      concerns: ['Execution and market risks'],
      recommendedNext: ['Develop business plan', 'Conduct market research']
    };
  }
}

module.exports = { EvaluationService }; 
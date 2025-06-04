// Mock service for AI agent evaluation
// In a real implementation, this would make actual OpenAI API calls

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

export class EvaluationService {
  private apiKey: string;
  private budget: number;
  private currentCost: number = 0;
  private shouldStop: boolean = false;
  private currentRound: number = 1;
  private maxRounds: number = 3;
  private conversationHistory: Message[] = [];
  private selectedMock: any;

  constructor(apiKey: string, budget: number) {
    this.apiKey = apiKey;
    this.budget = budget;
  }

  stop() {
    this.shouldStop = true;
  }

  async evaluateIdea(
    idea: string,
    onProgress: (step: number, message: Message, cost: number) => void,
    onComplete: (summary: { startupPitch: StartupPitch; investmentVerdict: InvestmentVerdict; conversationHistory: Message[] }) => void,
    onResultUpdate?: (partialResult: { startupPitch?: StartupPitch; investmentVerdict?: InvestmentVerdict }) => void
  ) {
    this.shouldStop = false;
    this.conversationHistory = [];
    this.currentRound = 1;

    // Mock conversation flow
    const mockConversations = {
      "food delivery app": {
        rounds: [
          {
            clarifier: "I understand you're proposing a food delivery application. Let me clarify the concept: You're suggesting a platform that connects restaurants with customers for meal delivery. The core problem seems to be convenience - people want restaurant food delivered to their location. The target market would be busy professionals, families, and anyone preferring not to cook or dine out. Is this focused on a specific geographic area or demographic?",
            critic: "Food delivery is an extremely saturated market dominated by established players like DoorDash, Uber Eats, and Grubhub. The unit economics are challenging - high customer acquisition costs, driver costs, and thin margins. What's your differentiation? How will you compete with billion-dollar companies that already have restaurant partnerships and delivery infrastructure?",
            defender: "While the market is competitive, there are still opportunities for innovation. We could focus on underserved markets like small towns, or specialize in specific cuisine types or dietary restrictions. Our differentiation could be lower commission rates for restaurants, better driver compensation, or superior technology for order accuracy and delivery speed.",
          },
          {
            critic: "Small towns may not have sufficient order density to make delivery profitable. Specialized cuisines limit your addressable market. Lower commission rates mean lower margins - how do you achieve profitability? Driver compensation costs money. Where's your sustainable competitive advantage?",
            defender: "We could start with a hub-and-spoke model in smaller cities with satellite coverage. For profitability, we'd focus on operational efficiency through AI-powered routing and demand prediction. Our competitive advantage could be community focus - building local partnerships and supporting local restaurants with marketing tools.",
          },
          {
            critic: "AI routing exists in current platforms. Local partnerships are nice but not defensible. You need significant capital for expansion. What's your go-to-market strategy and timeline to profitability?",
            defender: "Our go-to-market would be asset-light initially - partnering with existing delivery drivers and focusing on software. We'd target specific corridors between small cities for efficiency. Revenue diversification through restaurant POS integration, inventory management services, and premium subscriptions for customers.",
          }
        ],
        pitch: {
          name: "LocalBites",
          problem: "Small to medium-sized cities are underserved by major food delivery platforms, leaving local restaurants without delivery options and customers with limited food access.",
          solution: "A community-focused food delivery platform that connects local restaurants with customers in underserved markets, offering competitive rates and supporting local businesses.",
          market: "Small to medium-sized cities (50K-200K population) across the US, targeting busy professionals, families, and elderly customers who value convenience.",
          businessModel: "Commission-based revenue from restaurants (15% vs industry 25-30%), premium customer subscriptions, and B2B services for restaurant management tools.",
          competitive: "Lower commission rates, community focus, operational efficiency through AI routing, and expansion into markets too small for major competitors.",
          execution: "Start with 3-5 pilot cities, build restaurant partnerships, develop driver network, scale operations based on proven unit economics, expand regionally."
        },
        verdict: {
          decision: "pass" as const,
          confidence: 65,
          reasoning: "While the focus on underserved markets is compelling, the fundamental challenges of food delivery unit economics remain. Lower commission rates reduce profitability while operational costs stay high. The competitive moat is weak and major players could easily expand into these markets if profitable.",
          strengths: [
            "Clear market gap in smaller cities",
            "Community-focused approach with local partnerships",
            "Lower commission rates attractive to restaurants",
            "Asset-light initial approach reduces risk"
          ],
          concerns: [
            "Thin margins with lower commission structure",
            "Insufficient order density in smaller markets",
            "No sustainable competitive advantage",
            "Major competitors could quickly enter profitable markets",
            "High customer acquisition costs even in small markets"
          ],
          recommendedNext: [
            "Conduct detailed market analysis of specific target cities",
            "Develop stronger differentiation beyond pricing",
            "Create partnerships with local business associations",
            "Build MVP and test unit economics in one pilot market"
          ]
        }
      },
      
      "ai tutoring platform": {
        rounds: [
          {
            clarifier: "You're proposing an AI-powered tutoring platform. The core concept is using artificial intelligence to provide personalized education assistance to students. This addresses the problem of expensive human tutoring and one-size-fits-all education. The target market includes students, parents, and educational institutions. Are you focusing on specific subjects, age groups, or educational levels?",
            critic: "EdTech is a crowded space with many AI tutoring solutions already available. Companies like Khan Academy, Coursera, and specialized platforms like Socratic by Google exist. How is your AI different? What's your evidence that AI can effectively replace human tutoring? Student retention and engagement are major challenges in digital learning.",
            defender: "Our differentiation lies in personalized learning paths that adapt in real-time based on student performance and learning style. Unlike generic platforms, we'd offer subject-specific AI tutors trained on curriculum standards. We'd focus on supplementing, not replacing human tutors, and integrate with existing school systems.",
          },
          {
            critic: "Personalized learning is what every EdTech company claims. Real-time adaptation requires significant data and sophisticated algorithms - that's expensive to develop and maintain. Integration with schools moves slowly and requires compliance with privacy regulations like FERPA. How do you monetize while keeping it affordable for students?",
            defender: "We'd start with a freemium model targeting individual students and parents. Revenue from premium features, institutional licenses, and partnerships with textbook publishers. Our AI would be trained on open educational content initially, reducing development costs. Privacy-first design from the ground up.",
          },
          {
            critic: "Freemium models in education have low conversion rates. Individual students are price-sensitive. Institutional sales cycles are 12-18 months. Textbook publishers have their own digital strategies. How do you acquire users and achieve scale?",
            defender: "User acquisition through content marketing, partnerships with teachers and education influencers, and referral programs. We'd focus on measurable outcomes - if students improve grades, parents will pay. Integration with popular learning management systems for distribution.",
          }
        ],
        pitch: {
          name: "EduMentor AI",
          problem: "Students struggle with personalized learning support while human tutoring is expensive and not scalable. Traditional educational platforms lack adaptive intelligence.",
          solution: "AI-powered tutoring platform that provides personalized, adaptive learning experiences across multiple subjects with real-time progress tracking and curriculum alignment.",
          market: "K-12 students, college students, and adult learners globally. Primary focus on STEM subjects with expansion to humanities and test preparation.",
          businessModel: "Freemium model with premium subscriptions ($9.99/month), institutional licenses for schools, and partnerships with educational content providers.",
          competitive: "Real-time adaptive learning algorithms, curriculum-aligned content, multi-modal learning support (text, voice, visual), and seamless LMS integration.",
          execution: "Launch with math and science tutoring, build user base through freemium model, gather learning data to improve AI, expand subject coverage, pursue institutional partnerships."
        },
        verdict: {
          decision: "invest" as const,
          confidence: 78,
          reasoning: "The AI tutoring market has significant potential with growing demand for personalized education. The focus on curriculum alignment and measurable outcomes differentiates this from generic platforms. Strong unit economics potential with subscription model and institutional sales.",
          strengths: [
            "Large and growing EdTech market ($340B globally)",
            "Clear value proposition for students and parents",
            "Scalable AI-driven approach",
            "Multiple revenue streams and expansion opportunities",
            "Measurable outcomes drive customer retention"
          ],
          concerns: [
            "Highly competitive market with well-funded incumbents",
            "Customer acquisition costs in education can be high",
            "Regulatory compliance requirements",
            "Need for significant content development",
            "Proving AI effectiveness vs human tutoring"
          ],
          recommendedNext: [
            "Develop MVP focused on one subject area (likely math)",
            "Conduct pilot program with 100 students to prove efficacy",
            "Build partnerships with teachers for content validation",
            "Establish metrics for measuring student improvement",
            "Secure initial funding for content development and AI training"
          ]
        }
      }
    };

    // Determine which mock conversation to use based on the idea
    const ideaLower = idea.toLowerCase();
    
    if (ideaLower.includes('food') || ideaLower.includes('delivery') || ideaLower.includes('restaurant')) {
      this.selectedMock = mockConversations["food delivery app"];
    } else if (ideaLower.includes('ai') || ideaLower.includes('tutor') || ideaLower.includes('education') || ideaLower.includes('learn')) {
      this.selectedMock = mockConversations["ai tutoring platform"];
    } else {
      // Default to AI tutoring for other ideas
      this.selectedMock = mockConversations["ai tutoring platform"];
    }

    // Start the evaluation
    await this.runEvaluation(onProgress, onComplete, onResultUpdate);
  }

  async continueEvaluation(
    onProgress: (step: number, message: Message, cost: number) => void,
    onComplete: (summary: { startupPitch: StartupPitch; investmentVerdict: InvestmentVerdict; conversationHistory: Message[] }) => void,
    onResultUpdate?: (partialResult: { startupPitch?: StartupPitch; investmentVerdict?: InvestmentVerdict }) => void
  ) {
    this.shouldStop = false;
    this.maxRounds += 2; // Add 2 more rounds
    await this.runEvaluation(onProgress, onComplete, onResultUpdate);
  }

  private async runEvaluation(
    onProgress: (step: number, message: Message, cost: number) => void,
    onComplete: (summary: { startupPitch: StartupPitch; investmentVerdict: InvestmentVerdict; conversationHistory: Message[] }) => void,
    onResultUpdate?: (partialResult: { startupPitch?: StartupPitch; investmentVerdict?: InvestmentVerdict }) => void
  ) {
    // Simulate the conversation
    for (let round = this.currentRound - 1; round < Math.min(this.maxRounds, this.selectedMock.rounds.length); round++) {
      if (this.shouldStop) break;

      const roundData = this.selectedMock.rounds[round];
      
      // Clarifier step
      if (round === 0 && this.conversationHistory.length === 0) {
        if (this.shouldStop) break;
        await this.simulateAgentResponse(
          'clarifier',
          roundData.clarifier,
          round + 1,
          0,
          onProgress
        );
        
        // Update partial result after clarifier
        if (onResultUpdate) {
          onResultUpdate({
            startupPitch: {
              ...this.selectedMock.pitch,
              name: this.selectedMock.pitch.name + " (Draft)"
            }
          });
        }
      }

      // Critic step
      if (this.shouldStop) break;
      await this.simulateAgentResponse(
        'critic',
        roundData.critic,
        round + 1,
        1,
        onProgress
      );

      // Defender step
      if (this.shouldStop) break;
      await this.simulateAgentResponse(
        'defender',
        roundData.defender,
        round + 1,
        2,
        onProgress
      );

      // Update partial result after each round
      if (onResultUpdate) {
        onResultUpdate({
          startupPitch: this.selectedMock.pitch,
          investmentVerdict: {
            ...this.selectedMock.verdict,
            confidence: Math.min(this.selectedMock.verdict.confidence + (round * 5), 95),
            reasoning: "Evaluation in progress... Agents are refining the concept and addressing concerns."
          }
        });
      }

      this.currentRound = round + 2;
    }

    // Final investor decision if not stopped
    if (!this.shouldStop) {
      const finalInvestorMessage = this.generateFinalInvestorMessage(this.selectedMock.verdict);
      await this.simulateAgentResponse(
        'investor',
        finalInvestorMessage,
        this.maxRounds,
        3,
        onProgress
      );

      // Complete evaluation
      onComplete({
        startupPitch: this.selectedMock.pitch,
        investmentVerdict: this.selectedMock.verdict,
        conversationHistory: this.conversationHistory
      });
    }
  }

  private async simulateAgentResponse(
    agent: 'clarifier' | 'critic' | 'defender' | 'investor',
    content: string,
    round: number,
    step: number,
    onProgress: (step: number, message: Message, cost: number) => void
  ): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (this.shouldStop) {
          resolve();
          return;
        }

        const message: Message = {
          id: `${agent}-${round}-${Date.now()}`,
          agent,
          content,
          timestamp: new Date().toLocaleTimeString(),
          round
        };

        this.conversationHistory.push(message);
        
        // Simulate API cost (roughly $0.50-$2.00 per agent response)
        const cost = Math.random() * 1.5 + 0.5;
        this.currentCost += cost;

        onProgress(step, message, cost);
        resolve();
      }, Math.random() * 2000 + 1000); // Random delay between 1-3 seconds
    });
  }

  private generateFinalInvestorMessage(verdict: InvestmentVerdict): string {
    return `After careful consideration of the discussion, I've reached my investment decision.

**DECISION: ${verdict.decision.toUpperCase()}**

${verdict.reasoning}

Key factors in my decision:
• Market potential and size
• Competitive positioning
• Execution feasibility
• Financial projections
• Team requirements

The confidence level for this decision is ${verdict.confidence}% based on the information presented and market analysis.`;
  }
}
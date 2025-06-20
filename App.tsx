import React, { useState, useEffect } from 'react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Textarea } from './components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Progress } from './components/ui/progress';
import { Brain, MessageSquare, TrendingUp, Shield, Target, Sparkles, DollarSign, Square, RotateCcw, Pause } from 'lucide-react';
import { AgentConversation } from './components/AgentConversation';
import { InvestorDocument } from './components/InvestorDocument';
import { FinalSummary } from './components/FinalSummary';
import { ApiEvaluationService } from './services/ApiEvaluationService';

// Типы интерфейсов
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

// Интерфейс для сохраненного состояния
interface SavedEvaluationState {
  startupIdea: string;
  budget: string;
  isEvaluating: boolean;
  currentStep: number;
  conversation: Message[];
  finalSummary: { startupPitch: StartupPitch; investmentVerdict: InvestmentVerdict; conversationHistory: Message[] } | null;
  partialResult: { startupPitch?: StartupPitch; investmentVerdict?: InvestmentVerdict } | null;
  budgetUsed: number;
  evaluationId: string | null;
  timestamp: number;
}

export default function App() {
  const [startupIdea, setStartupIdea] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [budget, setBudget] = useState('1');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [conversation, setConversation] = useState<Message[]>([]);
  const [finalSummary, setFinalSummary] = useState<{ startupPitch: StartupPitch; investmentVerdict: InvestmentVerdict; conversationHistory: Message[] } | null>(null);
  const [partialResult, setPartialResult] = useState<{ startupPitch?: StartupPitch; investmentVerdict?: InvestmentVerdict } | null>(null);
  const [budgetUsed, setBudgetUsed] = useState(0);
  const [evaluationService, setEvaluationService] = useState<ApiEvaluationService | null>(null);

  const agents = [
    { name: 'Proposer', icon: Brain, description: 'Proposes ideas', color: 'text-sky-700' },
    { name: 'Critic', icon: Shield, description: 'Analyzes critically', color: 'text-rose-700' },
    { name: 'Investor', icon: Target, description: 'Makes decisions', color: 'text-violet-700' }
  ];

  // Функция для сохранения состояния в localStorage
  const saveEvaluationState = (state: Partial<SavedEvaluationState>) => {
    const currentState: SavedEvaluationState = {
      startupIdea,
      budget,
      isEvaluating,
      currentStep,
      conversation,
      finalSummary,
      partialResult,
      budgetUsed,
      evaluationId: evaluationService?.['evaluationId'] || null,
      timestamp: Date.now(),
      ...state
    };
    
    localStorage.setItem('ai_evaluator_state', JSON.stringify(currentState));
  };

  // Функция для загрузки состояния из localStorage
  const loadEvaluationState = (): SavedEvaluationState | null => {
    try {
      const savedState = localStorage.getItem('ai_evaluator_state');
      if (!savedState) return null;
      
      const state: SavedEvaluationState = JSON.parse(savedState);
      
      // Проверяем, что состояние не старше 24 часов
      const hoursSinceLastSave = (Date.now() - state.timestamp) / (1000 * 60 * 60);
      if (hoursSinceLastSave > 24) {
        localStorage.removeItem('ai_evaluator_state');
        return null;
      }
      
      return state;
    } catch (error) {
      console.error('Error loading saved state:', error);
      localStorage.removeItem('ai_evaluator_state');
      return null;
    }
  };

  // Функция для очистки сохраненного состояния
  const clearSavedState = () => {
    localStorage.removeItem('ai_evaluator_state');
  };

  // Восстановление состояния при загрузке компонента
  useEffect(() => {
    const savedApiKey = localStorage.getItem('openai_api_key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }

    // Восстанавливаем состояние оценки, если оно есть (упрощенная версия)
    const savedState = loadEvaluationState();
    if (savedState && savedState.conversation.length > 0) {
      // Восстанавливаем только основное состояние без попыток продолжить оценку
      setStartupIdea(savedState.startupIdea);
      setBudget(savedState.budget);
      setCurrentStep(savedState.currentStep);
      setConversation(savedState.conversation);
      setFinalSummary(savedState.finalSummary);
      setPartialResult(savedState.partialResult);
      setBudgetUsed(savedState.budgetUsed);
      
      // Не пытаемся автоматически продолжать оценку
      setIsEvaluating(false);
    }
  }, []);

  // Автоматическое сохранение состояния при изменениях
  useEffect(() => {
    if (isEvaluating || conversation.length > 0 || partialResult || finalSummary) {
      saveEvaluationState({});
    }
  }, [isEvaluating, currentStep, conversation, partialResult, finalSummary, budgetUsed]);

  const handleStartEvaluation = async () => {
    if (!startupIdea.trim()) return;
    
    const currentApiKey = apiKey || localStorage.getItem('openai_api_key');
    if (!currentApiKey) {
      alert('Пожалуйста, введите ваш OpenAI API ключ');
      return;
    }
    
    if (apiKey) {
      localStorage.setItem('openai_api_key', apiKey);
    }

    // Очищаем предыдущее состояние при новом запуске
    clearSavedState();

    setIsEvaluating(true);
    setCurrentStep(0);
    setConversation([]);
    setFinalSummary(null);
    setPartialResult(null);
    setBudgetUsed(0);

    try {
      const service = new ApiEvaluationService();
      setEvaluationService(service);
      
      await service.evaluateIdea(
        startupIdea,
        currentApiKey,
        parseFloat(budget),
        (step, message, cost) => {
          setCurrentStep(step);
          setConversation(prev => [...prev, message]);
          setBudgetUsed(prev => prev + cost);
        },
        (summary) => {
          setFinalSummary(summary);
          setIsEvaluating(false);
          setPartialResult(null);
          clearSavedState(); // Очищаем сохраненное состояние после завершения
        },
        (partial) => {
          setPartialResult(partial);
        }
      );
    } catch (error) {
      console.error('Evaluation failed:', error);
      alert(`Ошибка оценки: ${error.message}`);
      setIsEvaluating(false);
      clearSavedState(); // Очищаем состояние при ошибке
    }
  };

  const handleStopEvaluation = () => {
    if (evaluationService) {
      evaluationService.stop();
      setIsEvaluating(false);
      // Сохраняем состояние при остановке, чтобы можно было продолжить
      saveEvaluationState({ isEvaluating: false });
    }
  };

  const handleThinkAgain = async () => {
    if (!evaluationService) return;
    
    setIsEvaluating(true);
    
    try {
      await evaluationService.continueEvaluation(
        (step, message, cost) => {
          setCurrentStep(step);
          setConversation(prev => [...prev, message]);
          setBudgetUsed(prev => prev + cost);
        },
        (summary) => {
          setFinalSummary(summary);
          setIsEvaluating(false);
          setPartialResult(null);
          clearSavedState(); // Очищаем сохраненное состояние после завершения
        },
        (partial) => {
          setPartialResult(partial);
        }
      );
    } catch (error) {
      console.error('Continue evaluation failed:', error);
      setIsEvaluating(false);
    }
  };

  const handleReset = () => {
    setIsEvaluating(false);
    setCurrentStep(0);
    setConversation([]);
    setFinalSummary(null);
    setPartialResult(null);
    setBudgetUsed(0);
    setEvaluationService(null);
    clearSavedState(); // Очищаем сохраненное состояние при сбросе
  };

  const showSplitView = isEvaluating || conversation.length > 0 || finalSummary || partialResult;

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className={`mx-auto space-y-8 ${showSplitView ? 'max-w-full' : 'max-w-5xl'}`}>
        {/* Header - Only show when not in split view */}
        {!showSplitView && (
          <div className="text-center space-y-4 py-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl glass-subtle">
                <Sparkles className="h-6 w-6 text-foreground-muted" />
              </div>
            </div>
            <h1 className="text-foreground tracking-tight">AI Startup Evaluator</h1>
            <p className="text-foreground-muted max-w-2xl mx-auto">
              Collaborative startup idea evaluation using autonomous AI agents
            </p>
          </div>
        )}

        {/* Input Form */}
        {!showSplitView && (
          <div className="glass-card rounded-2xl p-8 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="idea" className="text-foreground">Startup Concept</Label>
              <Textarea
                id="idea"
                placeholder="Describe your startup idea, vision, or thought fragment..."
                value={startupIdea}
                onChange={(e) => setStartupIdea(e.target.value)}
                className="min-h-32 glass-subtle border-0 resize-none text-foreground placeholder:text-foreground-subtle"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="apikey" className="text-foreground">OpenAI API Key</Label>
                <Input
                  id="apikey"
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="glass-subtle border-0 text-foreground placeholder:text-foreground-subtle"
                />
                <p className="text-xs text-foreground-subtle">Stored locally in your browser</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="budget" className="text-foreground">Evaluation Budget</Label>
                <Select value={budget} onValueChange={setBudget}>
                  <SelectTrigger className="glass-subtle border-0 text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass-card border-0">
                    <SelectItem value="0.1">$0.1 USD</SelectItem>
                    <SelectItem value="0.5">$0.5 USD</SelectItem>
                    <SelectItem value="1">$1 USD</SelectItem>
                    <SelectItem value="2">$2 USD</SelectItem>
                    <SelectItem value="3">$3 USD</SelectItem>
                    <SelectItem value="5">$5 USD</SelectItem>
                    <SelectItem value="10">$10 USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Button 
              onClick={handleStartEvaluation} 
              disabled={!startupIdea.trim()}
              className="w-full h-12 glass-subtle text-foreground hover:bg-primary-glass border-0 transition-all duration-300"
              size="lg"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Initialize Agent Evaluation
            </Button>
          </div>
        )}

        {/* Split View Layout */}
        {showSplitView && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-8rem)]">
            {/* Left Column - Process & Chat */}
            <div className="space-y-6">
              {/* Progress Header */}
              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg glass-subtle">
                      <Brain className="h-4 w-4 text-foreground-muted" />
                    </div>
                    <span className="text-foreground">Agent Evaluation</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-foreground-muted">
                      <DollarSign className="h-3 w-3" />
                      <span>${budgetUsed.toFixed(2)} / ${budget}</span>
                    </div>
                    
                    {/* Control Buttons - No Reset button on result page */}
                    <div className="flex gap-2">
                      {isEvaluating && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleStopEvaluation}
                          className="glass-subtle border-0 text-foreground-muted hover:text-foreground"
                        >
                          <Pause className="h-3 w-3 mr-1" />
                          Stop
                        </Button>
                      )}
                      
                      {!isEvaluating && (conversation.length > 0 || finalSummary) && (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleThinkAgain}
                            className="glass-subtle border-0 text-foreground-muted hover:text-foreground"
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Think Again
                          </Button>
                          
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleReset}
                            className="glass-subtle border-0 text-foreground-muted hover:text-foreground"
                          >
                            <Square className="h-3 w-3 mr-1" />
                            Reset
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <Progress 
                  value={(budgetUsed / parseFloat(budget)) * 100} 
                  className="h-1 bg-background-secondary"
                />
              </div>

              {/* Agent Status Cards - Single Row, Compact */}
              <div className="grid grid-cols-3 gap-2">
                {agents.map((agent, index) => {
                  const Icon = agent.icon;
                  const isActive = currentStep === index && isEvaluating;
                  const isCompleted = currentStep > index || finalSummary;
                  
                  return (
                    <div
                      key={agent.name}
                      className={`glass-card rounded-lg p-3 transition-all duration-300 ${
                        isActive 
                          ? 'ring-1 ring-primary/30 bg-primary-glass' 
                          : ''
                      }`}
                    >
                      <div className="flex flex-col items-center text-center space-y-2">
                        <div className={`p-2 rounded-lg transition-all duration-300 ${
                          isActive 
                            ? 'glass text-foreground ring-1 ring-primary/20' 
                            : isCompleted 
                              ? `${agent.color} glass-subtle` 
                              : 'glass-subtle text-foreground-subtle'
                        }`}>
                          <Icon className="h-3 w-3" />
                        </div>
                        <div className="min-h-[2.5rem]">
                          <h4 className="text-xs text-foreground font-medium">{agent.name}</h4>
                          <p className="text-xs text-foreground-subtle mt-1 leading-tight">{agent.description}</p>
                        </div>
                        {isActive && (
                          <div className="flex space-x-0.5">
                            <div className="w-1 h-1 rounded-full bg-primary animate-bounce"></div>
                            <div className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{animationDelay: '0.1s'}}></div>
                            <div className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{animationDelay: '0.2s'}}></div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Agent Conversation */}
              {conversation.length > 0 && (
                <div className="flex-1">
                  <AgentConversation messages={conversation} />
                </div>
              )}
            </div>

            {/* Right Column - Investor Document */}
            <div className="h-full">
              <InvestorDocument 
                startupPitch={partialResult?.startupPitch || finalSummary?.startupPitch}
                investmentVerdict={partialResult?.investmentVerdict || finalSummary?.investmentVerdict}
                isComplete={!!finalSummary}
                isEvaluating={isEvaluating}
              />
            </div>
          </div>
        )}

        {/* Final Summary (only show when not in split view and complete) */}
        {finalSummary && !showSplitView && (
          <FinalSummary summary={finalSummary} />
        )}
      </div>
    </div>
  );
}
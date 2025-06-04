import React from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { CheckCircle, XCircle, TrendingUp, AlertTriangle, Lightbulb, Target, Users, DollarSign, FileText, Clock } from 'lucide-react';

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

interface InvestorDocumentProps {
  startupPitch?: StartupPitch;
  investmentVerdict?: InvestmentVerdict;
  isComplete?: boolean;
  isEvaluating?: boolean;
}

export function InvestorDocument({ 
  startupPitch, 
  investmentVerdict, 
  isComplete = false,
  isEvaluating = false 
}: InvestorDocumentProps) {
  const isInvestment = investmentVerdict?.decision === 'invest';

  if (!startupPitch && !investmentVerdict) {
    return (
      <div className="glass-card rounded-2xl p-8 h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <FileText className="h-12 w-12 text-foreground-subtle mx-auto" />
          <div>
            <h3 className="text-foreground mb-2">Investment Analysis</h3>
            <p className="text-foreground-muted text-sm">
              Evaluation results will appear here as agents collaborate
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg glass-subtle">
            <FileText className="h-4 w-4 text-foreground-muted" />
          </div>
          <div>
            <h3 className="text-foreground font-medium">Investment Analysis</h3>
            {isEvaluating && !isComplete && (
              <div className="flex items-center gap-2 mt-1">
                <Clock className="h-3 w-3 text-foreground-subtle" />
                <span className="text-xs text-foreground-subtle">Live updates</span>
              </div>
            )}
          </div>
        </div>
        
        {!isComplete && isEvaluating && (
          <Badge variant="secondary" className="glass-subtle border-0 animate-pulse">
            Evaluating...
          </Badge>
        )}
        
        {isComplete && (
          <Badge variant="default" className="glass-subtle border-0">
            Complete
          </Badge>
        )}
      </div>

      <ScrollArea className="h-[calc(100vh-12rem)] pr-4">
        <div className="space-y-6">
          {/* Investment Decision */}
          {investmentVerdict && (
            <div className={`glass-card rounded-xl p-6 border-2 ${
              isInvestment 
                ? 'border-emerald-600/30 bg-emerald-600/5' 
                : 'border-rose-600/30 bg-rose-600/5'
            } ${!isComplete ? 'opacity-80' : ''}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg glass-subtle ${
                  isInvestment ? 'text-emerald-700' : 'text-rose-700'
                }`}>
                  {isInvestment ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                </div>
                <div>
                  <h4 className="text-foreground font-medium">
                    {isInvestment ? 'Investment Recommended' : 'Investment Declined'}
                  </h4>
                  <p className="text-sm text-foreground-muted">
                    {investmentVerdict.confidence}% confidence
                  </p>
                </div>
              </div>
              
              <div className="glass-subtle rounded-lg p-4">
                <p className="text-sm text-foreground leading-relaxed">
                  {investmentVerdict.reasoning}
                </p>
              </div>

              {investmentVerdict.strengths?.length > 0 && investmentVerdict.concerns?.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <TrendingUp className="h-3 w-3" />
                      <span className="text-xs font-medium">Strengths</span>
                    </div>
                    <div className="space-y-1">
                      {investmentVerdict.strengths.slice(0, 3).map((strength, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <div className="w-1 h-1 rounded-full bg-emerald-600 mt-1.5 flex-shrink-0"></div>
                          <span className="text-xs text-foreground-muted">{strength}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-orange-600">
                      <AlertTriangle className="h-3 w-3" />
                      <span className="text-xs font-medium">Concerns</span>
                    </div>
                    <div className="space-y-1">
                      {investmentVerdict.concerns.slice(0, 3).map((concern, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <div className="w-1 h-1 rounded-full bg-orange-600 mt-1.5 flex-shrink-0"></div>
                          <span className="text-xs text-foreground-muted">{concern}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Startup Overview */}
          {startupPitch && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-orange-600" />
                <h4 className="text-foreground font-medium">
                  {startupPitch.name}
                </h4>
              </div>

              <div className="grid gap-4">
                <DocumentSection 
                  icon={AlertTriangle} 
                  title="Problem Statement" 
                  content={startupPitch.problem}
                  iconColor="text-orange-600"
                />
                <DocumentSection 
                  icon={CheckCircle} 
                  title="Solution" 
                  content={startupPitch.solution}
                  iconColor="text-emerald-700"
                />
                <DocumentSection 
                  icon={Users} 
                  title="Target Market" 
                  content={startupPitch.market}
                  iconColor="text-sky-700"
                />
                <DocumentSection 
                  icon={DollarSign} 
                  title="Business Model" 
                  content={startupPitch.businessModel}
                  iconColor="text-emerald-700"
                />
                <DocumentSection 
                  icon={Target} 
                  title="Competitive Advantage" 
                  content={startupPitch.competitive}
                  iconColor="text-violet-700"
                />
                <DocumentSection 
                  icon={TrendingUp} 
                  title="Execution Strategy" 
                  content={startupPitch.execution}
                  iconColor="text-indigo-700"
                />
              </div>
            </div>
          )}

          {/* Next Steps */}
          {investmentVerdict?.recommendedNext?.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-foreground font-medium text-sm">Recommended Actions</h4>
              <div className="space-y-2">
                {investmentVerdict.recommendedNext.map((step, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="glass-subtle rounded px-1.5 py-0.5 mt-0.5">
                      <span className="text-xs text-foreground-muted font-medium">{index + 1}</span>
                    </div>
                    <span className="text-xs text-foreground-muted leading-relaxed">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function DocumentSection({ icon: Icon, title, content, iconColor }: {
  icon: React.ElementType;
  title: string;
  content: string;
  iconColor: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={`h-3 w-3 ${iconColor}`} />
        <span className="text-xs text-foreground font-medium">{title}</span>
      </div>
      <div className="glass-subtle rounded-lg p-3">
        <p className="text-xs text-foreground-muted leading-relaxed">{content}</p>
      </div>
    </div>
  );
}
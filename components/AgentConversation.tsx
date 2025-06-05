import React from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Brain, Shield, TrendingUp, Target, Clock } from 'lucide-react';

interface Message {
  id: string;
  agent: 'proposer' | 'critic' | 'investor' | 'system';
  content: string;
  timestamp: string;
  round: number;
}

interface AgentConversationProps {
  messages: Message[];
}

const agentConfig = {
  proposer: {
    name: 'Proposer',
    icon: Brain,
    gradient: 'from-sky-600/10 to-sky-700/5',
    accent: 'border-sky-600/20',
    iconColor: 'text-sky-700'
  },
  critic: {
    name: 'Critic',
    icon: Shield,
    gradient: 'from-rose-600/10 to-rose-700/5',
    accent: 'border-rose-600/20',
    iconColor: 'text-rose-700'
  },
  investor: {
    name: 'Investor',
    icon: Target,
    gradient: 'from-violet-600/10 to-violet-700/5',
    accent: 'border-violet-600/20',
    iconColor: 'text-violet-700'
  },
  system: {
    name: 'System',
    icon: TrendingUp,
    gradient: 'from-emerald-600/10 to-emerald-700/5',
    accent: 'border-emerald-600/20',
    iconColor: 'text-emerald-700'
  }
};

function AgentMessage({ message }: { message: Message }) {
  const agent = agentConfig[message.agent];
  const Icon = agent.icon;
  
  return (
    <div className="group space-y-2">
      {/* Agent Header */}
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg glass-subtle ${agent.iconColor}`}>
          <Icon className="h-3 w-3" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground font-medium">{agent.name}</span>
          <div className="flex items-center gap-1 text-xs text-foreground-subtle">
            <Clock className="h-2 w-2" />
            {message.timestamp}
          </div>
        </div>
      </div>
      
      {/* Message Content */}
      <div className={`glass-card rounded-lg p-3 ml-6 bg-gradient-to-br ${agent.gradient} border ${agent.accent}`}>
        <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}

function RoundSeparator({ round }: { round: string }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent"></div>
      <div className="glass-subtle rounded-full px-2 py-1">
        <span className="text-xs text-foreground-muted">Round {round}</span>
      </div>
      <div className="flex-1 h-px bg-gradient-to-r from-border via-transparent to-transparent"></div>
    </div>
  );
}

export function AgentConversation({ messages }: AgentConversationProps) {
  // Group messages by round for better organization
  const groupedMessages = messages.reduce((acc, message) => {
    const round = message.round;
    if (!acc[round]) {
      acc[round] = [];
    }
    acc[round].push(message);
    return acc;
  }, {} as Record<number, Message[]>);

  return (
    <div className="glass-card rounded-2xl p-4 h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg glass-subtle">
          <Brain className="h-3 w-3 text-foreground-muted" />
        </div>
        <h3 className="text-sm text-foreground font-medium">Agent Collaboration</h3>
      </div>
      
      <ScrollArea className="h-[calc(100%-3rem)] pr-2">
        <div className="space-y-4">
          {Object.entries(groupedMessages).map(([round, roundMessages]) => (
            <div key={round} className="space-y-3">
              <RoundSeparator round={round} />
              
              <div className="space-y-4">
                {roundMessages.map((message) => (
                  <AgentMessage key={message.id} message={message} />
                ))}
              </div>
            </div>
          ))}
          
          {messages.length === 0 && (
            <div className="text-center py-8">
              <Brain className="h-6 w-6 text-foreground-subtle mx-auto mb-2" />
              <p className="text-xs text-foreground-muted">Agent discussion will appear here</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
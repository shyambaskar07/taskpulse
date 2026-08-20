import React from 'react';
import { Cpu, Activity, RefreshCw, Zap, Server, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isWsConnected: boolean;
  onRefresh: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  isWsConnected,
  onRefresh,
}) => {
  const tabs = [
    { id: 'overview', label: 'System Overview', icon: Activity },
    { id: 'queues', label: 'Queues', icon: Server },
    { id: 'jobs', label: 'Job Explorer', icon: Zap },
    { id: 'workers', label: 'Worker Cluster', icon: Cpu },
    { id: 'dlq', label: 'Dead Letter Queue', icon: ShieldCheck },
    { id: 'api-tester', label: 'API Playground', icon: RefreshCw },
  ];

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-darkBorder bg-darkBg/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Branding */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentTab('overview')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-accentCyan to-accentViolet flex items-center justify-center shadow-lg shadow-accentCyan/20">
              <Zap className="w-5 h-5 text-black font-bold" />
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-accentCyan bg-clip-text text-transparent">
                TaskPulse
              </span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-accentCyan/10 text-accentCyan border border-accentCyan/20">
                v1.0 Distributed
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCurrentTab(tab.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-accentCyan/15 text-accentCyan border border-accentCyan/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Controls & Connection Status */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full glass-panel border border-slate-800 text-xs">
              <span
                className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                  isWsConnected ? 'bg-accentEmerald shadow-md shadow-accentEmerald/50' : 'bg-accentRose'
                }`}
              />
              <span className="text-slate-300 font-mono">
                {isWsConnected ? 'LIVE STREAM' : 'OFFLINE'}
              </span>
            </div>

            <button
              onClick={onRefresh}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
              title="Refresh Stats"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

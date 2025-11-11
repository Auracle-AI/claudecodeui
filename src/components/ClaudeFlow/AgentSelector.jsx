/**
 * AGENT SELECTOR
 * ==============
 * Select and configure claude-flow specialized agents
 */

import { useState, useEffect } from 'react';
import { useSwarm } from '../../contexts/SwarmContext';
import { Users, TrendingUp, CheckCircle } from 'lucide-react';

export default function AgentSelector({ onSelectAgents, selectedAgents = [] }) {
  const { agents, agentMetrics, fetchAgentMetrics } = useSwarm();
  const [selected, setSelected] = useState(selectedAgents);
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => {
    fetchAgentMetrics();
  }, [fetchAgentMetrics]);

  const handleToggle = (agentType) => {
    const newSelected = selected.includes(agentType)
      ? selected.filter(a => a !== agentType)
      : [...selected, agentType];

    setSelected(newSelected);
    if (onSelectAgents) {
      onSelectAgents(newSelected);
    }
  };

  const categories = ['all', ...Object.keys(agents)];

  const getAgentMetric = (agentType) => {
    return agentMetrics.find(m => m.agent_type === agentType);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Users className="w-5 h-5" />
          Agent Selector
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Select specialized agents for your swarm
        </p>

        {/* Selected count */}
        {selected.length > 0 && (
          <div className="mt-3 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <span className="text-sm text-blue-700 dark:text-blue-300">
              {selected.length} agent{selected.length !== 1 ? 's' : ''} selected
            </span>
          </div>
        )}
      </div>

      {/* Category Filter */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setFilterCategory(category)}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                filterCategory === category
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Agents List */}
      <div className="flex-1 overflow-y-auto p-4">
        {Object.entries(agents).map(([category, categoryAgents]) => {
          if (filterCategory !== 'all' && filterCategory !== category) {
            return null;
          }

          return (
            <div key={category} className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                {category}
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({categoryAgents.length})
                </span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categoryAgents.map((agent) => {
                  const isSelected = selected.includes(agent.type);
                  const metrics = getAgentMetric(agent.type);

                  return (
                    <div
                      key={agent.type}
                      onClick={() => handleToggle(agent.type)}
                      className={`border rounded-lg p-3 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                              {agent.name}
                            </h4>
                            {isSelected && (
                              <CheckCircle className="w-4 h-4 text-blue-600" />
                            )}
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {agent.description}
                          </p>
                        </div>
                      </div>

                      {/* Agent Metrics */}
                      {metrics && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3 text-gray-500" />
                              <span className="text-gray-600 dark:text-gray-400">
                                Used {metrics.usage_count}x
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">
                                {(metrics.success_rate * 100).toFixed(0)}% success
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">
                                {metrics.avg_completion_time_ms.toFixed(0)}ms avg
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      {selected.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex gap-2">
          <button
            onClick={() => {
              setSelected([]);
              if (onSelectAgents) {
                onSelectAgents([]);
              }
            }}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Clear Selection
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * SWARM CONTEXT
 * =============
 * React context for managing claude-flow swarm state across components
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const SwarmContext = createContext();

export function SwarmProvider({ children }) {
  const { token } = useAuth();
  const [swarms, setSwarms] = useState([]);
  const [activeSwarm, setActiveSwarm] = useState(null);
  const [agents, setAgents] = useState({});
  const [templates, setTemplates] = useState([]);
  const [memoryOperations, setMemoryOperations] = useState([]);
  const [agentMetrics, setAgentMetrics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch agents on mount
  useEffect(() => {
    if (token) {
      fetchAgents();
      fetchTemplates();
    }
  }, [token]);

  // Fetch available agents
  const fetchAgents = useCallback(async () => {
    try {
      const response = await fetch('/api/claude-flow/agents', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAgents(data.agentsByCategory || {});
      }
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    }
  }, [token]);

  // Fetch swarm templates
  const fetchTemplates = useCallback(async () => {
    try {
      const response = await fetch('/api/claude-flow/templates', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  }, [token]);

  // Create a new swarm session
  const createSwarm = useCallback(async (projectName, projectPath, taskDescription, swarmType = 'quick', agentTypes = []) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/claude-flow/swarm/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectName,
          projectPath,
          taskDescription,
          swarmType,
          agentTypes
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create swarm');
      }

      const swarm = await response.json();
      setSwarms(prev => [swarm, ...prev]);
      setActiveSwarm(swarm);
      setLoading(false);

      return swarm;
    } catch (err) {
      console.error('Failed to create swarm:', err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, [token]);

  // Execute a swarm task with streaming
  const executeSwarm = useCallback(async (sessionId, taskDescription, swarmType = 'quick', onMessage) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/claude-flow/swarm/execute', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId,
          taskDescription,
          swarmType,
          streaming: true
        })
      });

      if (!response.ok) {
        throw new Error('Failed to execute swarm');
      }

      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (onMessage) {
                onMessage(data);
              }

              // Update active swarm status
              if (data.type === 'completed' || data.type === 'failed') {
                setActiveSwarm(prev => prev ? { ...prev, status: data.type } : null);
              }
            } catch (err) {
              console.error('Failed to parse SSE message:', err);
            }
          }
        }
      }

      setLoading(false);
    } catch (err) {
      console.error('Failed to execute swarm:', err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, [token]);

  // Fetch swarm sessions
  const fetchSwarms = useCallback(async (projectName = null, limit = 50) => {
    try {
      const params = new URLSearchParams();
      if (projectName) params.append('projectName', projectName);
      params.append('limit', limit);

      const response = await fetch(`/api/claude-flow/swarm/sessions?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSwarms(data.sessions || []);
      }
    } catch (err) {
      console.error('Failed to fetch swarms:', err);
    }
  }, [token]);

  // Get swarm session details
  const getSwarmDetails = useCallback(async (sessionId) => {
    try {
      const response = await fetch(`/api/claude-flow/swarm/session/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (err) {
      console.error('Failed to get swarm details:', err);
      throw err;
    }
  }, [token]);

  // Abort a swarm session
  const abortSwarm = useCallback(async (sessionId) => {
    try {
      const response = await fetch(`/api/claude-flow/swarm/abort/${sessionId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setSwarms(prev => prev.map(s =>
          s.sessionId === sessionId ? { ...s, status: 'aborted' } : s
        ));
        if (activeSwarm?.sessionId === sessionId) {
          setActiveSwarm(prev => ({ ...prev, status: 'aborted' }));
        }
      }
    } catch (err) {
      console.error('Failed to abort swarm:', err);
      throw err;
    }
  }, [token, activeSwarm]);

  // Store data in memory
  const storeMemory = useCallback(async (namespace, key, content, projectPath) => {
    try {
      const response = await fetch('/api/claude-flow/memory/store', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          namespace,
          key,
          content,
          projectPath
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      } else {
        throw new Error('Failed to store memory');
      }
    } catch (err) {
      console.error('Failed to store memory:', err);
      throw err;
    }
  }, [token]);

  // Query memory
  const queryMemory = useCallback(async (namespace, query, operationType = 'query', projectPath) => {
    try {
      const response = await fetch('/api/claude-flow/memory/query', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          namespace,
          query,
          operationType,
          projectPath
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      } else {
        throw new Error('Failed to query memory');
      }
    } catch (err) {
      console.error('Failed to query memory:', err);
      throw err;
    }
  }, [token]);

  // Fetch memory operations
  const fetchMemoryOperations = useCallback(async (namespace = null, limit = 100) => {
    try {
      const params = new URLSearchParams();
      if (namespace) params.append('namespace', namespace);
      params.append('limit', limit);

      const response = await fetch(`/api/claude-flow/memory/operations?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMemoryOperations(data.operations || []);
      }
    } catch (err) {
      console.error('Failed to fetch memory operations:', err);
    }
  }, [token]);

  // Fetch agent metrics
  const fetchAgentMetrics = useCallback(async (agentType = null) => {
    try {
      const params = new URLSearchParams();
      if (agentType) params.append('agentType', agentType);

      const response = await fetch(`/api/claude-flow/metrics/agents?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAgentMetrics(data.metrics || []);
      }
    } catch (err) {
      console.error('Failed to fetch agent metrics:', err);
    }
  }, [token]);

  // Create custom template
  const createTemplate = useCallback(async (templateData) => {
    try {
      const response = await fetch('/api/claude-flow/templates', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(templateData)
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates(prev => [...prev, data.template]);
        return data.template;
      } else {
        throw new Error('Failed to create template');
      }
    } catch (err) {
      console.error('Failed to create template:', err);
      throw err;
    }
  }, [token]);

  const value = {
    swarms,
    activeSwarm,
    agents,
    templates,
    memoryOperations,
    agentMetrics,
    loading,
    error,
    createSwarm,
    executeSwarm,
    fetchSwarms,
    getSwarmDetails,
    abortSwarm,
    storeMemory,
    queryMemory,
    fetchMemoryOperations,
    fetchAgentMetrics,
    createTemplate,
    setActiveSwarm
  };

  return <SwarmContext.Provider value={value}>{children}</SwarmContext.Provider>;
}

export function useSwarm() {
  const context = useContext(SwarmContext);
  if (!context) {
    throw new Error('useSwarm must be used within a SwarmProvider');
  }
  return context;
}

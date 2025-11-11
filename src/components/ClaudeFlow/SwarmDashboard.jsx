/**
 * SWARM DASHBOARD
 * ===============
 * Main dashboard for managing claude-flow swarm operations
 */

import { useState, useEffect } from 'react';
import { useSwarm } from '../../contexts/SwarmContext';
import { PlayCircle, StopCircle, Clock, CheckCircle, XCircle, Loader2, Users, Zap } from 'lucide-react';

export default function SwarmDashboard({ projectName, projectPath }) {
  const {
    swarms,
    activeSwarm,
    loading,
    fetchSwarms,
    createSwarm,
    executeSwarm,
    abortSwarm,
    getSwarmDetails
  } = useSwarm();

  const [taskDescription, setTaskDescription] = useState('');
  const [swarmType, setSwarmType] = useState('quick');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [executionLogs, setExecutionLogs] = useState([]);
  const [selectedSwarm, setSelectedSwarm] = useState(null);
  const [swarmDetails, setSwarmDetails] = useState(null);

  useEffect(() => {
    if (projectName) {
      fetchSwarms(projectName);
    }
  }, [projectName, fetchSwarms]);

  const handleCreateAndExecute = async () => {
    if (!taskDescription.trim()) return;

    try {
      // Create swarm session
      const swarm = await createSwarm(projectName, projectPath, taskDescription, swarmType);

      // Execute swarm with streaming
      setExecutionLogs([]);
      setShowCreateForm(false);

      await executeSwarm(swarm.sessionId, taskDescription, swarmType, (message) => {
        setExecutionLogs(prev => [...prev, message]);
      });

      // Refresh swarms list
      await fetchSwarms(projectName);
      setTaskDescription('');
    } catch (err) {
      console.error('Failed to create/execute swarm:', err);
    }
  };

  const handleAbort = async (sessionId) => {
    try {
      await abortSwarm(sessionId);
      await fetchSwarms(projectName);
    } catch (err) {
      console.error('Failed to abort swarm:', err);
    }
  };

  const handleViewDetails = async (swarm) => {
    try {
      setSelectedSwarm(swarm);
      const details = await getSwarmDetails(swarm.sessionId);
      setSwarmDetails(details);
    } catch (err) {
      console.error('Failed to load swarm details:', err);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'aborted':
        return <StopCircle className="w-4 h-4 text-gray-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'aborted':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5" />
              Swarm Orchestration
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Multi-agent AI coordination powered by claude-flow
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            New Swarm
          </button>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Task Description
                </label>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Describe the task for the swarm to perform..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Swarm Type
                </label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="quick"
                      checked={swarmType === 'quick'}
                      onChange={(e) => setSwarmType(e.target.value)}
                      className="text-blue-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Quick Swarm <span className="text-xs text-gray-500">(Single task)</span>
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="hive-mind"
                      checked={swarmType === 'hive-mind'}
                      onChange={(e) => setSwarmType(e.target.value)}
                      className="text-blue-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Hive-Mind <span className="text-xs text-gray-500">(Complex coordination)</span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCreateAndExecute}
                  disabled={!taskDescription.trim() || loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-4 h-4" />
                      Create & Execute
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setTaskDescription('');
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active Swarm Execution */}
      {activeSwarm && executionLogs.length > 0 && (
        <div className="border-b border-gray-200 dark:border-gray-700 p-4 bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-gray-900 dark:text-white">
              Active Swarm: {activeSwarm.sessionId}
            </h3>
            <button
              onClick={() => handleAbort(activeSwarm.sessionId)}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Abort
            </button>
          </div>
          <div className="bg-gray-900 text-gray-100 p-3 rounded-lg font-mono text-xs max-h-48 overflow-y-auto">
            {executionLogs.map((log, idx) => (
              <div key={idx} className="mb-1">
                <span className="text-gray-500">[{log.type}]</span> {log.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Swarms List */}
      <div className="flex-1 overflow-y-auto p-4">
        {swarms.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              No swarms yet. Create your first swarm to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {swarms.map((swarm) => (
              <div
                key={swarm.session_id || swarm.sessionId}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                onClick={() => handleViewDetails(swarm)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(swarm.status)}
                      <span className={`text-xs px-2 py-1 rounded ${getStatusColor(swarm.status)}`}>
                        {swarm.status}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {swarm.swarm_type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 dark:text-white font-medium mb-1">
                      {swarm.task_description}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(swarm.created_at).toLocaleString()}
                    </p>
                  </div>
                  {swarm.status === 'active' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAbort(swarm.session_id || swarm.sessionId);
                      }}
                      className="ml-4 px-3 py-1 text-sm bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                    >
                      Abort
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Swarm Details Modal */}
      {selectedSwarm && swarmDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Swarm Details
              </h3>
              <button
                onClick={() => {
                  setSelectedSwarm(null);
                  setSwarmDetails(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Session ID</label>
                <p className="text-sm text-gray-900 dark:text-white font-mono">{swarmDetails.session.session_id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Task</label>
                <p className="text-sm text-gray-900 dark:text-white">{swarmDetails.session.task_description}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Workers ({swarmDetails.workerCount})</label>
                <div className="mt-2 space-y-2">
                  {swarmDetails.workers.map((worker) => (
                    <div key={worker.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{worker.agent_name}</span>
                        <span className={`text-xs px-2 py-1 rounded ${getStatusColor(worker.status)}`}>
                          {worker.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{worker.task}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

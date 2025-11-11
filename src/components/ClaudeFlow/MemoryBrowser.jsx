/**
 * MEMORY BROWSER
 * ==============
 * Browse and query claude-flow AgentDB memory
 */

import { useState, useEffect } from 'react';
import { useSwarm } from '../../contexts/SwarmContext';
import { Database, Search, Clock, TrendingUp, Save } from 'lucide-react';

export default function MemoryBrowser({ projectName, projectPath }) {
  const {
    memoryOperations,
    fetchMemoryOperations,
    storeMemory,
    queryMemory
  } = useSwarm();

  const [namespace, setNamespace] = useState(projectName || 'default');
  const [queryText, setQueryText] = useState('');
  const [queryType, setQueryType] = useState('query');
  const [queryResults, setQueryResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showStoreForm, setShowStoreForm] = useState(false);
  const [storeKey, setStoreKey] = useState('');
  const [storeContent, setStoreContent] = useState('');

  useEffect(() => {
    if (namespace) {
      fetchMemoryOperations(namespace);
    }
  }, [namespace, fetchMemoryOperations]);

  const handleQuery = async () => {
    if (!queryText.trim()) return;

    setLoading(true);
    try {
      const results = await queryMemory(namespace, queryText, queryType, projectPath);
      setQueryResults(results);
      await fetchMemoryOperations(namespace);
    } catch (err) {
      console.error('Query failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStore = async () => {
    if (!storeKey.trim() || !storeContent.trim()) return;

    setLoading(true);
    try {
      await storeMemory(namespace, storeKey, storeContent, projectPath);
      setStoreKey('');
      setStoreContent('');
      setShowStoreForm(false);
      await fetchMemoryOperations(namespace);
    } catch (err) {
      console.error('Store failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Database className="w-5 h-5" />
              Memory Browser
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Query and store data in AgentDB memory
            </p>
          </div>
          <button
            onClick={() => setShowStoreForm(!showStoreForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Store Data
          </button>
        </div>

        {/* Namespace Selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Namespace
          </label>
          <input
            type="text"
            value={namespace}
            onChange={(e) => setNamespace(e.target.value)}
            placeholder="Enter namespace..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        {/* Store Form */}
        {showStoreForm && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg mb-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              Store New Data
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Key
                </label>
                <input
                  type="text"
                  value={storeKey}
                  onChange={(e) => setStoreKey(e.target.value)}
                  placeholder="e.g., feature-specs"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Content
                </label>
                <textarea
                  value={storeContent}
                  onChange={(e) => setStoreContent(e.target.value)}
                  placeholder="Enter content to store..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  rows={4}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleStore}
                  disabled={!storeKey.trim() || !storeContent.trim() || loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Store
                </button>
                <button
                  onClick={() => {
                    setShowStoreForm(false);
                    setStoreKey('');
                    setStoreContent('');
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Query Interface */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Query
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
                placeholder="Enter search query..."
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <button
                onClick={handleQuery}
                disabled={!queryText.trim() || loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                {loading ? 'Querying...' : 'Query'}
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="query"
                checked={queryType === 'query'}
                onChange={(e) => setQueryType(e.target.value)}
                className="text-blue-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Pattern Match
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="vector-search"
                checked={queryType === 'vector-search'}
                onChange={(e) => setQueryType(e.target.value)}
                className="text-blue-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Vector Search <span className="text-xs text-gray-500">(Semantic)</span>
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Query Results */}
      {queryResults && (
        <div className="border-b border-gray-200 dark:border-gray-700 p-4 bg-green-50 dark:bg-green-900/20">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-gray-900 dark:text-white">
              Query Results ({queryResults.resultCount})
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {queryResults.latency}ms
            </span>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg max-h-64 overflow-y-auto">
            <pre className="text-xs text-gray-900 dark:text-white whitespace-pre-wrap">
              {JSON.stringify(queryResults.results, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Memory Operations History */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Recent Operations
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {memoryOperations.length} operations
          </span>
        </div>

        {memoryOperations.length === 0 ? (
          <div className="text-center py-12">
            <Database className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              No memory operations yet.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {memoryOperations.map((op) => (
              <div
                key={op.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {op.operation_type}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {op.namespace}
                      </span>
                      {op.success ? (
                        <span className="text-xs text-green-600 dark:text-green-400">✓</span>
                      ) : (
                        <span className="text-xs text-red-600 dark:text-red-400">✗</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {op.query_text || op.key_name || 'N/A'}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span>{new Date(op.created_at).toLocaleString()}</span>
                      <span>{op.latency_ms.toFixed(2)}ms</span>
                      {op.result_count > 0 && <span>{op.result_count} results</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Performance Stats */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Performance Metrics
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {memoryOperations.length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total Ops</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {memoryOperations.length > 0
                ? (memoryOperations.reduce((sum, op) => sum + op.latency_ms, 0) / memoryOperations.length).toFixed(1)
                : '0'}ms
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Avg Latency</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {memoryOperations.filter(op => op.success).length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Successful</div>
          </div>
        </div>
      </div>
    </div>
  );
}

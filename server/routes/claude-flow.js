/**
 * CLAUDE-FLOW ORCHESTRATION API
 * ==============================
 *
 * Backend API for managing claude-flow swarm operations, memory queries,
 * and agent coordination.
 */

import express from 'express';
import { spawn } from 'child_process';
import { swarmDb, credentialsDb } from '../database/db.js';
import crypto from 'crypto';
import path from 'path';

const router = express.Router();

// Claude-Flow agent definitions (64 specialized agents)
const AGENT_TYPES = {
  // Development Agents
  'code-analyzer': { category: 'Development', description: 'Analyze code structure and quality' },
  'code-generator': { category: 'Development', description: 'Generate new code from specifications' },
  'debugger': { category: 'Development', description: 'Debug and fix code issues' },
  'refactoring-agent': { category: 'Development', description: 'Refactor code for better quality' },
  'test-writer': { category: 'Development', description: 'Write comprehensive test suites' },
  'test-runner': { category: 'Development', description: 'Execute tests and report results' },
  'documentation': { category: 'Development', description: 'Generate documentation' },
  'architect': { category: 'Development', description: 'Design system architecture' },

  // Coordination Agents
  'queen-coordinator': { category: 'Coordination', description: 'Coordinate swarm operations' },
  'task-distributor': { category: 'Coordination', description: 'Distribute tasks to workers' },
  'dependency-manager': { category: 'Coordination', description: 'Manage task dependencies' },
  'progress-tracker': { category: 'Coordination', description: 'Track overall progress' },

  // Quality Assurance
  'security-auditor': { category: 'Quality', description: 'Audit code for security issues' },
  'performance-optimizer': { category: 'Quality', description: 'Optimize code performance' },
  'code-reviewer': { category: 'Quality', description: 'Review code for best practices' },
  'linter': { category: 'Quality', description: 'Lint code and enforce standards' },

  // GitHub Operations
  'github-pr-creator': { category: 'GitHub', description: 'Create pull requests' },
  'github-issue-manager': { category: 'GitHub', description: 'Manage GitHub issues' },
  'github-reviewer': { category: 'GitHub', description: 'Review pull requests' },
  'github-committer': { category: 'GitHub', description: 'Commit and push changes' },

  // Intelligence & Memory
  'memory-manager': { category: 'Intelligence', description: 'Manage AgentDB memory' },
  'pattern-matcher': { category: 'Intelligence', description: 'Match patterns in code' },
  'semantic-searcher': { category: 'Intelligence', description: 'Semantic code search' },
  'context-analyzer': { category: 'Intelligence', description: 'Analyze project context' }
};

/**
 * GET /api/claude-flow/agents
 * List all available claude-flow agents
 */
router.get('/agents', (req, res) => {
  try {
    const agentsByCategory = {};

    Object.entries(AGENT_TYPES).forEach(([type, info]) => {
      if (!agentsByCategory[info.category]) {
        agentsByCategory[info.category] = [];
      }
      agentsByCategory[info.category].push({
        type,
        name: type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: info.description
      });
    });

    res.json({
      success: true,
      agents: AGENT_TYPES,
      agentsByCategory,
      totalAgents: Object.keys(AGENT_TYPES).length
    });
  } catch (error) {
    console.error('Error listing agents:', error);
    res.status(500).json({ error: 'Failed to list agents', details: error.message });
  }
});

/**
 * POST /api/claude-flow/swarm/create
 * Create a new swarm session
 */
router.post('/swarm/create', async (req, res) => {
  try {
    const {
      projectName,
      projectPath,
      taskDescription,
      swarmType = 'quick', // 'quick' or 'hive-mind'
      agentTypes = [],
      namespace = null
    } = req.body;

    const userId = req.user?.id || 1; // Get from auth middleware

    if (!projectName || !projectPath || !taskDescription) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'projectName, projectPath, and taskDescription are required'
      });
    }

    // Generate unique session ID
    const sessionId = `swarm-${crypto.randomUUID()}`;

    // Create database record
    const swarmSession = swarmDb.createSwarmSession(
      userId,
      sessionId,
      projectName,
      projectPath,
      swarmType,
      taskDescription,
      { agentTypes }
    );

    console.log(`🐝 Created ${swarmType} swarm session: ${sessionId}`);

    res.json({
      success: true,
      sessionId: swarmSession.sessionId,
      namespace: swarmSession.namespace,
      swarmType,
      projectName,
      status: 'active'
    });
  } catch (error) {
    console.error('Error creating swarm:', error);
    res.status(500).json({ error: 'Failed to create swarm', details: error.message });
  }
});

/**
 * POST /api/claude-flow/swarm/execute
 * Execute a swarm task using claude-flow CLI
 */
router.post('/swarm/execute', async (req, res) => {
  try {
    const {
      sessionId,
      taskDescription,
      swarmType = 'quick',
      streaming = true
    } = req.body;

    if (!sessionId || !taskDescription) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'sessionId and taskDescription are required'
      });
    }

    const userId = req.user?.id || 1;

    // Get swarm session from database
    const swarmSession = swarmDb.getSwarmSession(sessionId);
    if (!swarmSession) {
      return res.status(404).json({ error: 'Swarm session not found' });
    }

    // Setup streaming if requested
    if (streaming) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
    }

    const sendEvent = (eventType, data) => {
      if (streaming) {
        res.write(`data: ${JSON.stringify({ type: eventType, ...data })}\n\n`);
      }
    };

    sendEvent('status', { message: 'Initializing swarm...', sessionId });

    // Get Claude API key from database
    const claudeApiKey = credentialsDb.getActiveCredential(userId, 'claude_api_key');
    if (!claudeApiKey) {
      const errorMsg = 'Claude API key not configured. Please add your Claude API key in settings.';
      sendEvent('error', { message: errorMsg, sessionId });
      if (streaming) {
        res.end();
      } else {
        res.status(400).json({ error: errorMsg });
      }
      return;
    }

    // Execute claude-flow command
    const args = ['claude-flow@alpha', 'swarm', taskDescription, '--claude'];
    if (swarmType === 'hive-mind') {
      args.push('--hive-mind');
    }

    const startTime = Date.now();
    const claudeFlowProcess = spawn('npx', args, {
      cwd: swarmSession.project_path,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: claudeApiKey
      }
    });

    let stdout = '';
    let stderr = '';

    claudeFlowProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      sendEvent('output', { message: chunk, sessionId });
    });

    claudeFlowProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      sendEvent('error', { message: chunk, sessionId });
    });

    claudeFlowProcess.on('close', (code) => {
      const duration = Date.now() - startTime;

      if (code === 0) {
        swarmDb.updateSwarmStatus(sessionId, 'completed');
        sendEvent('completed', {
          message: 'Swarm completed successfully',
          sessionId,
          duration,
          output: stdout
        });
      } else {
        swarmDb.updateSwarmStatus(sessionId, 'failed', stderr);
        sendEvent('failed', {
          message: 'Swarm execution failed',
          sessionId,
          duration,
          error: stderr
        });
      }

      if (streaming) {
        res.end();
      } else {
        res.json({
          success: code === 0,
          sessionId,
          duration,
          output: stdout,
          error: stderr
        });
      }
    });

    claudeFlowProcess.on('error', (error) => {
      console.error('Error executing claude-flow:', error);
      swarmDb.updateSwarmStatus(sessionId, 'failed', error.message);

      sendEvent('error', { message: error.message, sessionId });

      if (streaming) {
        res.end();
      } else {
        res.status(500).json({ error: 'Failed to execute swarm', details: error.message });
      }
    });

  } catch (error) {
    console.error('Error in swarm execution:', error);
    res.status(500).json({ error: 'Failed to execute swarm', details: error.message });
  }
});

/**
 * GET /api/claude-flow/swarm/sessions
 * Get swarm sessions for a user/project
 */
router.get('/swarm/sessions', async (req, res) => {
  try {
    const { projectName, limit = 50 } = req.query;
    const userId = req.user?.id || 1;

    const sessions = swarmDb.getSwarmSessions(userId, projectName, parseInt(limit));

    res.json({
      success: true,
      sessions,
      count: sessions.length
    });
  } catch (error) {
    console.error('Error getting swarm sessions:', error);
    res.status(500).json({ error: 'Failed to get sessions', details: error.message });
  }
});

/**
 * GET /api/claude-flow/swarm/session/:sessionId
 * Get details of a specific swarm session
 */
router.get('/swarm/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = swarmDb.getSwarmSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Swarm session not found' });
    }

    const workers = swarmDb.getWorkers(session.id);

    res.json({
      success: true,
      session,
      workers,
      workerCount: workers.length
    });
  } catch (error) {
    console.error('Error getting swarm session:', error);
    res.status(500).json({ error: 'Failed to get session details', details: error.message });
  }
});

/**
 * POST /api/claude-flow/swarm/abort/:sessionId
 * Abort a running swarm session
 */
router.post('/swarm/abort/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = swarmDb.getSwarmSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Swarm session not found' });
    }

    // Update status to aborted
    swarmDb.updateSwarmStatus(sessionId, 'aborted');

    console.log(`🛑 Aborted swarm session: ${sessionId}`);

    res.json({
      success: true,
      sessionId,
      status: 'aborted'
    });
  } catch (error) {
    console.error('Error aborting swarm:', error);
    res.status(500).json({ error: 'Failed to abort swarm', details: error.message });
  }
});

/**
 * POST /api/claude-flow/memory/store
 * Store data in claude-flow memory (ReasoningBank)
 */
router.post('/memory/store', async (req, res) => {
  try {
    const {
      namespace,
      key,
      content,
      projectPath = process.cwd()
    } = req.body;

    const userId = req.user?.id || 1;

    if (!namespace || !key || !content) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'namespace, key, and content are required'
      });
    }

    // Get Claude API key from database
    const claudeApiKey = credentialsDb.getActiveCredential(userId, 'claude_api_key');
    if (!claudeApiKey) {
      return res.status(400).json({
        error: 'Claude API key not configured',
        details: 'Please add your Claude API key in settings'
      });
    }

    const startTime = Date.now();

    // Execute claude-flow memory store command
    const args = ['claude-flow@alpha', 'memory', 'store', key, content];

    const memoryProcess = spawn('npx', args, {
      cwd: projectPath,
      env: {
        ...process.env,
        MEMORY_NAMESPACE: namespace,
        ANTHROPIC_API_KEY: claudeApiKey
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    memoryProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    memoryProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    memoryProcess.on('close', (code) => {
      const latency = Date.now() - startTime;

      // Log operation
      swarmDb.logMemoryOperation(
        userId,
        'store',
        namespace,
        key,
        null,
        0,
        latency,
        code === 0,
        stderr || null
      );

      if (code === 0) {
        res.json({
          success: true,
          namespace,
          key,
          latency,
          output: stdout
        });
      } else {
        res.status(500).json({
          error: 'Failed to store memory',
          details: stderr,
          latency
        });
      }
    });

  } catch (error) {
    console.error('Error storing memory:', error);
    res.status(500).json({ error: 'Failed to store memory', details: error.message });
  }
});

/**
 * POST /api/claude-flow/memory/query
 * Query claude-flow memory
 */
router.post('/memory/query', async (req, res) => {
  try {
    const {
      namespace,
      query,
      operationType = 'query', // 'query' or 'vector-search'
      projectPath = process.cwd()
    } = req.body;

    const userId = req.user?.id || 1;

    if (!namespace || !query) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'namespace and query are required'
      });
    }

    // Get Claude API key from database
    const claudeApiKey = credentialsDb.getActiveCredential(userId, 'claude_api_key');
    if (!claudeApiKey) {
      return res.status(400).json({
        error: 'Claude API key not configured',
        details: 'Please add your Claude API key in settings'
      });
    }

    const startTime = Date.now();

    // Execute claude-flow memory query command
    const commandType = operationType === 'vector-search' ? 'vector-search' : 'query';
    const args = ['claude-flow@alpha', 'memory', commandType, query];

    const memoryProcess = spawn('npx', args, {
      cwd: projectPath,
      env: {
        ...process.env,
        MEMORY_NAMESPACE: namespace,
        ANTHROPIC_API_KEY: claudeApiKey
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    memoryProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    memoryProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    memoryProcess.on('close', (code) => {
      const latency = Date.now() - startTime;

      // Parse results (assuming JSON output)
      let results = [];
      let resultCount = 0;

      if (code === 0 && stdout) {
        try {
          results = JSON.parse(stdout);
          resultCount = Array.isArray(results) ? results.length : 1;
        } catch {
          // Plain text output
          results = stdout;
          resultCount = 1;
        }
      }

      // Log operation
      swarmDb.logMemoryOperation(
        userId,
        operationType,
        namespace,
        null,
        query,
        resultCount,
        latency,
        code === 0,
        stderr || null
      );

      if (code === 0) {
        res.json({
          success: true,
          namespace,
          query,
          results,
          resultCount,
          latency
        });
      } else {
        res.status(500).json({
          error: 'Failed to query memory',
          details: stderr,
          latency
        });
      }
    });

  } catch (error) {
    console.error('Error querying memory:', error);
    res.status(500).json({ error: 'Failed to query memory', details: error.message });
  }
});

/**
 * GET /api/claude-flow/memory/operations
 * Get memory operation history
 */
router.get('/memory/operations', async (req, res) => {
  try {
    const { namespace, limit = 100 } = req.query;
    const userId = req.user?.id || 1;

    const operations = swarmDb.getMemoryOperations(userId, parseInt(limit), namespace);

    res.json({
      success: true,
      operations,
      count: operations.length
    });
  } catch (error) {
    console.error('Error getting memory operations:', error);
    res.status(500).json({ error: 'Failed to get operations', details: error.message });
  }
});

/**
 * GET /api/claude-flow/metrics/agents
 * Get agent performance metrics
 */
router.get('/metrics/agents', async (req, res) => {
  try {
    const { agentType } = req.query;
    const userId = req.user?.id || 1;

    const metrics = swarmDb.getAgentMetrics(userId, agentType);

    res.json({
      success: true,
      metrics,
      count: metrics.length
    });
  } catch (error) {
    console.error('Error getting agent metrics:', error);
    res.status(500).json({ error: 'Failed to get metrics', details: error.message });
  }
});

/**
 * GET /api/claude-flow/templates
 * Get swarm templates
 */
router.get('/templates', async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const includeSystem = req.query.includeSystem !== 'false';

    const templates = swarmDb.getSwarmTemplates(userId, includeSystem);

    res.json({
      success: true,
      templates,
      count: templates.length
    });
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json({ error: 'Failed to get templates', details: error.message });
  }
});

/**
 * POST /api/claude-flow/templates
 * Create custom swarm template
 */
router.post('/templates', async (req, res) => {
  try {
    const {
      templateName,
      description,
      swarmType,
      agentTypes,
      defaultNamespace,
      taskTemplate
    } = req.body;

    const userId = req.user?.id || 1;

    if (!templateName || !swarmType || !agentTypes) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'templateName, swarmType, and agentTypes are required'
      });
    }

    const template = swarmDb.createSwarmTemplate(
      userId,
      templateName,
      description,
      swarmType,
      agentTypes,
      defaultNamespace,
      taskTemplate
    );

    res.json({
      success: true,
      template
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template', details: error.message });
  }
});

/**
 * POST /api/claude-flow/mcp/check
 * Check if claude-flow is installed as MCP server
 */
router.post('/mcp/check', async (req, res) => {
  try {
    // Check if claude-flow is available
    const checkProcess = spawn('npx', ['claude-flow@alpha', '--version'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    checkProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    checkProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    checkProcess.on('close', (code) => {
      res.json({
        success: code === 0,
        installed: code === 0,
        version: stdout.trim() || 'unknown',
        message: code === 0 ? 'claude-flow is available' : 'claude-flow not found'
      });
    });

  } catch (error) {
    console.error('Error checking claude-flow:', error);
    res.status(500).json({ error: 'Failed to check claude-flow', details: error.message });
  }
});

export default router;

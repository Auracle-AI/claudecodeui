import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
};

const c = {
    info: (text) => `${colors.cyan}${text}${colors.reset}`,
    bright: (text) => `${colors.bright}${text}${colors.reset}`,
    dim: (text) => `${colors.dim}${text}${colors.reset}`,
};

// Use DATABASE_PATH environment variable if set, otherwise use default location
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'auth.db');
const INIT_SQL_PATH = path.join(__dirname, 'init.sql');
const SWARM_SCHEMA_PATH = path.join(__dirname, 'swarm-schema.sql');

// Ensure database directory exists if custom path is provided
if (process.env.DATABASE_PATH) {
  const dbDir = path.dirname(DB_PATH);
  try {
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log(`Created database directory: ${dbDir}`);
    }
  } catch (error) {
    console.error(`Failed to create database directory ${dbDir}:`, error.message);
    throw error;
  }
}

// Create database connection
const db = new Database(DB_PATH);

// Show app installation path prominently
const appInstallPath = path.join(__dirname, '../..');
console.log('');
console.log(c.dim('═'.repeat(60)));
console.log(`${c.info('[INFO]')} App Installation: ${c.bright(appInstallPath)}`);
console.log(`${c.info('[INFO]')} Database: ${c.dim(path.relative(appInstallPath, DB_PATH))}`);
if (process.env.DATABASE_PATH) {
  console.log(`       ${c.dim('(Using custom DATABASE_PATH from environment)')}`);
}
console.log(c.dim('═'.repeat(60)));
console.log('');

// Initialize database with schema
const initializeDatabase = async () => {
  try {
    const initSQL = fs.readFileSync(INIT_SQL_PATH, 'utf8');
    db.exec(initSQL);
    console.log('Database initialized successfully');

    // Initialize swarm schema
    try {
      const swarmSQL = fs.readFileSync(SWARM_SCHEMA_PATH, 'utf8');
      db.exec(swarmSQL);
      console.log('Swarm orchestration schema initialized successfully');
    } catch (swarmError) {
      console.warn('Note: Swarm schema initialization skipped (file may not exist yet)');
    }
  } catch (error) {
    console.error('Error initializing database:', error.message);
    throw error;
  }
};

// User database operations
const userDb = {
  // Check if any users exist
  hasUsers: () => {
    try {
      const row = db.prepare('SELECT COUNT(*) as count FROM users').get();
      return row.count > 0;
    } catch (err) {
      throw err;
    }
  },

  // Create a new user
  createUser: (username, passwordHash) => {
    try {
      const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
      const result = stmt.run(username, passwordHash);
      return { id: result.lastInsertRowid, username };
    } catch (err) {
      throw err;
    }
  },

  // Get user by username
  getUserByUsername: (username) => {
    try {
      const row = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
      return row;
    } catch (err) {
      throw err;
    }
  },

  // Update last login time
  updateLastLogin: (userId) => {
    try {
      db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
    } catch (err) {
      throw err;
    }
  },

  // Get user by ID
  getUserById: (userId) => {
    try {
      const row = db.prepare('SELECT id, username, created_at, last_login FROM users WHERE id = ? AND is_active = 1').get(userId);
      return row;
    } catch (err) {
      throw err;
    }
  },

  getFirstUser: () => {
    try {
      const row = db.prepare('SELECT id, username, created_at, last_login FROM users WHERE is_active = 1 LIMIT 1').get();
      return row;
    } catch (err) {
      throw err;
    }
  }
};

// API Keys database operations
const apiKeysDb = {
  // Generate a new API key
  generateApiKey: () => {
    return 'ck_' + crypto.randomBytes(32).toString('hex');
  },

  // Create a new API key
  createApiKey: (userId, keyName) => {
    try {
      const apiKey = apiKeysDb.generateApiKey();
      const stmt = db.prepare('INSERT INTO api_keys (user_id, key_name, api_key) VALUES (?, ?, ?)');
      const result = stmt.run(userId, keyName, apiKey);
      return { id: result.lastInsertRowid, keyName, apiKey };
    } catch (err) {
      throw err;
    }
  },

  // Get all API keys for a user
  getApiKeys: (userId) => {
    try {
      const rows = db.prepare('SELECT id, key_name, api_key, created_at, last_used, is_active FROM api_keys WHERE user_id = ? ORDER BY created_at DESC').all(userId);
      return rows;
    } catch (err) {
      throw err;
    }
  },

  // Validate API key and get user
  validateApiKey: (apiKey) => {
    try {
      const row = db.prepare(`
        SELECT u.id, u.username, ak.id as api_key_id
        FROM api_keys ak
        JOIN users u ON ak.user_id = u.id
        WHERE ak.api_key = ? AND ak.is_active = 1 AND u.is_active = 1
      `).get(apiKey);

      if (row) {
        // Update last_used timestamp
        db.prepare('UPDATE api_keys SET last_used = CURRENT_TIMESTAMP WHERE id = ?').run(row.api_key_id);
      }

      return row;
    } catch (err) {
      throw err;
    }
  },

  // Delete an API key
  deleteApiKey: (userId, apiKeyId) => {
    try {
      const stmt = db.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?');
      const result = stmt.run(apiKeyId, userId);
      return result.changes > 0;
    } catch (err) {
      throw err;
    }
  },

  // Toggle API key active status
  toggleApiKey: (userId, apiKeyId, isActive) => {
    try {
      const stmt = db.prepare('UPDATE api_keys SET is_active = ? WHERE id = ? AND user_id = ?');
      const result = stmt.run(isActive ? 1 : 0, apiKeyId, userId);
      return result.changes > 0;
    } catch (err) {
      throw err;
    }
  }
};

// User credentials database operations (for GitHub tokens, GitLab tokens, etc.)
const credentialsDb = {
  // Create a new credential
  createCredential: (userId, credentialName, credentialType, credentialValue, description = null) => {
    try {
      const stmt = db.prepare('INSERT INTO user_credentials (user_id, credential_name, credential_type, credential_value, description) VALUES (?, ?, ?, ?, ?)');
      const result = stmt.run(userId, credentialName, credentialType, credentialValue, description);
      return { id: result.lastInsertRowid, credentialName, credentialType };
    } catch (err) {
      throw err;
    }
  },

  // Get all credentials for a user, optionally filtered by type
  getCredentials: (userId, credentialType = null) => {
    try {
      let query = 'SELECT id, credential_name, credential_type, description, created_at, is_active FROM user_credentials WHERE user_id = ?';
      const params = [userId];

      if (credentialType) {
        query += ' AND credential_type = ?';
        params.push(credentialType);
      }

      query += ' ORDER BY created_at DESC';

      const rows = db.prepare(query).all(...params);
      return rows;
    } catch (err) {
      throw err;
    }
  },

  // Get active credential value for a user by type (returns most recent active)
  getActiveCredential: (userId, credentialType) => {
    try {
      const row = db.prepare('SELECT credential_value FROM user_credentials WHERE user_id = ? AND credential_type = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1').get(userId, credentialType);
      return row?.credential_value || null;
    } catch (err) {
      throw err;
    }
  },

  // Delete a credential
  deleteCredential: (userId, credentialId) => {
    try {
      const stmt = db.prepare('DELETE FROM user_credentials WHERE id = ? AND user_id = ?');
      const result = stmt.run(credentialId, userId);
      return result.changes > 0;
    } catch (err) {
      throw err;
    }
  },

  // Toggle credential active status
  toggleCredential: (userId, credentialId, isActive) => {
    try {
      const stmt = db.prepare('UPDATE user_credentials SET is_active = ? WHERE id = ? AND user_id = ?');
      const result = stmt.run(isActive ? 1 : 0, credentialId, userId);
      return result.changes > 0;
    } catch (err) {
      throw err;
    }
  }
};

// Backward compatibility - keep old names pointing to new system
const githubTokensDb = {
  createGithubToken: (userId, tokenName, githubToken, description = null) => {
    return credentialsDb.createCredential(userId, tokenName, 'github_token', githubToken, description);
  },
  getGithubTokens: (userId) => {
    return credentialsDb.getCredentials(userId, 'github_token');
  },
  getActiveGithubToken: (userId) => {
    return credentialsDb.getActiveCredential(userId, 'github_token');
  },
  deleteGithubToken: (userId, tokenId) => {
    return credentialsDb.deleteCredential(userId, tokenId);
  },
  toggleGithubToken: (userId, tokenId, isActive) => {
    return credentialsDb.toggleCredential(userId, tokenId, isActive);
  }
};

// Swarm orchestration database operations
const swarmDb = {
  // Create a new swarm session
  createSwarmSession: (userId, sessionId, projectName, projectPath, swarmType, taskDescription, metadata = {}) => {
    try {
      const stmt = db.prepare(`
        INSERT INTO swarm_sessions
        (session_id, user_id, project_name, project_path, swarm_type, task_description, namespace, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const namespace = `${projectName}-${Date.now()}`;
      const result = stmt.run(sessionId, userId, projectName, projectPath, swarmType, taskDescription, namespace, JSON.stringify(metadata));
      return { id: result.lastInsertRowid, sessionId, namespace };
    } catch (err) {
      throw err;
    }
  },

  // Get swarm session by ID
  getSwarmSession: (sessionId) => {
    try {
      const row = db.prepare('SELECT * FROM swarm_sessions WHERE session_id = ?').get(sessionId);
      if (row && row.metadata) {
        row.metadata = JSON.parse(row.metadata);
      }
      return row;
    } catch (err) {
      throw err;
    }
  },

  // Get all swarm sessions for a user/project
  getSwarmSessions: (userId, projectName = null, limit = 50) => {
    try {
      let query = 'SELECT * FROM swarm_sessions WHERE user_id = ?';
      const params = [userId];

      if (projectName) {
        query += ' AND project_name = ?';
        params.push(projectName);
      }

      query += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);

      const rows = db.prepare(query).all(...params);
      return rows.map(row => {
        if (row.metadata) row.metadata = JSON.parse(row.metadata);
        return row;
      });
    } catch (err) {
      throw err;
    }
  },

  // Update swarm session status
  updateSwarmStatus: (sessionId, status, errorMessage = null) => {
    try {
      const completedAt = (status === 'completed' || status === 'failed' || status === 'aborted')
        ? new Date().toISOString()
        : null;

      const stmt = db.prepare(`
        UPDATE swarm_sessions
        SET status = ?, error_message = ?, completed_at = ?
        WHERE session_id = ?
      `);
      const result = stmt.run(status, errorMessage, completedAt, sessionId);
      return result.changes > 0;
    } catch (err) {
      throw err;
    }
  },

  // Set queen agent for hive-mind swarms
  setQueenAgent: (sessionId, queenAgent) => {
    try {
      const stmt = db.prepare('UPDATE swarm_sessions SET queen_agent = ? WHERE session_id = ?');
      const result = stmt.run(queenAgent, sessionId);
      return result.changes > 0;
    } catch (err) {
      throw err;
    }
  },

  // Create swarm worker
  createWorker: (swarmSessionId, workerId, agentType, agentName, task, metadata = {}) => {
    try {
      const stmt = db.prepare(`
        INSERT INTO swarm_workers
        (swarm_session_id, worker_id, agent_type, agent_name, task, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(swarmSessionId, workerId, agentType, agentName, task, JSON.stringify(metadata));
      return { id: result.lastInsertRowid, workerId };
    } catch (err) {
      throw err;
    }
  },

  // Get workers for a swarm session
  getWorkers: (swarmSessionId) => {
    try {
      const rows = db.prepare('SELECT * FROM swarm_workers WHERE swarm_session_id = ? ORDER BY started_at DESC').all(swarmSessionId);
      return rows.map(row => {
        if (row.metadata) row.metadata = JSON.parse(row.metadata);
        return row;
      });
    } catch (err) {
      throw err;
    }
  },

  // Update worker status
  updateWorkerStatus: (workerId, status, result = null, errorMessage = null) => {
    try {
      const now = new Date().toISOString();
      const startedAt = status === 'active' ? now : null;
      const completedAt = (status === 'completed' || status === 'failed') ? now : null;

      const stmt = db.prepare(`
        UPDATE swarm_workers
        SET status = ?, result = ?, error_message = ?, started_at = COALESCE(started_at, ?), completed_at = ?
        WHERE worker_id = ?
      `);
      const result_obj = stmt.run(status, result, errorMessage, startedAt, completedAt, workerId);
      return result_obj.changes > 0;
    } catch (err) {
      throw err;
    }
  },

  // Update worker token usage
  updateWorkerTokens: (workerId, inputTokens, outputTokens) => {
    try {
      const totalTokens = inputTokens + outputTokens;
      const stmt = db.prepare(`
        UPDATE swarm_workers
        SET input_tokens = ?, output_tokens = ?, total_tokens = ?
        WHERE worker_id = ?
      `);
      const result = stmt.run(inputTokens, outputTokens, totalTokens, workerId);
      return result.changes > 0;
    } catch (err) {
      throw err;
    }
  },

  // Log memory operation
  logMemoryOperation: (userId, operationType, namespace, keyName = null, queryText = null, resultCount = 0, latencyMs = 0, success = true, errorMessage = null, swarmSessionId = null, metadata = {}) => {
    try {
      const stmt = db.prepare(`
        INSERT INTO memory_operations
        (user_id, swarm_session_id, operation_type, namespace, key_name, query_text, result_count, latency_ms, success, error_message, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(userId, swarmSessionId, operationType, namespace, keyName, queryText, resultCount, latencyMs, success ? 1 : 0, errorMessage, JSON.stringify(metadata));
      return { id: result.lastInsertRowid };
    } catch (err) {
      throw err;
    }
  },

  // Get memory operations
  getMemoryOperations: (userId, limit = 100, namespace = null) => {
    try {
      let query = 'SELECT * FROM memory_operations WHERE user_id = ?';
      const params = [userId];

      if (namespace) {
        query += ' AND namespace = ?';
        params.push(namespace);
      }

      query += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);

      const rows = db.prepare(query).all(...params);
      return rows.map(row => {
        if (row.metadata) row.metadata = JSON.parse(row.metadata);
        return row;
      });
    } catch (err) {
      throw err;
    }
  },

  // Update agent metrics
  updateAgentMetrics: (userId, agentType, inputTokens, outputTokens, completionTimeMs, success) => {
    try {
      const totalTokens = inputTokens + outputTokens;

      // Try to get existing metrics
      const existing = db.prepare('SELECT * FROM agent_metrics WHERE user_id = ? AND agent_type = ?').get(userId, agentType);

      if (existing) {
        // Update existing metrics
        const newUsageCount = existing.usage_count + 1;
        const newTotalInputTokens = existing.total_input_tokens + inputTokens;
        const newTotalOutputTokens = existing.total_output_tokens + outputTokens;
        const newTotalTokens = existing.total_tokens + totalTokens;

        // Calculate new average completion time
        const newAvgTime = ((existing.avg_completion_time_ms * existing.usage_count) + completionTimeMs) / newUsageCount;

        // Calculate new success rate
        const successCount = existing.success_rate * existing.usage_count + (success ? 1 : 0);
        const newSuccessRate = successCount / newUsageCount;

        const stmt = db.prepare(`
          UPDATE agent_metrics
          SET usage_count = ?,
              total_input_tokens = ?,
              total_output_tokens = ?,
              total_tokens = ?,
              avg_completion_time_ms = ?,
              success_rate = ?,
              last_used = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ? AND agent_type = ?
        `);
        stmt.run(newUsageCount, newTotalInputTokens, newTotalOutputTokens, newTotalTokens, newAvgTime, newSuccessRate, userId, agentType);
      } else {
        // Insert new metrics
        const stmt = db.prepare(`
          INSERT INTO agent_metrics
          (user_id, agent_type, usage_count, total_input_tokens, total_output_tokens, total_tokens, avg_completion_time_ms, success_rate, last_used)
          VALUES (?, ?, 1, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        stmt.run(userId, agentType, inputTokens, outputTokens, totalTokens, completionTimeMs, success ? 1.0 : 0.0);
      }

      return true;
    } catch (err) {
      throw err;
    }
  },

  // Get agent metrics
  getAgentMetrics: (userId, agentType = null) => {
    try {
      let query = 'SELECT * FROM agent_metrics WHERE user_id = ?';
      const params = [userId];

      if (agentType) {
        query += ' AND agent_type = ?';
        params.push(agentType);
      }

      query += ' ORDER BY usage_count DESC';

      const rows = db.prepare(query).all(...params);
      return rows;
    } catch (err) {
      throw err;
    }
  },

  // Get swarm templates
  getSwarmTemplates: (userId = null, includeSystem = true) => {
    try {
      let query = 'SELECT * FROM swarm_templates WHERE ';
      const params = [];

      if (includeSystem && userId) {
        query += '(is_system = 1 OR user_id = ?)';
        params.push(userId);
      } else if (includeSystem) {
        query += 'is_system = 1';
      } else if (userId) {
        query += 'user_id = ?';
        params.push(userId);
      } else {
        return [];
      }

      query += ' ORDER BY is_system DESC, created_at DESC';

      const rows = db.prepare(query).all(...params);
      return rows.map(row => {
        if (row.agent_types) row.agent_types = JSON.parse(row.agent_types);
        return row;
      });
    } catch (err) {
      throw err;
    }
  },

  // Create custom swarm template
  createSwarmTemplate: (userId, templateName, description, swarmType, agentTypes, defaultNamespace = null, taskTemplate = null) => {
    try {
      const stmt = db.prepare(`
        INSERT INTO swarm_templates
        (user_id, template_name, description, swarm_type, agent_types, default_namespace, task_template, is_system)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `);
      const result = stmt.run(userId, templateName, description, swarmType, JSON.stringify(agentTypes), defaultNamespace, taskTemplate);
      return { id: result.lastInsertRowid, templateName };
    } catch (err) {
      throw err;
    }
  }
};

export {
  db,
  initializeDatabase,
  userDb,
  apiKeysDb,
  credentialsDb,
  githubTokensDb, // Backward compatibility
  swarmDb
};
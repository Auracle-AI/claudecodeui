-- Claude-Flow Swarm Orchestration Schema
-- Tables for tracking swarm sessions, workers, and memory operations
PRAGMA foreign_keys = ON;

-- Swarm Sessions table - tracks active and historical swarm operations
CREATE TABLE IF NOT EXISTS swarm_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,         -- UUID for the swarm session
    user_id INTEGER NOT NULL,                -- User who created the swarm
    project_name TEXT NOT NULL,              -- Project name from projects
    project_path TEXT NOT NULL,              -- Full path to project
    swarm_type TEXT NOT NULL,                -- 'quick' or 'hive-mind'
    queen_agent TEXT,                        -- Name of queen agent (for hive-mind)
    task_description TEXT NOT NULL,          -- Original task description
    status TEXT DEFAULT 'active',            -- 'active', 'completed', 'failed', 'aborted'
    namespace TEXT,                          -- Memory namespace for this swarm
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    error_message TEXT,                      -- Error details if failed
    metadata JSON,                           -- Additional metadata (agents used, etc.)
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_swarm_sessions_session_id ON swarm_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_swarm_sessions_user_id ON swarm_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_swarm_sessions_project_name ON swarm_sessions(project_name);
CREATE INDEX IF NOT EXISTS idx_swarm_sessions_status ON swarm_sessions(status);
CREATE INDEX IF NOT EXISTS idx_swarm_sessions_created_at ON swarm_sessions(created_at);

-- Swarm Workers table - tracks individual agents within a swarm
CREATE TABLE IF NOT EXISTS swarm_workers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    swarm_session_id INTEGER NOT NULL,       -- Foreign key to swarm_sessions
    worker_id TEXT NOT NULL,                 -- Unique ID for this worker
    agent_type TEXT NOT NULL,                -- Type of agent (e.g., 'code-analyzer', 'test-writer')
    agent_name TEXT NOT NULL,                -- Display name of agent
    task TEXT NOT NULL,                      -- Specific task for this worker
    status TEXT DEFAULT 'pending',           -- 'pending', 'active', 'completed', 'failed'
    started_at DATETIME,
    completed_at DATETIME,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    result TEXT,                             -- Worker result/output
    error_message TEXT,                      -- Error details if failed
    metadata JSON,                           -- Additional worker metadata
    FOREIGN KEY (swarm_session_id) REFERENCES swarm_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_swarm_workers_session_id ON swarm_workers(swarm_session_id);
CREATE INDEX IF NOT EXISTS idx_swarm_workers_worker_id ON swarm_workers(worker_id);
CREATE INDEX IF NOT EXISTS idx_swarm_workers_status ON swarm_workers(status);
CREATE INDEX IF NOT EXISTS idx_swarm_workers_agent_type ON swarm_workers(agent_type);

-- Memory Operations table - tracks AgentDB and ReasoningBank queries
CREATE TABLE IF NOT EXISTS memory_operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    swarm_session_id INTEGER,                -- Optional: link to swarm session
    operation_type TEXT NOT NULL,            -- 'store', 'query', 'vector-search', 'store-vector'
    namespace TEXT,                          -- Memory namespace
    key_name TEXT,                           -- Key for store operations
    query_text TEXT,                         -- Query for search operations
    result_count INTEGER,                    -- Number of results returned
    latency_ms REAL,                         -- Query latency in milliseconds
    success BOOLEAN DEFAULT 1,               -- Whether operation succeeded
    error_message TEXT,                      -- Error details if failed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata JSON,                           -- Additional operation metadata
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (swarm_session_id) REFERENCES swarm_sessions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_memory_operations_user_id ON memory_operations(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_operations_session_id ON memory_operations(swarm_session_id);
CREATE INDEX IF NOT EXISTS idx_memory_operations_type ON memory_operations(operation_type);
CREATE INDEX IF NOT EXISTS idx_memory_operations_namespace ON memory_operations(namespace);
CREATE INDEX IF NOT EXISTS idx_memory_operations_created_at ON memory_operations(created_at);

-- Agent Performance Metrics table - aggregated stats per agent type
CREATE TABLE IF NOT EXISTS agent_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    agent_type TEXT NOT NULL,                -- Type of agent
    usage_count INTEGER DEFAULT 0,           -- Times this agent was used
    total_input_tokens INTEGER DEFAULT 0,
    total_output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    avg_completion_time_ms REAL,             -- Average time to complete tasks
    success_rate REAL,                       -- Percentage of successful completions
    last_used DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, agent_type)              -- One row per user per agent type
);

CREATE INDEX IF NOT EXISTS idx_agent_metrics_user_id ON agent_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent_type ON agent_metrics(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_usage_count ON agent_metrics(usage_count);

-- Swarm Templates table - predefined swarm configurations
CREATE TABLE IF NOT EXISTS swarm_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,                         -- NULL for system templates, user_id for custom
    template_name TEXT NOT NULL,
    description TEXT,
    swarm_type TEXT NOT NULL,                -- 'quick' or 'hive-mind'
    agent_types JSON NOT NULL,               -- Array of agent types to use
    default_namespace TEXT,                  -- Default memory namespace
    task_template TEXT,                      -- Template for task description with placeholders
    is_system BOOLEAN DEFAULT 0,             -- System template vs user template
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_swarm_templates_user_id ON swarm_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_swarm_templates_is_system ON swarm_templates(is_system);

-- Insert default system templates
INSERT OR IGNORE INTO swarm_templates (template_name, description, swarm_type, agent_types, default_namespace, task_template, is_system) VALUES
('Bug Fix Swarm', 'Quickly identify and fix bugs in code', 'quick', '["code-analyzer", "debugger", "test-writer"]', 'bugfix', 'Analyze and fix: {{description}}', 1),
('Feature Development', 'Develop new features from requirements', 'hive-mind', '["architect", "code-generator", "test-writer", "documentation"]', 'feature', 'Implement feature: {{description}}', 1),
('Code Review', 'Comprehensive code review with suggestions', 'quick', '["code-analyzer", "security-auditor", "performance-optimizer"]', 'review', 'Review code in: {{path}}', 1),
('Refactoring', 'Refactor code for better quality', 'hive-mind', '["architect", "code-analyzer", "refactoring-agent", "test-writer"]', 'refactor', 'Refactor: {{description}}', 1),
('Documentation', 'Generate comprehensive documentation', 'quick', '["documentation", "code-analyzer"]', 'docs', 'Document: {{path}}', 1),
('Testing', 'Create comprehensive test suites', 'quick', '["test-writer", "test-runner", "code-analyzer"]', 'testing', 'Create tests for: {{path}}', 1);

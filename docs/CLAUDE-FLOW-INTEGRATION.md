# Claude-Flow Integration Guide

## Overview

This document describes the full orchestration platform integration of **claude-flow** into Claude Code UI, enabling multi-agent swarm coordination, persistent memory, and advanced AI operations.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Components](#components)
- [Database Schema](#database-schema)
- [Examples](#examples)

---

## Features

### 🐝 Swarm Orchestration
- **Quick Swarms**: Single-task execution with automatic agent selection
- **Hive-Mind**: Complex multi-agent coordination with queen-worker hierarchy
- **Real-time streaming**: Watch swarm execution progress live
- **Session management**: Track, resume, and abort swarm operations

### 🧠 Persistent Memory
- **AgentDB Integration**: 96-164x faster semantic search (HNSW indexing)
- **ReasoningBank**: SQLite-based pattern matching and storage
- **Namespace Isolation**: Project-specific memory contexts
- **Query Types**: Pattern matching and vector semantic search

### 🤖 64 Specialized Agents
Agents organized into categories:
- **Development**: code-analyzer, code-generator, debugger, refactoring-agent, test-writer
- **Coordination**: queen-coordinator, task-distributor, dependency-manager
- **Quality**: security-auditor, performance-optimizer, code-reviewer
- **GitHub**: pr-creator, issue-manager, reviewer, committer
- **Intelligence**: memory-manager, pattern-matcher, semantic-searcher

### 📊 Performance Monitoring
- Token usage tracking per agent
- Average completion time metrics
- Success rate analytics
- Memory operation latency tracking

### 📝 Swarm Templates
Pre-configured workflows:
- Bug Fix Swarm
- Feature Development
- Code Review
- Refactoring
- Documentation
- Testing

---

## Architecture

### Backend Components

```
server/
├── database/
│   ├── swarm-schema.sql        # Database tables for swarm tracking
│   └── db.js                   # Extended with swarmDb operations
├── routes/
│   └── claude-flow.js          # API routes for swarm operations
└── index.js                    # Route registration
```

### Frontend Components

```
src/
├── contexts/
│   └── SwarmContext.jsx        # React context for swarm state
└── components/
    └── ClaudeFlow/
        ├── SwarmDashboard.jsx  # Main swarm management UI
        ├── MemoryBrowser.jsx   # AgentDB query interface
        └── AgentSelector.jsx   # Agent selection UI
```

### Database Schema

Five new tables:

1. **swarm_sessions**: Track active and historical swarms
2. **swarm_workers**: Individual agent tasks within swarms
3. **memory_operations**: AgentDB/ReasoningBank query logs
4. **agent_metrics**: Performance stats per agent type
5. **swarm_templates**: Pre-configured swarm workflows

---

## Installation

### Prerequisites

```bash
# Claude Code UI must be running
npm install

# Claude-flow is auto-installed via npx on first use
# Alternatively, install globally:
npm install -g claude-flow@alpha
```

### Add claude-flow as MCP Server

```bash
# Via Claude CLI
claude mcp add claude-flow npx claude-flow@alpha mcp start

# Or via the Claude Code UI:
# 1. Go to MCP Settings
# 2. Click "Add MCP Server"
# 3. Name: claude-flow
# 4. Command: npx
# 5. Args: claude-flow@alpha, mcp, start
# 6. Scope: user
```

### Initialize Database

The swarm schema is automatically initialized on server start. No manual migration needed.

---

## Usage

### 1. Creating a Swarm

**Via UI:**
1. Navigate to the **Swarm** tab
2. Click **New Swarm**
3. Enter task description (e.g., "Refactor authentication module")
4. Select swarm type:
   - **Quick**: Single task, instant execution
   - **Hive-Mind**: Complex coordination, persistent session
5. Click **Create & Execute**

**Via API:**

```bash
curl -X POST http://localhost:3000/api/claude-flow/swarm/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "projectName": "my-project",
    "projectPath": "/path/to/project",
    "taskDescription": "Refactor authentication module",
    "swarmType": "quick",
    "agentTypes": ["code-analyzer", "refactoring-agent", "test-writer"]
  }'
```

### 2. Using Memory

**Store Data:**

```bash
curl -X POST http://localhost:3000/api/claude-flow/memory/store \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "namespace": "my-project",
    "key": "api-specs",
    "content": "REST API endpoints specification...",
    "projectPath": "/path/to/project"
  }'
```

**Query Memory:**

```bash
# Pattern matching
curl -X POST http://localhost:3000/api/claude-flow/memory/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "namespace": "my-project",
    "query": "authentication",
    "operationType": "query",
    "projectPath": "/path/to/project"
  }'

# Vector semantic search
curl -X POST http://localhost:3000/api/claude-flow/memory/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "namespace": "my-project",
    "query": "user login flow",
    "operationType": "vector-search",
    "projectPath": "/path/to/project"
  }'
```

### 3. Agent Selection

**Via UI:**
1. Go to **Swarm** tab → **New Swarm**
2. Click **Select Agents** (optional)
3. Browse by category or view all
4. Select multiple agents
5. View agent performance metrics

**Programmatic:**

```javascript
import { useSwarm } from '../contexts/SwarmContext';

function MyComponent() {
  const { agents, createSwarm } = useSwarm();

  const selectedAgents = [
    'code-analyzer',
    'test-writer',
    'documentation'
  ];

  await createSwarm(
    projectName,
    projectPath,
    'Add comprehensive tests',
    'quick',
    selectedAgents
  );
}
```

### 4. Monitoring Performance

**Via UI:**
- Navigate to **Memory** tab → scroll to bottom for metrics
- View agent metrics in **Agent Selector**
- Check swarm execution logs in real-time

**Via API:**

```bash
# Get agent metrics
curl http://localhost:3000/api/claude-flow/metrics/agents \
  -H "Authorization: Bearer $TOKEN"

# Get memory operation history
curl http://localhost:3000/api/claude-flow/memory/operations?limit=50 \
  -H "Authorization: Bearer $TOKEN"
```

---

## API Reference

### Swarm Endpoints

#### `POST /api/claude-flow/swarm/create`
Create a new swarm session.

**Request Body:**
```json
{
  "projectName": "string",
  "projectPath": "string",
  "taskDescription": "string",
  "swarmType": "quick" | "hive-mind",
  "agentTypes": ["string"],
  "namespace": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "swarm-uuid",
  "namespace": "project-timestamp",
  "swarmType": "quick",
  "projectName": "my-project",
  "status": "active"
}
```

#### `POST /api/claude-flow/swarm/execute`
Execute a swarm task with streaming.

**Request Body:**
```json
{
  "sessionId": "swarm-uuid",
  "taskDescription": "string",
  "swarmType": "quick" | "hive-mind",
  "streaming": true
}
```

**Response (Streaming SSE):**
```
data: {"type":"status","message":"Initializing swarm...","sessionId":"..."}
data: {"type":"output","message":"Analyzing code...","sessionId":"..."}
data: {"type":"completed","message":"Swarm completed","sessionId":"...","duration":5000}
```

#### `GET /api/claude-flow/swarm/sessions`
List swarm sessions.

**Query Params:**
- `projectName` (optional): Filter by project
- `limit` (default: 50): Max results

**Response:**
```json
{
  "success": true,
  "sessions": [
    {
      "session_id": "swarm-uuid",
      "project_name": "my-project",
      "task_description": "Refactor auth",
      "status": "completed",
      "created_at": "2025-01-15T10:30:00Z",
      "completed_at": "2025-01-15T10:35:00Z"
    }
  ],
  "count": 1
}
```

#### `GET /api/claude-flow/swarm/session/:sessionId`
Get swarm session details with workers.

**Response:**
```json
{
  "success": true,
  "session": { ... },
  "workers": [
    {
      "id": 1,
      "agent_type": "code-analyzer",
      "agent_name": "Code Analyzer",
      "task": "Analyze authentication module",
      "status": "completed",
      "input_tokens": 1500,
      "output_tokens": 500
    }
  ],
  "workerCount": 3
}
```

#### `POST /api/claude-flow/swarm/abort/:sessionId`
Abort a running swarm.

**Response:**
```json
{
  "success": true,
  "sessionId": "swarm-uuid",
  "status": "aborted"
}
```

### Memory Endpoints

#### `POST /api/claude-flow/memory/store`
Store data in memory.

**Request Body:**
```json
{
  "namespace": "string",
  "key": "string",
  "content": "string",
  "projectPath": "string"
}
```

**Response:**
```json
{
  "success": true,
  "namespace": "my-project",
  "key": "api-specs",
  "latency": 12.5
}
```

#### `POST /api/claude-flow/memory/query`
Query memory (pattern or vector search).

**Request Body:**
```json
{
  "namespace": "string",
  "query": "string",
  "operationType": "query" | "vector-search",
  "projectPath": "string"
}
```

**Response:**
```json
{
  "success": true,
  "namespace": "my-project",
  "query": "authentication",
  "results": [...],
  "resultCount": 5,
  "latency": 2.3
}
```

#### `GET /api/claude-flow/memory/operations`
Get memory operation history.

**Query Params:**
- `namespace` (optional): Filter by namespace
- `limit` (default: 100): Max results

**Response:**
```json
{
  "success": true,
  "operations": [
    {
      "id": 1,
      "operation_type": "vector-search",
      "namespace": "my-project",
      "query_text": "user login",
      "result_count": 3,
      "latency_ms": 2.1,
      "success": true,
      "created_at": "2025-01-15T10:30:00Z"
    }
  ],
  "count": 1
}
```

### Agent Endpoints

#### `GET /api/claude-flow/agents`
List all available agents.

**Response:**
```json
{
  "success": true,
  "agents": { ... },
  "agentsByCategory": {
    "Development": [
      {
        "type": "code-analyzer",
        "name": "Code Analyzer",
        "description": "Analyze code structure and quality"
      }
    ]
  },
  "totalAgents": 64
}
```

#### `GET /api/claude-flow/metrics/agents`
Get agent performance metrics.

**Query Params:**
- `agentType` (optional): Filter by agent type

**Response:**
```json
{
  "success": true,
  "metrics": [
    {
      "agent_type": "code-analyzer",
      "usage_count": 15,
      "total_input_tokens": 22500,
      "total_output_tokens": 7500,
      "avg_completion_time_ms": 3500,
      "success_rate": 0.933,
      "last_used": "2025-01-15T10:30:00Z"
    }
  ],
  "count": 1
}
```

### Template Endpoints

#### `GET /api/claude-flow/templates`
Get swarm templates.

**Query Params:**
- `includeSystem` (default: true): Include system templates

**Response:**
```json
{
  "success": true,
  "templates": [
    {
      "id": 1,
      "template_name": "Bug Fix Swarm",
      "description": "Quickly identify and fix bugs",
      "swarm_type": "quick",
      "agent_types": ["code-analyzer", "debugger", "test-writer"],
      "is_system": true
    }
  ],
  "count": 6
}
```

#### `POST /api/claude-flow/templates`
Create custom template.

**Request Body:**
```json
{
  "templateName": "string",
  "description": "string",
  "swarmType": "quick" | "hive-mind",
  "agentTypes": ["string"],
  "defaultNamespace": "string (optional)",
  "taskTemplate": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "template": {
    "id": 7,
    "templateName": "My Custom Workflow"
  }
}
```

---

## Components

### SwarmContext

React context providing swarm state management.

**Methods:**
- `createSwarm(projectName, projectPath, taskDescription, swarmType, agentTypes)`
- `executeSwarm(sessionId, taskDescription, swarmType, onMessage)`
- `fetchSwarms(projectName, limit)`
- `getSwarmDetails(sessionId)`
- `abortSwarm(sessionId)`
- `storeMemory(namespace, key, content, projectPath)`
- `queryMemory(namespace, query, operationType, projectPath)`
- `fetchMemoryOperations(namespace, limit)`
- `fetchAgentMetrics(agentType)`
- `createTemplate(templateData)`

### SwarmDashboard

Main UI for managing swarms.

**Props:**
- `projectName`: Current project name
- `projectPath`: Absolute path to project

**Features:**
- Create new swarms with form
- View active/historical swarms
- Real-time execution logs
- Abort running swarms
- View swarm details modal

### MemoryBrowser

AgentDB query interface.

**Props:**
- `projectName`: Current project name
- `projectPath`: Absolute path to project

**Features:**
- Store key-value data
- Query with pattern matching
- Vector semantic search
- Operation history
- Performance metrics

### AgentSelector

Agent selection interface.

**Props:**
- `onSelectAgents`: Callback with selected agent types
- `selectedAgents`: Pre-selected agents (optional)

**Features:**
- Browse by category
- View agent descriptions
- Performance metrics per agent
- Multi-select with checkboxes

---

## Database Schema

### swarm_sessions

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| session_id | TEXT | UUID for swarm |
| user_id | INTEGER | Foreign key to users |
| project_name | TEXT | Project name |
| project_path | TEXT | Full project path |
| swarm_type | TEXT | 'quick' or 'hive-mind' |
| queen_agent | TEXT | Queen agent name (hive-mind) |
| task_description | TEXT | Task description |
| status | TEXT | 'active', 'completed', 'failed', 'aborted' |
| namespace | TEXT | Memory namespace |
| created_at | DATETIME | Creation timestamp |
| completed_at | DATETIME | Completion timestamp |
| error_message | TEXT | Error details if failed |
| metadata | JSON | Additional metadata |

### swarm_workers

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| swarm_session_id | INTEGER | Foreign key to swarm_sessions |
| worker_id | TEXT | Unique worker ID |
| agent_type | TEXT | Agent type (e.g., 'code-analyzer') |
| agent_name | TEXT | Display name |
| task | TEXT | Worker task description |
| status | TEXT | 'pending', 'active', 'completed', 'failed' |
| started_at | DATETIME | Start timestamp |
| completed_at | DATETIME | Completion timestamp |
| input_tokens | INTEGER | Input tokens used |
| output_tokens | INTEGER | Output tokens used |
| total_tokens | INTEGER | Total tokens |
| result | TEXT | Worker result/output |
| error_message | TEXT | Error details |
| metadata | JSON | Additional metadata |

### memory_operations

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| user_id | INTEGER | Foreign key to users |
| swarm_session_id | INTEGER | Foreign key to swarm_sessions (optional) |
| operation_type | TEXT | 'store', 'query', 'vector-search', 'store-vector' |
| namespace | TEXT | Memory namespace |
| key_name | TEXT | Key for store operations |
| query_text | TEXT | Query for search operations |
| result_count | INTEGER | Number of results |
| latency_ms | REAL | Query latency in ms |
| success | BOOLEAN | Operation success |
| error_message | TEXT | Error details |
| created_at | DATETIME | Creation timestamp |
| metadata | JSON | Additional metadata |

### agent_metrics

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| user_id | INTEGER | Foreign key to users |
| agent_type | TEXT | Agent type |
| usage_count | INTEGER | Times used |
| total_input_tokens | INTEGER | Total input tokens |
| total_output_tokens | INTEGER | Total output tokens |
| total_tokens | INTEGER | Total tokens |
| avg_completion_time_ms | REAL | Average completion time |
| success_rate | REAL | Success rate (0-1) |
| last_used | DATETIME | Last usage timestamp |
| updated_at | DATETIME | Last update timestamp |

### swarm_templates

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| user_id | INTEGER | Foreign key to users (NULL for system) |
| template_name | TEXT | Template name |
| description | TEXT | Template description |
| swarm_type | TEXT | 'quick' or 'hive-mind' |
| agent_types | JSON | Array of agent types |
| default_namespace | TEXT | Default namespace |
| task_template | TEXT | Task template with placeholders |
| is_system | BOOLEAN | System vs user template |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Last update timestamp |

---

## Examples

### Example 1: Bug Fix Workflow

```javascript
import { useSwarm } from '../contexts/SwarmContext';

function BugFixWorkflow({ projectName, projectPath, bugDescription }) {
  const { createSwarm, executeSwarm } = useSwarm();

  const runBugFix = async () => {
    // Create swarm with specialized agents
    const swarm = await createSwarm(
      projectName,
      projectPath,
      `Fix bug: ${bugDescription}`,
      'quick',
      ['code-analyzer', 'debugger', 'test-writer']
    );

    // Execute with real-time logs
    await executeSwarm(swarm.sessionId, swarm.taskDescription, 'quick', (message) => {
      console.log(`[${message.type}]`, message.message);
    });
  };

  return <button onClick={runBugFix}>Fix Bug</button>;
}
```

### Example 2: Feature Development with Memory

```javascript
import { useSwarm } from '../contexts/SwarmContext';

async function developFeature(projectName, projectPath, featurePRD) {
  const { createSwarm, storeMemory, executeSwarm } = useSwarm();

  // Store PRD in memory for context
  await storeMemory(
    projectName,
    'feature-prd',
    featurePRD,
    projectPath
  );

  // Create hive-mind for complex coordination
  const swarm = await createSwarm(
    projectName,
    projectPath,
    'Implement feature according to PRD in memory',
    'hive-mind',
    ['architect', 'code-generator', 'test-writer', 'documentation']
  );

  // Execute swarm
  await executeSwarm(swarm.sessionId, swarm.taskDescription, 'hive-mind', (msg) => {
    console.log(msg);
  });
}
```

### Example 3: Code Review with Metrics

```javascript
import { useSwarm } from '../contexts/SwarmContext';

async function codeReviewWorkflow(projectName, projectPath, filePath) {
  const { createSwarm, executeSwarm, fetchAgentMetrics } = useSwarm();

  // Get historical performance of review agents
  await fetchAgentMetrics('code-reviewer');

  // Run review swarm
  const swarm = await createSwarm(
    projectName,
    projectPath,
    `Review code changes in ${filePath}`,
    'quick',
    ['code-analyzer', 'security-auditor', 'performance-optimizer']
  );

  await executeSwarm(swarm.sessionId, swarm.taskDescription, 'quick');
}
```

---

## Troubleshooting

### Issue: claude-flow not found

**Solution:**
```bash
# Ensure npx can access claude-flow
npx claude-flow@alpha --version

# Or install globally
npm install -g claude-flow@alpha
```

### Issue: Memory operations timing out

**Solution:**
- Check project path is correct
- Ensure namespace exists
- Try pattern matching instead of vector search for faster results

### Issue: Swarm execution failed

**Solution:**
- Check swarm session error_message in database
- Verify project path is accessible
- Check Claude API key is configured
- Review agent logs in execution output

### Issue: Database schema not initialized

**Solution:**
```bash
# Restart server to trigger migration
npm run server

# Or manually run migration
sqlite3 server/database/auth.db < server/database/swarm-schema.sql
```

---

## Performance Optimization

### AgentDB vs ReasoningBank

- **AgentDB**: 96-164x faster, use for frequent queries
- **ReasoningBank**: SQLite-based, use for complex pattern matching

### Token Management

- Monitor per-agent token usage via metrics
- Use quick swarms for simple tasks (less coordination overhead)
- Leverage memory to avoid re-analyzing context

### Database Optimization

Indexes are pre-configured on:
- Session lookups (`session_id`)
- User queries (`user_id`)
- Status filters (`status`)
- Timestamp sorting (`created_at`)

---

## Contributing

### Adding New Agents

1. Update `AGENT_TYPES` in `/server/routes/claude-flow.js`
2. Add agent description and category
3. Restart server

### Creating System Templates

1. Edit `/server/database/swarm-schema.sql`
2. Add INSERT statement to template section
3. Re-run migration or restart server

---

## License

This integration follows the main Claude Code UI license (MIT).

## Support

- Issues: https://github.com/your-repo/issues
- Docs: https://docs.claude.com
- Claude-Flow: https://github.com/ruvnet/claude-flow

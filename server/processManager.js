// import { spawn } from 'child_process';
// import { nanoid } from 'nanoid';
// import { db } from './db.js';
// import fs from 'fs';

// const executions = new Map(); // executionId -> { proc, agentId, clients: Set(res), buffer: [], done, exitCode, cleanupTimer, dbExecutionId }
// const ANSI_PATTERN = /[\u001B\u009B][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

// const stripAnsi = (input = '') => input.replace(ANSI_PATTERN, '');

// export async function startExecution(agentId, instruction, options = {}) {
//   const executionId = nanoid();
//   const cmd = options.cmd || process.env.CLINE_CMD || 'cline';
//   const cwd = options.cwd || process.env.CLINE_CWD || process.cwd();
//   const extraArgsEnv = options.extraArgs ?? process.env.CLINE_EXTRA_ARGS ?? '';
//   const extraArgs = typeof extraArgsEnv === 'string' && extraArgsEnv.trim().length
//     ? extraArgsEnv.match(/(?:[^\s\"]+|"[^"]*")+/g).map(s => s.replace(/^"|"$/g, ''))
//     : [];
//   const shouldPersist = options.persist !== false;
//   if (shouldPersist && (agentId === null || agentId === undefined)) {
//     throw new Error('agentId is required when persisting executions');
//   }
  
//   // Add mode, files, images from options
//   const mode = options.mode || 'plan';
//   const files = options.files || [];
//   const images = options.images || [];

//   // Spawn process; send instruction via stdin for generic compatibility
//   if (!cmd || typeof cmd !== 'string') {
//     throw new Error('CLINE_CMD is not set to a valid command');
//   }
//   try {
//     if (options.cwd || process.env.CLINE_CWD) {
//       const st = fs.statSync(cwd);
//       if (!st.isDirectory()) throw new Error(`CLINE_CWD is not a directory: ${cwd}`);
//     }
//   } catch (e) {
//     throw new Error(`Invalid CLINE_CWD: ${cwd}`);
//   }
//   let proc;
//   try {
//     const args = [...extraArgs];
//     // Add mode flag
//     if (mode === 'act') {
//       args.push('--mode', 'act');
//     } else if (mode === 'oneshot') {
//       args.push('--oneshot');
//     }
//     // Add file attachments
//     files.forEach(f => { args.push('-f', f); });
//     // Add image attachments
//     images.forEach(img => { args.push('-i', img); });
//     // Add instruction as positional arg
//     if (instruction) args.push(instruction);
//     console.log('[processManager] spawn', cmd, args.join(' '), 'cwd=', cwd);
//     proc = spawn(cmd, args, { cwd, shell: false, env: process.env });
//   } catch (e) {
//     throw new Error(`Failed to spawn command: ${e.message}`);
//   }

//   // Create execution record in DB and wait for it (if persisting)
//   let dbExecutionId = null;
//   if (shouldPersist) {
//     await new Promise((resolve, reject) => {
//       db.run(
//         'INSERT INTO executions(agent_id, pid, status) VALUES (?,?,?)',
//         [agentId, proc.pid, 'running'],
//         function (err) { 
//           if (err) return reject(err);
//           dbExecutionId = this.lastID; 
//           resolve(); 
//         }
//       );
//     });
//   }

//   executions.set(executionId, {
//     proc,
//     agentId: shouldPersist ? agentId : null,
//     dbExecutionId,
//     clients: new Set(),
//     buffer: [],
//     done: false,
//     exitCode: null,
//     cleanupTimer: null,
//     persist: shouldPersist,
//   });

//   const writeLog = (type, chunk) => {
//     const raw = chunk.toString();
//     const text = stripAnsi(raw);
//     console.log('[processManager]', type, 'chunk:', JSON.stringify(text));
//     const exec = executions.get(executionId);
//     if (exec) {
//       exec.buffer.push({ type, text, ts: Date.now() });
//       if (exec.buffer.length > 1000) exec.buffer.shift();
//       // Broadcast to connected SSE clients
//       const data = JSON.stringify({ type, text, ts: Date.now() });
//       for (const res of exec.clients) {
//         res.write(`event: ${type}\n`);
//         res.write(`data: ${data}\n\n`);
//       }
//     }
//     // Persist per line if needed
//     if (exec?.persist && exec.dbExecutionId) {
//       text.split(/\r?\n/).forEach((line) => {
//         if (!line) return;
//         db.run(
//           'INSERT INTO logs(agent_id, output, type, execution_id) VALUES (?,?,?,?)',
//           [exec.agentId, line, type, exec.dbExecutionId]
//         );
//       });
//     }
//   };

//   proc.stdout.on('data', (d) => writeLog('stdout', d));
//   proc.stderr.on('data', (d) => writeLog('stderr', d));

//   proc.on('close', (code) => {
//     const exec = executions.get(executionId);
//     if (exec) {
//       exec.done = true;
//       exec.exitCode = Number.isInteger(code) ? code : null;
//       if (exec.cleanupTimer) clearTimeout(exec.cleanupTimer);
//       // Mark execution finished if persisted
//       if (exec.persist && exec.dbExecutionId) {
//         db.run(
//           'UPDATE executions SET status = ?, exit_code = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?',
//           ['finished', Number.isInteger(code) ? code : null, exec.dbExecutionId]
//         );
//       }
//       const payload = JSON.stringify({ done: true, code });
//       for (const res of exec.clients) {
//         res.write(`event: close\n`);
//         res.write(`data: ${payload}\n\n`);
//         res.end();
//       }
//       exec.cleanupTimer = setTimeout(() => {
//         executions.delete(executionId);
//       }, 60000);
//     }
//   });

//   // Keep stdin open for interactive chat; initial prompt is passed as arg already

//   return { executionId, pid: proc.pid, executionDbId: dbExecutionId };
// }

// export function attachClient(executionId, res) {
//   const exec = executions.get(executionId);
//   if (!exec) return false;
//   exec.clients.add(res);
//   res.on('close', () => {
//     exec.clients.delete(res);
//   });
//   // replay buffered events to new client
//   if (exec.buffer.length > 0) {
//     for (const item of exec.buffer) {
//       const data = JSON.stringify({ type: item.type, text: item.text, ts: item.ts });
//       res.write(`event: ${item.type}\n`);
//       res.write(`data: ${data}\n\n`);
//     }
//   }
//   if (exec.done) {
//     const payload = JSON.stringify({ done: true, code: exec.exitCode });
//     res.write(`event: close\n`);
//     res.write(`data: ${payload}\n\n`);
//     res.end();
//   }
//   return true;
// }

// export function killExecution(executionId) {
//   const exec = executions.get(executionId);
//   if (!exec || exec.done) return false;
//   try {
//     exec.proc.kill('SIGTERM');
//     return true;
//   } catch (e) {
//     return false;
//   }
// }

// export function sendInput(executionId, text) {
//   const exec = executions.get(executionId);
//   if (!exec || exec.done) return false;
//   try {
//     exec.proc.stdin.write(text + '\n');
//     return true;
//   } catch (e) {
//     return false;
//   }
// }

// export function hasExecution(executionId) {
//   return executions.has(executionId);
// }
import { spawn } from 'child_process';
import { nanoid } from 'nanoid';
import { db } from './db.js';
import fs from 'fs';
import path from 'path';

const executions = new Map();
const ANSI_PATTERN = /[\u001B\u009B][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
const MAX_BUFFER_SIZE = 1000;
const MAX_CLIENTS_PER_EXECUTION = 50;
const CLEANUP_DELAY = 60000;
const FORCE_KILL_TIMEOUT = 30000;
const MAX_CONCURRENT_EXECUTIONS = 100;

const stripAnsi = (input = '') => input.replace(ANSI_PATTERN, '');

function parseShellArgs(argsString) {
  if (!argsString || !argsString.trim()) return [];
  const args = [];
  let current = '';
  let inQuote = null;
  let escaped = false;

  for (let i = 0; i < argsString.length; i++) {
    const char = argsString[i];
    
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"' || char === "'") {
      if (inQuote === char) {
        inQuote = null;
      } else if (!inQuote) {
        inQuote = char;
      } else {
        current += char;
      }
      continue;
    }

    if (char === ' ' && !inQuote) {
      if (current) {
        args.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current) args.push(current);
  return args;
}

function validatePath(filePath, basePath) {
  try {
    const resolved = path.resolve(basePath, filePath);
    if (!resolved.startsWith(path.resolve(basePath))) {
      throw new Error('Path traversal detected');
    }
    return resolved;
  } catch (e) {
    throw new Error(`Invalid path: ${filePath}`);
  }
}

export async function startExecution(agentId, instruction, options = {}) {
  if (executions.size >= MAX_CONCURRENT_EXECUTIONS) {
    throw new Error('Maximum concurrent executions reached');
  }

  const executionId = nanoid();
  const cmd = options.cmd || process.env.CLINE_CMD || 'cline';
  const cwd = options.cwd || process.env.CLINE_CWD || process.cwd();
  const extraArgsEnv = options.extraArgs ?? process.env.CLINE_EXTRA_ARGS ?? '';
  const extraArgs = parseShellArgs(extraArgsEnv);
  const shouldPersist = options.persist !== false;

  if (shouldPersist && (agentId === null || agentId === undefined)) {
    throw new Error('agentId is required when persisting executions');
  }
  
  const mode = options.mode || 'plan';
  const files = options.files || [];
  const images = options.images || [];

  // Validate command
  if (!cmd || typeof cmd !== 'string') {
    throw new Error('CLINE_CMD is not set to a valid command');
  }

  // Validate working directory
  try {
    const st = fs.statSync(cwd);
    if (!st.isDirectory()) {
      throw new Error(`CLINE_CWD is not a directory: ${cwd}`);
    }
  } catch (e) {
    throw new Error(`Invalid CLINE_CWD: ${cwd} - ${e.message}`);
  }

  // Validate file and image paths
  try {
    files.forEach(f => validatePath(f, cwd));
    images.forEach(img => validatePath(img, cwd));
  } catch (e) {
    throw new Error(`Path validation failed: ${e.message}`);
  }

  // Build arguments
  const args = [...extraArgs];
  if (mode === 'act') {
    args.push('--mode', 'act');
  } else if (mode === 'oneshot') {
    args.push('--oneshot');
  }
  files.forEach(f => { args.push('-f', f); });
  images.forEach(img => { args.push('-i', img); });
  if (instruction) args.push(instruction);

  console.log('[processManager] spawn', cmd, args.join(' '), 'cwd=', cwd);

  // Spawn process
  let proc;
  try {
    proc = spawn(cmd, args, { cwd, shell: false, env: process.env });
  } catch (e) {
    throw new Error(`Failed to spawn command: ${e.message}`);
  }

  // Handle spawn errors
  proc.on('error', (err) => {
    console.error('[processManager] Process error:', err);
    const exec = executions.get(executionId);
    if (exec && !exec.done) {
      exec.done = true;
      exec.exitCode = -1;
      broadcastToClients(exec, 'error', { message: err.message });
      cleanupExecution(executionId, exec);
    }
  });

  // Create execution record in DB
  let dbExecutionId = null;
  if (shouldPersist) {
    try {
      dbExecutionId = await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO executions(agent_id, pid, status) VALUES (?,?,?)',
          [agentId, proc.pid, 'running'],
          function (err) { 
            if (err) return reject(err);
            resolve(this.lastID); 
          }
        );
      });
    } catch (err) {
      proc.kill('SIGKILL');
      throw new Error(`Failed to create execution record: ${err.message}`);
    }
  }

  const exec = {
    proc,
    agentId: shouldPersist ? agentId : null,
    dbExecutionId,
    clients: new Set(),
    buffer: [],
    done: false,
    exitCode: null,
    cleanupTimer: null,
    forceKillTimer: null,
    persist: shouldPersist,
    startTime: Date.now(),
  };

  executions.set(executionId, exec);

  const writeLog = (type, chunk) => {
    const raw = chunk.toString();
    const text = stripAnsi(raw);
    console.log('[processManager]', type, 'chunk:', JSON.stringify(text.substring(0, 100)));
    
    const currentExec = executions.get(executionId);
    if (!currentExec) return;

    currentExec.buffer.push({ type, text, ts: Date.now() });
    if (currentExec.buffer.length > MAX_BUFFER_SIZE) {
      currentExec.buffer.shift();
    }

    broadcastToClients(currentExec, type, { text, ts: Date.now() });

    // Persist logs to DB
    if (currentExec.persist && currentExec.dbExecutionId) {
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      lines.forEach((line) => {
        db.run(
          'INSERT INTO logs(agent_id, output, type, execution_id) VALUES (?,?,?,?)',
          [currentExec.agentId, line, type, currentExec.dbExecutionId],
          (err) => {
            if (err) console.error('[processManager] Failed to insert log:', err);
          }
        );
      });
    }
  };

  proc.stdout.on('data', (d) => writeLog('stdout', d));
  proc.stderr.on('data', (d) => writeLog('stderr', d));

  proc.on('close', (code) => {
    const currentExec = executions.get(executionId);
    if (!currentExec) return;

    currentExec.done = true;
    currentExec.exitCode = Number.isInteger(code) ? code : null;

    // Clear force kill timer
    if (currentExec.forceKillTimer) {
      clearTimeout(currentExec.forceKillTimer);
      currentExec.forceKillTimer = null;
    }

    // Close stdin
    try {
      if (proc.stdin && !proc.stdin.destroyed) {
        proc.stdin.end();
      }
    } catch (e) {
      console.error('[processManager] Error closing stdin:', e);
    }

    // Update DB
    if (currentExec.persist && currentExec.dbExecutionId) {
      db.run(
        'UPDATE executions SET status = ?, exit_code = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['finished', currentExec.exitCode, currentExec.dbExecutionId],
        (err) => {
          if (err) console.error('[processManager] Failed to update execution status:', err);
        }
      );
    }

    broadcastToClients(currentExec, 'close', { done: true, code: currentExec.exitCode });

    // Close all client connections
    for (const res of currentExec.clients) {
      try {
        res.end();
      } catch (e) {
        console.error('[processManager] Error closing client:', e);
      }
    }
    currentExec.clients.clear();

    // Schedule cleanup
    cleanupExecution(executionId, currentExec);
  });

  return { executionId, pid: proc.pid, executionDbId: dbExecutionId };
}

function broadcastToClients(exec, eventType, data) {
  const payload = JSON.stringify(data);
  for (const res of exec.clients) {
    try {
      res.write(`event: ${eventType}\n`);
      res.write(`data: ${payload}\n\n`);
    } catch (e) {
      console.error('[processManager] Error broadcasting to client:', e);
      exec.clients.delete(res);
    }
  }
}

function cleanupExecution(executionId, exec) {
  if (exec.cleanupTimer) clearTimeout(exec.cleanupTimer);
  exec.cleanupTimer = setTimeout(() => {
    executions.delete(executionId);
    console.log('[processManager] Cleaned up execution:', executionId);
  }, CLEANUP_DELAY);
}

export function attachClient(executionId, res) {
  const exec = executions.get(executionId);
  if (!exec) return false;

  if (exec.clients.size >= MAX_CLIENTS_PER_EXECUTION) {
    throw new Error('Maximum clients reached for this execution');
  }

  exec.clients.add(res);

  res.on('close', () => {
    exec.clients.delete(res);
  });

  res.on('error', (err) => {
    console.error('[processManager] Client connection error:', err);
    exec.clients.delete(res);
  });

  // Replay buffered events to new client
  if (exec.buffer.length > 0) {
    for (const item of exec.buffer) {
      try {
        res.write(`event: ${item.type}\n`);
        res.write(`data: ${JSON.stringify({ text: item.text, ts: item.ts })}\n\n`);
      } catch (e) {
        console.error('[processManager] Error replaying buffer:', e);
        break;
      }
    }
  }

  if (exec.done) {
    try {
      res.write(`event: close\n`);
      res.write(`data: ${JSON.stringify({ done: true, code: exec.exitCode })}\n\n`);
      res.end();
    } catch (e) {
      console.error('[processManager] Error sending close event:', e);
    }
  } else if (exec.cleanupTimer) {
    // Reset cleanup timer when new client attaches
    clearTimeout(exec.cleanupTimer);
    exec.cleanupTimer = null;
  }

  return true;
}

export function killExecution(executionId) {
  const exec = executions.get(executionId);
  if (!exec || exec.done) return false;

  try {
    exec.proc.kill('SIGTERM');
    
    // Set timer to force kill if process doesn't exit
    exec.forceKillTimer = setTimeout(() => {
      if (!exec.done) {
        console.log('[processManager] Force killing execution:', executionId);
        try {
          exec.proc.kill('SIGKILL');
        } catch (e) {
          console.error('[processManager] Error force killing process:', e);
        }
      }
    }, FORCE_KILL_TIMEOUT);

    return true;
  } catch (e) {
    console.error('[processManager] Error killing process:', e);
    return false;
  }
}

export function sendInput(executionId, text) {
  const exec = executions.get(executionId);
  if (!exec || exec.done) return false;

  try {
    if (exec.proc.stdin && !exec.proc.stdin.destroyed) {
      exec.proc.stdin.write(text + '\n');
      return true;
    }
    return false;
  } catch (e) {
    console.error('[processManager] Error sending input:', e);
    return false;
  }
}

export function hasExecution(executionId) {
  return executions.has(executionId);
}

export function getExecutionInfo(executionId) {
  const exec = executions.get(executionId);
  if (!exec) return null;

  return {
    executionId,
    pid: exec.proc.pid,
    done: exec.done,
    exitCode: exec.exitCode,
    clients: exec.clients.size,
    bufferSize: exec.buffer.length,
    uptime: Date.now() - exec.startTime,
  };
}

export function listExecutions() {
  return Array.from(executions.entries()).map(([id, exec]) => ({
    executionId: id,
    pid: exec.proc.pid,
    done: exec.done,
    exitCode: exec.exitCode,
    clients: exec.clients.size,
    uptime: Date.now() - exec.startTime,
  }));
}

export function shutdown() {
  console.log('[processManager] Shutting down, killing all executions...');
  for (const [id, exec] of executions.entries()) {
    if (!exec.done) {
      try {
        exec.proc.kill('SIGTERM');
        setTimeout(() => {
          if (!exec.done) exec.proc.kill('SIGKILL');
        }, 5000);
      } catch (e) {
        console.error('[processManager] Error during shutdown:', e);
      }
    }
  }
}
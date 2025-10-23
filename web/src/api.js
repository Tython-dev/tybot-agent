const j = (r) => r.json()

export async function listAgents(){
  return fetch('/api/agents').then(j)
}
export async function createAgent(payload){
  return fetch('/api/agents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(j)
}
export async function updateAgent(id,payload){
  return fetch(`/api/agents/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(j)
}
export async function deleteAgent(id){
  return fetch(`/api/agents/${id}`,{method:'DELETE'}).then(j)
}
export async function getLogs(id){
  return fetch(`/api/agents/${id}/logs`).then(j)
}
export async function runAgent(id){
  return fetch(`/api/agents/${id}/run`,{method:'POST'}).then(j)
}
export async function sendExecutionInput(executionId, text){
  return fetch(`/api/executions/${executionId}/input`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})}).then(j)
}
export async function listExecutions(agentId){
  return fetch(`/api/agents/${agentId}/executions`).then(j)
}
export async function runPrompt(payload){
  const res = await fetch('/api/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = typeof body?.error === 'string' ? body.error : 'Failed to run prompt'
    throw new Error(message)
  }
  return body
}

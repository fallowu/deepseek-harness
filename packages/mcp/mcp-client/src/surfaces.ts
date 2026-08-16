/**
 * Surface bridge: exposes an MCP server's Resources and Prompts as four
 * static model-facing tools on ctx.tools, mirroring the tool bridge's naming
 * and lifecycle contract. Registration is capability-gated - a server that
 * does not advertise resources or prompts in its handshake capabilities gets
 * no tools for that surface.
 *
 * Resources surface (when the server advertises resources):
 * - mcp__<server>__list_resources  -> aggregated pagination of resources/list
 * - mcp__<server>__read_resource   -> resources/read by uri, text projection
 *
 * Prompts surface (when the server advertises prompts):
 * - mcp__<server>__list_prompts    -> aggregated pagination of prompts/list
 * - mcp__<server>__get_prompt      -> prompts/get with arguments, rendered text
 *
 * @module
 */

import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import {
  GetPromptResultSchema, ListPromptsResultSchema, ListResourcesResultSchema, ReadResourceResultSchema,
} from '@modelcontextprotocol/sdk/types.js'
import type { Context } from '@deepseek-ai/cordis'
import type { ToolDefinition, ToolExecution } from '@deepseek-ai/dsh-tools'
import { publicToolName } from './tools.ts'

/** Resolved options relevant to surface bridging. */
export interface SurfaceBridgeOptions {
  serverName: string
  toolCallTimeoutMs: number
  /** Whether the resources surface tools are offered at all. */
  resources: boolean
  /** Whether the prompts surface tools are offered at all. */
  prompts: boolean
}

/** State for one sync generation: surface registrations keyed by public name. */
export type SurfaceDisposers = Map<string, () => void>

/** Loose resource record read at the network trust boundary. */
interface McpResource {
  uri?: string
  name?: string
  description?: string
  mimeType?: string
}

/** Loose prompt record read at the network trust boundary. */
interface McpPrompt {
  name?: string
  description?: string
  arguments?: readonly { name?: string; description?: string; required?: boolean }[]
}

/** Loose resource-contents record read at the network trust boundary. */
interface McpResourceContents {
  contents?: readonly { uri?: string; mimeType?: string; text?: string; blob?: string }[]
}

/** Loose prompt-result record read at the network trust boundary. */
interface McpPromptResult {
  description?: string
  messages?: readonly { role?: string; content?: { type?: string; text?: string; resource?: { uri?: string } } }[]
}

/** Request with timeout + abort like the tool bridge's calls. */
async function requestWithDeadline<T>(
  client: Client,
  method: string,
  params: Record<string, unknown>,
  schema: Parameters<Client['request']>[1],
  exec: ToolExecution,
  opts: SurfaceBridgeOptions,
): Promise<T> {
  return await client.request(
    { method, params },
    schema,
    { signal: exec.signal, timeout: opts.toolCallTimeoutMs },
  ) as Promise<T>
}

/** Canonical output shared by the four surface tools: one text content block. */
function surfaceOutput(): ToolDefinition['output'] {
  return {
    schema: {
      type: 'object',
      properties: { content: { type: 'array', items: {} } },
      required: ['content'],
      additionalProperties: false,
    },
    render(_args: unknown, value: unknown) {
      const result = value as { content?: { type?: string; text?: string }[] }
      const text = result?.content?.[0]?.text ?? ''
      return [{ type: 'text', text }]
    },
  }
}

/** Aggregate one cursor-paginated list call into the full record set. */
async function listAll<T>(
  client: Client,
  method: 'resources/list' | 'prompts/list',
  pick: (response: Record<string, unknown>) => readonly T[],
  schema: Parameters<Client['request']>[1],
  exec: ToolExecution,
  opts: SurfaceBridgeOptions,
): Promise<T[]> {
  const all: T[] = []
  let cursor: string | undefined
  do {
    const response = await requestWithDeadline<Record<string, unknown>>(
      client, method, cursor === undefined ? {} : { cursor }, schema, exec, opts,
    )
    all.push(...pick(response))
    cursor = typeof response.nextCursor === 'string' ? response.nextCursor : undefined
  } while (cursor !== undefined)
  return all
}

/** Render one prompt result's messages into readable text. */
function renderPromptMessages(result: McpPromptResult): string {
  const lines: string[] = []
  if (result.description !== undefined && result.description.length > 0) {
    lines.push(result.description, '')
  }
  for (const message of result.messages ?? []) {
    const role = message.role ?? 'unknown'
    const content = message.content
    if (content?.type === 'text' && content.text !== undefined) {
      lines.push('[' + role + '] ' + content.text)
    } else if (content?.type === 'resource' && content.resource?.uri !== undefined) {
      lines.push('[' + role + '] (embedded resource: ' + content.resource.uri + ')')
    } else {
      lines.push('[' + role + '] (unsupported content type: ' + (content?.type ?? 'none') + ')')
    }
  }
  return lines.join('\n') || '(prompt returned no messages)'
}

/** Render resource contents into readable text; binary blobs stay placeholders. */
function renderResourceContents(result: McpResourceContents): string {
  const lines: string[] = []
  for (const contents of result.contents ?? []) {
    const uri = contents.uri ?? '(missing uri)'
    if (contents.text !== undefined) {
      lines.push('--- ' + uri + (contents.mimeType !== undefined ? ' (' + contents.mimeType + ')' : '') + ' ---')
      lines.push(contents.text)
    } else if (contents.blob !== undefined) {
      lines.push('--- ' + uri + ' (binary ' + (contents.mimeType ?? 'unknown') + ', ' + String(contents.blob.length) + ' base64 chars) ---')
    } else {
      lines.push('--- ' + uri + ' (empty) ---')
    }
  }
  return lines.join('\n') || '(resource returned no contents)'
}

/** Build the four surface ToolDefinitions a server's capabilities admit. */
function surfaceDefinitions(client: Client, opts: SurfaceBridgeOptions): Map<string, ToolDefinition> {
  const capabilities = client.getServerCapabilities()
  const definitions = new Map<string, ToolDefinition>()
  const register = (rawName: string, definition: Omit<ToolDefinition, 'name'>): void => {
    const publicName = publicToolName(opts.serverName, rawName)
    definitions.set(publicName, { name: publicName, ...definition })
  }

  if (opts.resources && capabilities?.resources !== undefined) {
    register('list_resources', {
      description: 'List the resources this MCP server exposes. Each entry has a uri with optional name, description, and mimeType; pass a uri to the read_resource tool to fetch its contents.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      output: surfaceOutput(),
      timeoutMs: opts.toolCallTimeoutMs,
      execute: async (_args: unknown, exec: ToolExecution) => {
        const resources = await listAll<McpResource>(
          client, 'resources/list',
          response => (Array.isArray(response.resources) ? response.resources as McpResource[] : []),
          ListResourcesResultSchema, exec, opts,
        )
        const text = resources.length === 0
          ? '(server exposes no resources)'
          : resources.map((resource) => {
            const parts = [resource.uri ?? '(missing uri)']
            if (resource.name !== undefined) parts.push('name: ' + resource.name)
            if (resource.mimeType !== undefined) parts.push('type: ' + resource.mimeType)
            if (resource.description !== undefined) parts.push(resource.description)
            return parts.join(' - ')
          }).join('\n')
        return { content: [{ type: 'text', text }] }
      },
    })
    register('read_resource', {
      description: 'Read one MCP resource by its uri and return its contents as text; binary contents are summarized as placeholders.',
      parameters: {
        type: 'object',
        properties: { uri: { type: 'string', description: 'The resource uri from list_resources.' } },
        required: ['uri'],
        additionalProperties: false,
      },
      output: surfaceOutput(),
      timeoutMs: opts.toolCallTimeoutMs,
      execute: async (args: unknown, exec: ToolExecution) => {
        const uri = typeof args === 'object' && args !== null && typeof (args as { uri?: unknown }).uri === 'string'
          ? (args as { uri: string }).uri
          : undefined
        if (uri === undefined) throw new Error('read_resource requires a string "uri"')
        const result = await requestWithDeadline<McpResourceContents>(
          client, 'resources/read', { uri }, ReadResourceResultSchema, exec, opts,
        )
        return { content: [{ type: 'text', text: renderResourceContents(result) }] }
      },
    })
  }

  if (opts.prompts && capabilities?.prompts !== undefined) {
    register('list_prompts', {
      description: "List the prompt templates this MCP server exposes, with each prompt's arguments; pass a name plus arguments to the get_prompt tool to render it.",
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      output: surfaceOutput(),
      timeoutMs: opts.toolCallTimeoutMs,
      execute: async (_args: unknown, exec: ToolExecution) => {
        const prompts = await listAll<McpPrompt>(
          client, 'prompts/list',
          response => (Array.isArray(response.prompts) ? response.prompts as McpPrompt[] : []),
          ListPromptsResultSchema, exec, opts,
        )
        const text = prompts.length === 0
          ? '(server exposes no prompts)'
          : prompts.map((prompt) => {
            const args = (prompt.arguments ?? []).map((argument) => {
              const flag = argument.required === true ? ' (required)' : ''
              const hint = argument.description === undefined ? '' : ': ' + argument.description
              return '  - ' + (argument.name ?? '(unnamed)') + flag + hint
            })
            return [prompt.name ?? '(unnamed)', prompt.description ?? '', ...args].filter(part => part.length > 0).join('\n')
          }).join('\n\n')
        return { content: [{ type: 'text', text }] }
      },
    })
    register('get_prompt', {
      description: 'Render one MCP prompt template with the given arguments and return its resulting messages as text.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'The prompt name from list_prompts.' },
          arguments: { type: 'object', description: "Values for the prompt's declared arguments.", additionalProperties: { type: 'string' } },
        },
        required: ['name'],
        additionalProperties: false,
      },
      output: surfaceOutput(),
      timeoutMs: opts.toolCallTimeoutMs,
      execute: async (args: unknown, exec: ToolExecution) => {
        if (typeof args !== 'object' || args === null) throw new Error('get_prompt requires an object body')
        const body = args as { name?: unknown; arguments?: unknown }
        if (typeof body.name !== 'string') throw new Error('get_prompt requires a string "name"')
        const params: Record<string, unknown> = { name: body.name }
        if (body.arguments !== undefined) {
          if (typeof body.arguments !== 'object' || body.arguments === null || Array.isArray(body.arguments)) {
            throw new Error('get_prompt "arguments" must be an object of strings')
          }
          params.arguments = body.arguments
        }
        const result = await requestWithDeadline<McpPromptResult>(
          client, 'prompts/get', params, GetPromptResultSchema, exec, opts,
        )
        return { content: [{ type: 'text', text: renderPromptMessages(result) }] }
      },
    })
  }
  return definitions
}

/**
 * Sync the surface tools for the connected generation. Same two-phase
 * discipline as the tool bridge: build the full next generation first, then
 * dispose the previous generation and register the new one. Surface tools
 * are static per generation, so every sync rebuilds the same set - cheap,
 * and it keeps the swap logic identical to the tool bridge's.
 *
 * @param client - Connected MCP Client whose capabilities gate registration.
 * @param ctx - Cordis context providing the tools service.
 * @param opts - Surface options: namespace, timeout, and surface switches.
 * @param previous - Disposer map from the prior generation; disposed in the swap.
 * @returns The live surface registrations owned by this server.
 */
export async function syncSurfaces(
  client: Client,
  ctx: Context,
  opts: SurfaceBridgeOptions,
  previous: SurfaceDisposers,
): Promise<SurfaceDisposers> {
  const definitions = surfaceDefinitions(client, opts)
  for (const dispose of previous.values()) dispose()
  const disposers: SurfaceDisposers = new Map()
  try {
    for (const [publicName, definition] of definitions) {
      disposers.set(publicName, ctx.tools.register(definition))
    }
  } catch (error) {
    for (const dispose of disposers.values()) dispose()
    ctx.logger.error('mcp-client(' + opts.serverName + '): surface registration failed, surfaces not registered: ' + String(error))
    return new Map()
  }
  return disposers
}

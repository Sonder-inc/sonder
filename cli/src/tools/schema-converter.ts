import { z } from 'zod'
import type { MCPToolInputSchema } from '../services/mcp-types'

/**
 * Convert MCP JSON Schema to Zod schema
 * Handles common JSON Schema types used in MCP tool definitions
 */
export function jsonSchemaToZod(schema: MCPToolInputSchema): z.ZodType {
  if (schema.type !== 'object') {
    // MCP tools always have object schemas
    return z.object({})
  }

  const shape: Record<string, z.ZodType> = {}
  const required = new Set(schema.required || [])

  for (const [key, prop] of Object.entries(schema.properties || {})) {
    let fieldSchema = jsonSchemaPropertyToZod(prop)

    // Add description if present
    if (prop.description) {
      fieldSchema = fieldSchema.describe(prop.description)
    }

    // Make optional if not required
    if (!required.has(key)) {
      fieldSchema = fieldSchema.optional()
      // Add default if present
      if (prop.default !== undefined) {
        fieldSchema = fieldSchema.default(prop.default)
      }
    }

    shape[key] = fieldSchema
  }

  return z.object(shape)
}

/**
 * Convert a single JSON Schema property to Zod
 */
function jsonSchemaPropertyToZod(prop: {
  type: string
  enum?: string[]
  items?: { type: string }
}): z.ZodType {
  // Handle enum first (takes precedence over type)
  if (prop.enum && prop.enum.length > 0) {
    return z.enum(prop.enum as [string, ...string[]])
  }

  switch (prop.type) {
    case 'string':
      return z.string()
    case 'number':
      return z.number()
    case 'integer':
      return z.number().int()
    case 'boolean':
      return z.boolean()
    case 'array':
      if (prop.items) {
        return z.array(jsonSchemaPropertyToZod(prop.items))
      }
      return z.array(z.unknown())
    case 'object':
      return z.record(z.unknown())
    default:
      return z.unknown()
  }
}

/**
 * Convert Zod schema to JSON Schema (for AI SDK / MCP compatibility)
 * This is a simplified conversion for common patterns
 */
export function zodToJsonSchema(schema: z.ZodType): MCPToolInputSchema {
  const result: MCPToolInputSchema = {
    type: 'object',
    properties: {},
    required: [],
  }

  // Handle ZodObject
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape
    for (const [key, value] of Object.entries(shape)) {
      const { schema: propSchema, required } = zodPropertyToJsonSchema(value as z.ZodType)
      result.properties![key] = propSchema
      if (required) {
        result.required!.push(key)
      }
    }
  }

  return result
}

/**
 * Convert a single Zod property to JSON Schema
 */
function zodPropertyToJsonSchema(schema: z.ZodType): {
  schema: { type: string; description?: string; enum?: string[]; default?: unknown }
  required: boolean
} {
  let required = true
  let currentSchema = schema
  let defaultValue: unknown = undefined

  // Unwrap optional/default
  if (currentSchema instanceof z.ZodOptional) {
    required = false
    currentSchema = currentSchema.unwrap()
  }
  if (currentSchema instanceof z.ZodDefault) {
    required = false
    defaultValue = currentSchema._def.defaultValue()
    currentSchema = currentSchema._def.innerType
  }

  // Get description
  const description = currentSchema.description

  // Convert base type
  let type = 'string'
  let enumValues: string[] | undefined

  if (currentSchema instanceof z.ZodString) {
    type = 'string'
  } else if (currentSchema instanceof z.ZodNumber) {
    type = 'number'
  } else if (currentSchema instanceof z.ZodBoolean) {
    type = 'boolean'
  } else if (currentSchema instanceof z.ZodArray) {
    type = 'array'
  } else if (currentSchema instanceof z.ZodEnum) {
    type = 'string'
    enumValues = currentSchema.options
  } else if (currentSchema instanceof z.ZodObject) {
    type = 'object'
  }

  const result: { type: string; description?: string; enum?: string[]; default?: unknown } = { type }
  if (description) result.description = description
  if (enumValues) result.enum = enumValues
  if (defaultValue !== undefined) result.default = defaultValue

  return { schema: result, required }
}

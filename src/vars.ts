import { z } from 'incur'
import type Openfort from '@openfort/openfort-node'

export const varsSchema = z.object({
  openfort: z.custom<Openfort>(),
})

export type VarsSchema = typeof varsSchema

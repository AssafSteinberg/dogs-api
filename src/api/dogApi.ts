import type { Leaf } from '../domain/leaf'
import { ApiError } from './errors'
import { parseBreedList, parseImageResponse } from './guards'

const BASE_URL = 'https://dog.ceo/api'

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

/**
 * GETs a Dog CEO path and returns the parsed JSON body as unknown.
 * An aborted request is rethrown as-is (not an ApiError) so callers can ignore it;
 * every other failure becomes an ApiError.
 */
async function getJson(path: string, signal?: AbortSignal): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, { signal })
  } catch (error) {
    if (isAbortError(error)) throw error
    throw new ApiError('network', error instanceof Error ? error.message : 'Network request failed')
  }

  if (!response.ok) {
    throw new ApiError('http', `The dog API answered with status ${response.status}`, response.status)
  }

  try {
    return await response.json()
  } catch (error) {
    if (isAbortError(error)) throw error
    throw new ApiError('shape', 'The dog API did not return valid JSON')
  }
}

/** All breeds and their sub-breeds, as the API's breed -> sub-breeds record. */
export async function fetchBreedList(signal?: AbortSignal): Promise<Record<string, string[]>> {
  return parseBreedList(await getJson('/breeds/list/all', signal))
}

/**
 * One random image URL for a leaf. A sub-breed always uses the sub-breed endpoint:
 * the breed-level endpoint would return an image of a random sub-breed.
 */
export async function fetchRandomImage(leaf: Leaf, signal?: AbortSignal): Promise<string> {
  const path =
    leaf.sub === null
      ? `/breed/${leaf.breed}/images/random`
      : `/breed/${leaf.breed}/${leaf.sub}/images/random`
  return parseImageResponse(await getJson(path, signal))
}

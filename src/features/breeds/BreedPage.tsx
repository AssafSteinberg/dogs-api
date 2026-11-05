import { useParams } from 'react-router'
import { AsyncState } from '../../components/AsyncState'
import { toLeafId } from '../../domain/leaf'
import { BreedDetails } from './BreedDetails'
import { useBreeds } from './BreedsProvider'

/**
 * The item page of one element: /breeds/:breed or /breeds/:breed/:sub (architecture section 5).
 * It shows what the master list's old expanding panel showed, and nothing more.
 */
export function BreedPage() {
  const { breed, sub } = useParams()
  const { status, index, retry } = useBreeds()

  // The element can only be named once the breed list is known (FR-D-11).
  if (status !== 'done') {
    return <AsyncState status={status} failedMessage="Couldn't load the list of breeds." onRetry={retry} />
  }

  const leaf = breed === undefined ? undefined : index.get(toLeafId(breed, sub === undefined ? null : sub))

  if (leaf === undefined) {
    // A static 404 page: plain text, nothing else (FR-D-1b).
    return (
      <>
        <h1>404</h1>
        <p>Page not found.</p>
      </>
    )
  }

  return <BreedDetails key={leaf.id} leaf={leaf} />
}

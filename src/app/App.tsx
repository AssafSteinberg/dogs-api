import { Navigate, Route, Routes } from 'react-router'
import { Toast } from '../components/Toast'
import { BreedPage } from '../features/breeds/BreedPage'
import { BreedsPage } from '../features/breeds/BreedsPage'
import { BreedsProvider } from '../features/breeds/BreedsProvider'
import { PackPage } from '../features/pack/PackPage'
import { WishlistPage } from '../features/wishlist/WishlistPage'
import { CollectionProvider } from '../state/collection'
import { NotificationsProvider } from '../state/notifications'
import { AppLayout } from './AppLayout'

/** Providers and the route table (architecture section 4). The router itself is set up in main.tsx. */
export function App() {
  return (
    <NotificationsProvider>
      <BreedsProvider>
        <CollectionProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/breeds" replace />} />
              <Route path="breeds" element={<BreedsPage />} />
              {/* An element's own page: /breeds/:breed (no sub-breeds) or /breeds/:breed/:sub. Not in the sidebar. */}
              <Route path="breeds/:breed/:sub?" element={<BreedPage />} />
              <Route path="pack" element={<PackPage />} />
              <Route path="wishlist" element={<WishlistPage />} />
              <Route path="*" element={<Navigate to="/breeds" replace />} />
            </Route>
          </Routes>
        </CollectionProvider>
      </BreedsProvider>
      <Toast />
    </NotificationsProvider>
  )
}

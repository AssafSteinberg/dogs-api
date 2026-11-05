import { Navigate, Route, Routes } from 'react-router'
import { Toast } from '../components/Toast'
import { BreedsPage } from '../features/breeds/BreedsPage'
import { BreedsProvider } from '../features/breeds/BreedsProvider'
import { PackPage } from '../features/pack/PackPage'
import { WishlistPage } from '../features/wishlist/WishlistPage'
import { NotificationsProvider } from '../state/notifications'
import { AppLayout } from './AppLayout'

/** Providers and the route table (architecture section 4). The router itself is set up in main.tsx. */
export function App() {
  return (
    <NotificationsProvider>
      <BreedsProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/breeds" replace />} />
            {/* One route for /breeds, /breeds/:breed and /breeds/:breed/:sub, so the list stays mounted. */}
            <Route path="breeds/:breed?/:sub?" element={<BreedsPage />} />
            <Route path="pack" element={<PackPage />} />
            <Route path="wishlist" element={<WishlistPage />} />
            <Route path="*" element={<Navigate to="/breeds" replace />} />
          </Route>
        </Routes>
      </BreedsProvider>
      <Toast />
    </NotificationsProvider>
  )
}

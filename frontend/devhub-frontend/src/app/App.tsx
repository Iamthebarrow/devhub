import { Providers } from './providers'
import { AppRoutes } from './routes'

/**
 * Root application component.
 */
function App() {
  return (
    <Providers>
      <AppRoutes />
    </Providers>
  )
}

export default App

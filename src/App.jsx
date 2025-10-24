import JobReminderSystem from './JobReminderSystem.tsx'
import ErrorBoundary from './ErrorBoundary'

function App() {
  return (
    <div className="App">
      <ErrorBoundary>
        <JobReminderSystem />
      </ErrorBoundary>
    </div>
  )
}

export default App

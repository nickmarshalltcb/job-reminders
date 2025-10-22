import JobReminderSystem from '../job_reminder_system'
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

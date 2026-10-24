/** Full-screen loading state with the HouseMate logo. */
export function LoadingScreen({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="center-screen" aria-busy="true">
      <div>
        <div className="logo" style={{ margin: '0 auto 14px' }}>
          🏠
        </div>
        <small>{label}</small>
      </div>
    </div>
  )
}

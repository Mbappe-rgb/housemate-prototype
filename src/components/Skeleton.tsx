/** Placeholder shapes of the dashboard (hero and sheet), shown while the household loads. */
export function AppSkeleton() {
  return (
    <div className="dash" aria-busy="true" aria-label="Loading your household">
      <div className="hero2" />
      <div className="sh2 white" style={{ paddingTop: 24 }}>
        <div className="bal">
          <span className="sk" style={{ height: 70, borderRadius: 20 }} />
          <span className="sk" style={{ height: 70, borderRadius: 20 }} />
        </div>
        <span className="sk" style={{ width: '30%', height: 16, margin: '8px 4px 14px' }} />
        <span className="sk" style={{ height: 132, borderRadius: 16, marginBottom: 12 }} />
        <span className="sk" style={{ height: 132, borderRadius: 16 }} />
      </div>
    </div>
  )
}

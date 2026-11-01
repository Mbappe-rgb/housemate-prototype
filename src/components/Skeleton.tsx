/** Grey placeholder shapes of the dashboard, shown while the household loads. */
export function AppSkeleton() {
  return (
    <div className="scr" aria-busy="true" aria-label="Loading your household">
      <div className="hd">
        <span className="sk" style={{ width: 46, height: 46, borderRadius: '50%' }} />
        <div>
          <span className="sk" style={{ width: '60%', height: 16, marginBottom: 6 }} />
          <span className="sk" style={{ width: '40%', height: 12 }} />
        </div>
      </div>
      <span className="sk" style={{ height: 230, borderRadius: 26, marginBottom: 12 }} />
      <div className="tiles">
        <span className="sk" style={{ height: 84, borderRadius: 24 }} />
        <span className="sk" style={{ height: 84, borderRadius: 24 }} />
      </div>
      <span className="sk" style={{ height: 78, borderRadius: 26, marginBottom: 12 }} />
      <span className="sk" style={{ height: 76, borderRadius: 24, marginBottom: 10 }} />
      <span className="sk" style={{ height: 76, borderRadius: 24 }} />
    </div>
  )
}

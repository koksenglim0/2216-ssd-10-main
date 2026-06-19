import { useCallback, useEffect, useState } from 'react'

export function useAsyncData(loader) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const result = await loader()
      setData(result)
      return result
    } catch (err) {
      setError(err.message || 'Unable to load data')
      return null
    } finally {
      setLoading(false)
    }
  }, [loader])

  useEffect(() => {
    void Promise.resolve().then(reload)
  }, [reload])

  return { data, error, loading, reload, setData }
}

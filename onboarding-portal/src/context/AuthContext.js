import { createContext, useContext } from 'react'

// A "context" is a value any component can read without passing it down through props.
// AuthProvider.jsx fills it with: { user, role, loading, login, logout }
export const AuthContext = createContext(null)

// Use this in any component: const { user, role, login, logout } = useAuth()
export function useAuth() {
  return useContext(AuthContext)
}

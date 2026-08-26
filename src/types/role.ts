export type AppRole = 'ADMIN' | 'EDITOR' | 'GUEST'

export const canDeletePhotos = (role: AppRole) => role === 'ADMIN' || role === 'EDITOR'

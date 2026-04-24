import { databaseConnection } from '@/leaking-usage'

console.log('DB:', databaseConnection)
console.log('API URL:', import.meta.env['VITE_API_URL'])

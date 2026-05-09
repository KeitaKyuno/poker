import bcrypt from 'bcryptjs'

const PIN_REGEX = /^[0-9]{4}$/

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10)
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash)
}

export function isValidPin(pin: string): boolean {
  return PIN_REGEX.test(pin)
}

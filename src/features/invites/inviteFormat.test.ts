import { describe, expect, it } from 'vitest'
import { formatCode, inviteLink, parseInviteInput } from './inviteFormat'

describe('invite codes', () => {
  it('groups codes in fours', () => {
    expect(formatCode('K7QM2XPD9TCF')).toBe('K7QM-2XPD-9TCF')
  })
  it('reads codes however people type or paste them', () => {
    expect(parseInviteInput('K7QM-2XPD-9TCF')).toBe('K7QM2XPD9TCF')
    expect(parseInviteInput('k7qm 2xpd 9tcf')).toBe('K7QM2XPD9TCF')
    expect(parseInviteInput('https://housemate-prototype.vercel.app/join/K7QM-2XPD-9TCF')).toBe('K7QM2XPD9TCF')
    expect(parseInviteInput('  housemate.app/join/K7QM2XPD9TCF?x=1 ')).toBe('K7QM2XPD9TCF')
  })
  it('rejects codes that can’t be real', () => {
    expect(parseInviteInput('')).toBeNull()
    expect(parseInviteInput('WEBR-7K4Q')).toBeNull() // too short (old prototype format)
    expect(parseInviteInput('K7QM-2XPD-9TC0')).toBeNull() // 0 is never used
  })
  it('builds the share link', () => {
    expect(inviteLink('K7QM2XPD9TCF', 'https://example.test')).toBe('https://example.test/join/K7QM-2XPD-9TCF')
  })
})

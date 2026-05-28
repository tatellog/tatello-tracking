/*
 * Whether the órbita engine — the Anthropic-backed reader that writes
 * the Voz de Stelar, the detected patterns and the archetype — is
 * connected.
 *
 * While false, those pieces are MOCK: placeholder examples from
 * mock.ts. The UI must then frame them honestly as a preview and
 * never claim Stelar has actually read the user's data — no
 * "leído por Stelar · N días", no confidence signature, no
 * first-reading reveal. Flip to true once the engine ships.
 */
export const ENGINE_ACTIVE = false

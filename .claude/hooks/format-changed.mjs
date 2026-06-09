#!/usr/bin/env node
/*
 * Stop hook · auto-formato.
 *
 * Corre cuando Claude termina un turno (no después de cada edit, para no
 * interferir a mitad de trabajo). Formatea con prettier SOLO los archivos
 * que cambiaron en el working tree, y solo tipos seguros (código + docs).
 *
 * Excluye json / js / configs raíz a propósito: el CLAUDE.md pide permiso
 * antes de tocar app.json, eas.json, tsconfig, etc., así que el formato
 * automático no los toca.
 *
 * Fail-open: cualquier error se traga y sale 0 — un hook de formato nunca
 * debe bloquear ni romper el flujo.
 */
import { execFileSync, execSync } from 'node:child_process'

const FORMATTABLE = /\.(ts|tsx|jsx|md|mdx|css|scss)$/

try {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd()
  const status = execSync('git status --porcelain', {
    cwd: projectDir,
    encoding: 'utf8',
  })

  const files = status
    .split('\n')
    .filter(Boolean)
    // porcelain: "XY <path>" · para renombrados toma el destino tras "->"
    .map((line) => {
      const path = line.slice(3).trim()
      return path.includes(' -> ') ? path.split(' -> ')[1] : path
    })
    .filter((path) => FORMATTABLE.test(path))

  if (files.length > 0) {
    execFileSync('./node_modules/.bin/prettier', ['--write', '--log-level', 'silent', ...files], {
      cwd: projectDir,
      stdio: 'ignore',
    })
  }
} catch {
  // nunca bloquear por un fallo de formato
}

process.exit(0)

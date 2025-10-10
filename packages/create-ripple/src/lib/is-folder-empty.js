import { lstatSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { green, blue } from 'kleur/colors'

/**
 * Check whether a target directory is effectively empty for project creation.
 *
 * This function treats a small set of common metadata and tooling files as
 * non-conflicting (for example `.git`, `.DS_Store`, IDE folders, and logs).
 * If other files or folders are present it will print a human friendly list
 * of conflicting entries and return `false` so the caller can abort or prompt
 * the user for action.
 *
 * @param {string} root - Absolute path to the directory to inspect
 * @param {string} name - Human-friendly directory name used in console output
 * @returns {boolean} `true` when the directory contains no conflicting files,
 * otherwise `false` (and a list of conflicts is printed to stdout)
 */
export function isFolderEmpty(root, name) {
  // Files and directories we consider safe to ignore when creating a project
  // inside an existing folder. This mirrors common project-creation tooling
  // behavior by allowing editor, VCS, and log artifacts.
  const validFiles = [
    '.DS_Store',
    '.git',
    '.gitattributes',
    '.gitignore',
    '.gitlab-ci.yml',
    '.hg',
    '.hgcheck',
    '.hgignore',
    '.idea',
    '.npmignore',
    '.travis.yml',
    'LICENSE',
    'Thumbs.db',
    'docs',
    'mkdocs.yml',
    'npm-debug.log',
    'yarn-debug.log',
    'yarn-error.log',
    'yarnrc.yml',
    '.yarn',
  ]

  // Read directory contents and filter out known-safe files. Any remaining
  // entries are treated as conflicts.
  const conflicts = readdirSync(root).filter(
    (file) =>
      !validFiles.includes(file) &&
      // Support IntelliJ IDEA-based editors
      !/\.iml$/.test(file)
  )

  // If we found conflicts, print a friendly message listing files and
  // directories that might conflict with creating a new project.
  if (conflicts.length > 0) {
    console.log(
      `The directory ${green(name)} contains files that could conflict:`
    )
    console.log()

    for (const file of conflicts) {
      try {
        const stats = lstatSync(join(root, file))
        // Show directories with a trailing slash to make output clearer.
        if (stats.isDirectory()) {
          console.log(`  ${blue(file)}/`)
        } else {
          console.log(`  ${file}`)
        }
      } catch {
        // If we can't stat the file for any reason just print the name.
        console.log(`  ${file}`)
      }
    }

    console.log()
    console.log(
      'Either try using a new directory name, or remove the files listed above.'
    )
    console.log()
    return false
  }

  // No conflicts found
  return true
}

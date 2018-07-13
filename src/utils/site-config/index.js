const findUp = require('find-up')
const path = require('path')
const makeDir = require('make-dir')
const fs = require('fs')
const writeFileAtomic = require('write-file-atomic')
const dotProp = require('dot-prop')

const permissionError = "You don't have access to this file."
const makeDirOptions = { mode: 0o0700 }
const writeFileOptions = { mode: 0o0600 }

class SiteConfig {
  constructor(dir, defaults, opts) {
    opts = {
      name: '.netlify.json',
      rootIndicators: ['netlify.toml', '.git'],
      ...opts
    }

    this.dir = dir

    if (opts.path) {
      this.path = path.join(opts.path, opts.name)
    } else {
      const rootIndicator = findUp.sync([opts.name, ...opts.rootIndicators], { cwd: dir })
      this.path = path.join(rootIndicator ? path.dirname(rootIndicator) : dir, opts.name)
    }

    this.all = Object.assign({}, defaults, this.all)
  }

  get all() {
    try {
      return JSON.parse(fs.readFileSync(this.path, 'utf8'))
    } catch (err) {
      // Create dir if it doesn't exist
      if (err.code === 'ENOENT') {
        makeDir.sync(path.dirname(this.path), makeDirOptions)
        return {}
      }

      // Improve the message of permission errors
      if (err.code === 'EACCES') {
        err.message = `${err.message}\n${permissionError}\n`
      }

      // Empty the file if it encounters invalid JSON
      if (err.name === 'SyntaxError') {
        writeFileAtomic.sync(this.path, '', writeFileOptions)
        return {}
      }

      throw err
    }
  }

  set all(val) {
    try {
      // Make sure the folder exists as it could have been deleted in the meantime
      makeDir.sync(path.dirname(this.path), makeDirOptions)

      writeFileAtomic.sync(this.path, JSON.stringify(val, null, '\t'), writeFileOptions)
    } catch (err) {
      // Improve the message of permission errors
      if (err.code === 'EACCES') {
        err.message = `${err.message}\n${permissionError}\n`
      }

      throw err
    }
  }

  get size() {
    return Object.keys(this.all || {}).length
  }

  get(key) {
    return dotProp.get(this.all, key)
  }
  set(key, val) {
    const config = this.all

    if (arguments.length === 1) {
      for (const k of Object.keys(key)) {
        dotProp.set(config, k, key[k])
      }
    } else {
      dotProp.set(config, key, val)
    }

    this.all = config
  }

  has(key) {
    return dotProp.has(this.all, key)
  }
  delete(key) {
    const config = this.all
    dotProp.delete(config, key)
    this.all = config
  }
  clear() {
    this.all = {}
  }
}

module.exports = SiteConfig

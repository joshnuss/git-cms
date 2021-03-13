import express from 'express'
import glob from 'tiny-glob'
import fs from 'fs'
import path from 'path'
import yaml from 'yaml'

const app = express()
const content = await loadContent('content')

async function loadContent(dir) {
  const files = await glob(path.join(dir, "**/*.yml"))
  const content = {}

  files.forEach(file => {
    const keys = file
      .replace(new RegExp(`^${dir}/`), '')
      .split('/')
      .map(key => path.parse(key).name)

    const data = fs.readFileSync(file, 'utf8')
    const record = yaml.parse(data)

    const last = keys.reduce((acc, key) => {
      if (!acc[key])
        acc[key] = {}

      return acc[key]
    }, content)

    Object.assign(last, record)
  })

  return content
}

function findResults(keys) {
  const results = {}

  keys.forEach(parts => {
    let last = content, missing = false

    parts.forEach(part => {
      if (!last[part]) {
        missing = true
        return
      }

      last = last[part]
    })

    if (last && !missing) {
      let lastResult = results
      parts.forEach((part, i) => {
        lastResult[part] ||= i == parts.length - 1 ? last : {} 

        lastResult = lastResult[part]
      })
    }
  })

  return results
}

app.get('/content/*', (req, res) => {
  const keys = req.params[0].split('+').map(key => key.split('.'))
  const results = findResults(keys)

  res.json(results)
})

app.listen(3001)

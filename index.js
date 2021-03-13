import express from 'express'
import glob from 'tiny-glob'
import fs from 'fs'
import path from 'path'
import yaml from 'yaml'
import http from 'http'
import ws from 'ws'
import chokidar from 'chokidar'

const app = express()
const server = http.createServer(app)
const wss = new ws.Server({server})
const dir = 'content'
const allWatches = {}
const content = await loadContent(dir)

chokidar.watch(dir).on('all', (event, path) => {
  console.log(event, path)

  if (event == 'change') {
    loadFile(path, content)
  }
})

wss.on('connection', ws => {
  const watches = []

  ws.on('message', message => {
    parseKeys(message).forEach(key => {
      key = key.join('.')

      allWatches[key] ||= []
      allWatches[key].push((key, value) => {
        ws.send(JSON.stringify({key, value}))
      })
      watches.push(key)
    })
  })
})

async function loadContent(dir) {
  const files = await glob(path.join(dir, "**/*.yml"))
  const content = {}

  files.forEach(file => {
    loadFile(file, content)
  })

  return content
}

function loadFile(file, content) {
  const keys = file
    .replace(new RegExp(`^${dir}/`), '')
    .split('/')
    .map(key => path.parse(key).name)

  const callbacks = allWatches[keys.join('.')] || []
  const data = fs.readFileSync(file, 'utf8')
  const record = yaml.parse(data)

  const last = keys.reduce((acc, key, index) => {
    if (!acc[key] || index == keys.length-1)
      acc[key] = {}

    return acc[key]
  }, content)

  callbacks.forEach(callback => callback(keys.join('.'), record))
  Object.assign(last, record)
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
        lastResult[part] ||= (i == parts.length - 1 ? last : {}) 

        lastResult = lastResult[part]
      })
    }
  })

  return results
}

function parseKeys(string) {
  return string.split('+').map(key => key.split('.'))
}

app.get('/content/*', (req, res) => {
  const keys = parseKeys(req.params[0])
  const results = findResults(keys)

  res.json(results)
})

server.listen(3001)

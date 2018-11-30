/*
 * REPL
 * ****
 *
 * This is a bonus command I found useful for testing. You can bind the NodeJS
 * REPL to any object, so here we bind it to an instance of Cortex.
 *
 * That means you can open up the REPL and type commands like
 * `querySessions()` as if they were supported natively by Node.
 *
 */

const Cortex = require('../lib/cortex')
const repl = require('repl')
const vm = require('vm')
const util = require('util')

function init (options) {
  const client = new Cortex(options)

  let proto = Cortex.prototype
  while (proto !== Object.prototype) {
    for (const prop of Object.getOwnPropertyNames(proto)) {
      if (prop[0] === '_' || prop[0] === prop[0].toUpperCase() || typeof client[prop] !== 'function') continue
      client[prop] = client[prop].bind(client)
    }
    proto = Object.getPrototypeOf(proto)
  }

  client.ready.then(() => {
    console.log('Connected')
    const r = repl.start({
      prompt: 'Cortex> ',
      writer: (expr) => {
        if (expr instanceof Promise || expr instanceof ClientContextPromise) {
          r.setPrompt('')
          const resetPrompt = () => {
            r.setPrompt('Cortex> ')
            r.displayPrompt()
          }
          expr.then((result) => {
            if (result !== undefined) {
              console.log(util.inspect(result, undefined, undefined, true))
            } else {
              console.log('OK')
            }
            resetPrompt()
          },
          (error) => {
            if (error instanceof Error) {
              console.log(error.toString())
            } else {
              console.log('FAILED')
            }
            resetPrompt()
          })
          return '...'
        } else {
          return util.inspect(expr, undefined, undefined, true)
        }
      }
    })
    const clientContext = vm.createContext(client)
    clientContext.module = r.context.module
    clientContext.require = r.context.require
    r.context = clientContext

    const ClientContextPromise = vm.runInContext('Promise', clientContext)

    process.on('unhandledRejection', (err) => {
      console.log()
      console.log('Unhandled Promise rejection:')
      console.log(err)
      r.displayPrompt()
    })

    r.on('exit', () => client.close())
    client.ws.on('close', () => {
      console.log()
      console.log('Socket disconnected')
      r.close()
    })
  })
}

if (require.main === module) {
  const verbose = process.env.LOG_LEVEL || 1

  init({verbose})
}

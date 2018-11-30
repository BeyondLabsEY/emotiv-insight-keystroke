const Cortex = require('./lib/cortex')

const client = new Cortex({})

client.ready.then(() =>
  client.init()
  .queryHeadsets()
  .then(headsets => console.log('headsets', headsets))
)

// At some point this will be a general front-end for all the features in /src, but not yet

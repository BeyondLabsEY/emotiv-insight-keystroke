/*
 * Events
 * ******
 *
 * This example demonstrates using Cortex to subscribe to events for mental
 * commands and facial expressions. We take all the different kinds and
 * combine them together into a single event that only fires when something's
 * changed.
 *
 * It also accepts a threshold for hwo confident it should be before it
 * reports a result.
 *
 * If require()d as a library, it should be called with a callback function
 * like this:
 *     const onEvent = require('./events')
 *     onEvent(client, threshold, (event) => console.log('got an event!', event))
 *
 * If you run it from the command line it will do this for you and just print
 * out events as they happen.
 *
 */

const Cortex = require("../lib/cortex");
const robot = require("robotjs");

// Small wrapper function  to turn the column-oriented format we get from the
// API into key:value pairs
const columns2obj = headers => cols => {
  const obj = {};
  for (let i = 0; i < cols.length; i++) {
    obj[headers[i]] = cols[i];
  }
  return obj;
};

function events(client, threshold, onResult) {
  return client
    .createSession({ status: "open" })
    .then(() => client.subscribe({ streams: ["com", "fac"] }))
    .then(subs => {
      if (!subs[0].com || !subs[1].fac) throw new Error("failed to subscribe");

      const current = {
        command: "neutral",
        eyes: "neutral",
        brows: "neutral",
        mouth: "neutral"
      };

      // Here we listen for facial expressions
      const fac2obj = columns2obj(subs[1].fac.cols);
      const onFac = ev => {
        const data = fac2obj(ev.fac);

        let updated = false;
        let update = (k, v) => {
          if (current[k] !== v) {
            updated = true;
            current[k] = v;
          }
        };

        // Eye direction doesn't have a power rating, so we send every change
        update("eyes", data.eyeAct);

        if (data.uPow >= threshold) update("brows", data.uAct);
        if (data.lPow >= threshold) update("mouth", data.lAct);

        if (updated) onResult(Object.assign({}, current));
      };
      client.on("fac", onFac);

      // And here we do mental commands
      const com2obj = columns2obj(subs[0].com.cols);
      const onCom = ev => {
        const data = com2obj(ev.com);
        if (data.act !== current.command && data.pow >= threshold) {
          current.command = data.act;
          onResult(Object.assign({}, current));
        }
      };
      client.on("com", onCom);

      // Return a function to call to finish up
      return () =>
        client
          .unsubscribe({ streams: ["com", "fac"] })
          .then(() => client.updateSession({ status: "close" }))
          .then(() => {
            client.removeListener("com", onCom);
            client.removeListener("fac", onFac);
          });
    });
}

const pad = (str, n) =>
  str + new Array(Math.max(0, n - str.length + 1)).join(" ");

// This is the main module that gets evaluated when you run it from the
// command line
if (require.main === module) {
  process.on("unhandledRejection", err => {
    throw err;
  });

  // We can set LOG_LEVEL=2 or 3 for more detailed errors
  const verbose = process.env.LOG_LEVEL || 0;
  const options = { verbose, threshold: 0 };
  const threshold = 0;

  const client = new Cortex(options);

  client.ready.then(() => client.init()).then(() => {
    console.log(
      `Watching for facial expressions and mental commands above ${Math.round(
        threshold * 100
      )}% power`
    );

    events(client, threshold, ({ eyes, brows, mouth, command }) => {

      if (brows == "surprise") {
        //Code like \x1b[32m that is to colorize the output :)
        console.log("\x1b[32msurprise \u{1F62E} \x1b[33m sending key pagedown")
        //Fires the pagedown key
        robot.keyTap("pagedown");
      }

      if (eyes == "winkL") {
        console.log("\x1b[32mwink left \u{1F609} \x1b[33m sending key pageup")
        //Fires the pageup key
        robot.keyTap("pageup");
      }

      console.log(
        `\x1b[36meeg data events: \x1b[0m\x1b[34meyes: \x1b[37m${pad(eyes, 10)} \x1b[34mbrows: \x1b[37m${pad(brows, 10)} \x1b[34mmouth: \x1b[37m${pad(
          mouth,
          10
        )}`
      );
    });
  });

  // We could use the value returned by events() here, but when we ctrl+c it
  // will clean up the connection anyway
}

module.exports = events;

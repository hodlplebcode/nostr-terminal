import 'dotenv/config'

import { generateSecretKey, getPublicKey, finalizeEvent, verifyEvent } from 'nostr-tools/pure'
import { Relay } from 'nostr-tools/relay'
import { SimplePool, useWebSocketImplementation } from 'nostr-tools/pool'
// import { useWebSocketImplementation } from 'nostr-tools/relay'
import { WebSocket } from 'ws'

import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import { bech32, bech32m } from 'bech32';

import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const NSEC = bytesToHex(bech32Decoder('nsec', process.env.NSEC));
const NPUB = bytesToHex(bech32Decoder('npub', process.env.NPUB));

useWebSocketImplementation(WebSocket);
showMenu();

async function showMenu() {
  console.log("\x1b[0m", `########################`);
  console.log(`[VIEW / V] View Feed`);
  console.log(`[WRITE / W] Write a Note`);
  console.log(`[EXIT / E] Exit`);

  const rl = readline.createInterface({ input, output });
  const action = await rl.question('Choose Action: ');
  rl.close();

  switch(action.charAt(0).toLowerCase()) {
    case "v":
      runView();
      break;
    case "w":
      runWrite();
      break;
    case "e":
      runExit();
      break;
    default:
      console.log("Default")
      showMenu();
  }
}

async function runView() {

  let authorsArray = await getFollows();

  const pool = new SimplePool()
  let relays = ['wss://relay.satoshidnc.com/', 'wss://nos.lol', 'wss://relay.primal.net']
  // const relay = await Relay.connect('wss://nos.lol/')
  let eventArray = [];

  let sub = pool.subscribeMany([...relays],[
  // const sub = relay.subscribe([
      {
        kinds: [1],
        limit: 5,
        authors: authorsArray
      },
    ], {
    onevent(event) {
      eventArray.push(event) // add each event to eventArray
    },
    oneose() {
      // end of stream
      let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      let dateFormat = {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: timezone,
          hour12: true // Use 24-hour format
      };

      let fg = "\x1b[37m"; // white
      let bg = "\x1b[40m"; // black

      // loop through eventArray and print results
      for(let e of eventArray) {
        // Convert Unix timestamp to milliseconds
        let date = new Date(e.created_at * 1000);
        let formattedDate = new Intl.DateTimeFormat('en-US', dateFormat).format(date);

        console.log(bg, fg, `${formattedDate} | ${e.content}`)

        fg = fg == "\x1b[37m" ? "\x1b[30m" : "\x1b[37m";
        bg = bg == "\x1b[40m" ? "\x1b[47m" : "\x1b[40m";
      }
      sub.close();
      showMenu();
    }
  })

}

function getFollows() {
  return new Promise((resolve, reject) => {
    const pool = new SimplePool()
    let relays = ['wss://relay.satoshidnc.com/', 'wss://nos.lol', 'wss://relay.primal.net']
    let authorsArray = [];
    let eventResponse;

    let sub = pool.subscribeMany([...relays],[
    // const sub = relay.subscribe([
        {
          kinds: [3], // kind 3 is the follower list
          authors: [NPUB] // npub hex
        },
      ], {
      onevent(event) {
        eventResponse = event // add each event to eventArray
      },
      oneose() {
        // end of subscrption
        // loop through tags and add to authorsArray
        for(let tag of eventResponse.tags) {
          // Convert Unix timestamp to milliseconds
          if (tag[0] === "p") {
            authorsArray.push(tag[1])
          }
        }
        sub.close();
        resolve(authorsArray)
      }
    })
  }); // end Promise =>

}

async function runWrite() {
  // console.log("runWrite");
  const rl = readline.createInterface({ input, output });
  // let nsec = await rl.question('Enter your nsec -or- press [enter] for .env: ');
  const eventContent = await rl.question('Enter your Note Text: ');
  rl.close();

  // use finalizeEvent from nostr-tools to get the event.id, event.pubkey, event.sig
  const createdAt = Math.floor(Date.now() / 1000);
  const event = finalizeEvent({
    kind: 1,
    created_at: createdAt,
    tags: [],
    content: eventContent,
  }, NSEC)


  if (!verifyEvent(event)) {
    runError();
  } else {
    // create the JSON for the EVENT that will be broadcast
    const eventJson = `[
      "EVENT",
      {
          "id": "${event.id}",
          "pubkey": "${event.pubkey}",
          "created_at": ${createdAt},
          "kind": 1,
          "content": "${eventContent}",
          "tags": [],
          "sig": "${event.sig}"
      }
    ]`;

    console.log(`Your event is ready to broadcast.`);

    runWriteBroadcast(eventJson);
  }
}

async function runWriteBroadcast(eventJson) {
  const rl = readline.createInterface({ input, output });
  const eventAction = await rl.question('[B]roadcast, [V]iew JSON, [M]ain Menu: ');
  rl.close();

  switch(eventAction.charAt(0).toLowerCase()) {
    case "b":
      console.log(`### Broadcasting ... `);
      break;
    case "v":
      console.log(`${eventJson}`);
      runWriteBroadcast(eventJson);
      break;
    case "m":
      showMenu();
      break;
    default:
      console.log(`! Invalid Option, Try Again`);
      runWriteBroadcast();
  }
}

function runExit() {
  console.log("runExit");
  process.exit(1);
}

function runError() {
  console.log(`Something Went Wrong !!!`)
  runExit();
}

function bech32Decoder(currPrefix, data) {
  const { prefix, words } = bech32.decode(data);
  if (prefix !== currPrefix) {
      throw Error('Invalid address format');
  }
  return Buffer.from(bech32.fromWords(words));
}
